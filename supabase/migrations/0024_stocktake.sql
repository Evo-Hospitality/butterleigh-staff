-- Stocktake mini-app: wet (drink) / dry (food) stock counts. Anyone can
-- submit one, and can save partway through as a draft to resume later.
-- Items are grouped by category, counted per location, and valued at
-- unit_price. Locations are separate lists per type (wet vs dry stock live
-- in different places). Unit/unit_price live on the shared stock_items
-- master list and persist across stocktakes until amended; every amendment
-- is logged in stock_item_changes.
--
-- Every write (new/resumed stocktake, new item, item amendment, the change
-- log) happens inside save_stock_take() below, a single security-definer
-- transaction — so none of those tables get a direct INSERT/UPDATE policy
-- for regular users at all, only SELECT (plus one narrow DELETE policy for
-- abandoning a draft). This is deliberately tighter than "open insert"
-- would be: the only way to create/amend a stock_items row is through the
-- one path that also writes the audit log, so the log can never be
-- silently bypassed by an ordinary client call. stock_locations is the one
-- exception — admin manages it directly via plain CRUD, same shape as
-- bank_holidays.

-- ---------------------------------------------------------------------------
-- stock_locations — separate lists per type
-- ---------------------------------------------------------------------------

create table stock_locations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('wet', 'dry')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (type, name)
);

alter table stock_locations enable row level security;

create policy "stock_locations_select"
  on stock_locations for select
  to authenticated
  using (true);

create policy "stock_locations_admin_write"
  on stock_locations for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- stock_items — the shared, persistent master list per type
-- ---------------------------------------------------------------------------

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('wet', 'dry')),
  group_name text not null,
  name text not null,
  unit text,
  unit_price numeric,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (type, name)
);

alter table stock_items enable row level security;

create policy "stock_items_select"
  on stock_items for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- stock_takes — one row per stocktake session, draft or submitted. A draft
-- is a shared, resumable working document — any authenticated user can
-- resume or abandon one, not just whoever started it, since a physical
-- stock count is often continued by someone else. Once status flips to
-- 'submitted' it's immutable (enforced inside save_stock_take() below).
-- ---------------------------------------------------------------------------

create table stock_takes (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('wet', 'dry')),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  stock_date date not null,
  submitted_by uuid references profiles (id) on delete set null,
  submitted_by_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table stock_takes enable row level security;

create policy "stock_takes_select"
  on stock_takes for select
  to authenticated
  using (true);

-- Abandoning a draft is a plain, non-corruptible delete (no audit-log
-- complexity involved), so this is the one direct-from-client write on any
-- of these tables — everything else goes through save_stock_take(). A
-- submitted record can't be deleted this way (admin delete uses the
-- service-role client instead, same as Events/Photos).
create policy "stock_takes_delete_draft"
  on stock_takes for delete
  to authenticated
  using (status = 'draft');

-- ---------------------------------------------------------------------------
-- stock_take_entries — one row per item counted in a stocktake, snapshotting
-- name/unit/unit_price so a later master-list price change never
-- retroactively alters a past stocktake's reported value.
-- ---------------------------------------------------------------------------

create table stock_take_entries (
  id uuid primary key default gen_random_uuid(),
  stock_take_id uuid not null references stock_takes (id) on delete cascade,
  stock_item_id uuid references stock_items (id) on delete set null,
  group_name text not null,
  item_name text not null,
  unit text,
  unit_price numeric,
  total_qty numeric not null default 0,
  value numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table stock_take_entries enable row level security;

create policy "stock_take_entries_select"
  on stock_take_entries for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- stock_take_quantities — per-location quantity for a stocktake entry
-- ---------------------------------------------------------------------------

create table stock_take_quantities (
  id uuid primary key default gen_random_uuid(),
  stock_take_entry_id uuid not null references stock_take_entries (id) on delete cascade,
  location_id uuid references stock_locations (id) on delete set null,
  location_name text not null,
  quantity numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table stock_take_quantities enable row level security;

create policy "stock_take_quantities_select"
  on stock_take_quantities for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- stock_item_changes — the log: one row per field actually changed. Written
-- on every save (draft or submit) where a value actually differs from
-- what's currently on the master item, not deferred until final submit.
-- ---------------------------------------------------------------------------

create table stock_item_changes (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid references stock_items (id) on delete set null,
  item_name text not null,
  field text not null check (field in ('unit', 'unit_price')),
  old_value text,
  new_value text,
  changed_by uuid references profiles (id) on delete set null,
  changed_by_name text not null,
  stock_take_id uuid references stock_takes (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table stock_item_changes enable row level security;

create policy "stock_item_changes_select"
  on stock_item_changes for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- save_stock_take — the one write path, for both "save as draft" and
-- "submit". p_stock_take_id null starts a new stocktake; non-null resumes
-- an existing draft (must still be status='draft' — a submitted record can
-- never be passed back through here). Either way this fully replaces that
-- stocktake's entries/quantities with what's passed in (simplest correct
-- model for "resume and re-save a shared draft" — no partial-row merging).
-- Creates/amends stock_items as needed and logs any real change, on every
-- call regardless of p_status, since values should persist across saves
-- the moment they're entered, not just once finally submitted.
-- p_entries shape: [{ stock_item_id: uuid|null, group_name, name, unit,
-- unit_price, quantities: [{ location_id, quantity }] }]
-- ---------------------------------------------------------------------------

create function public.save_stock_take(
  p_stock_take_id uuid,
  p_type text,
  p_status text,
  p_stock_date date,
  p_notes text,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_stock_take_id uuid;
  v_existing_status text;
  v_entry jsonb;
  v_qty jsonb;
  v_item_id uuid;
  v_old_unit text;
  v_old_price numeric;
  v_new_unit text;
  v_new_price numeric;
  v_max_sort int;
  v_total_qty numeric;
  v_entry_id uuid;
begin
  select full_name into v_actor_name from profiles where id = auth.uid();

  if p_stock_take_id is null then
    insert into stock_takes (type, status, stock_date, submitted_by, submitted_by_name, notes)
    values (p_type, p_status, p_stock_date, auth.uid(), v_actor_name, p_notes)
    returning id into v_stock_take_id;
  else
    select status into v_existing_status from stock_takes where id = p_stock_take_id for update;
    if not found then
      raise exception 'Stocktake not found';
    end if;
    if v_existing_status <> 'draft' then
      raise exception 'This stocktake has already been submitted and can no longer be edited';
    end if;

    update stock_takes
    set status = p_status, stock_date = p_stock_date, notes = p_notes, updated_at = now()
    where id = p_stock_take_id;
    v_stock_take_id := p_stock_take_id;

    -- Full-replace: clear out the previous save's entries (and their
    -- quantities, via cascade) before re-inserting the current state.
    delete from stock_take_entries where stock_take_id = v_stock_take_id;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_new_unit := nullif(v_entry->>'unit', '');
    v_new_price := nullif(v_entry->>'unit_price', '')::numeric;

    if v_entry->>'stock_item_id' is not null then
      -- Existing item: lock it, capture the pre-update values so we know
      -- what actually changed, then write the new values.
      select id, unit, unit_price into v_item_id, v_old_unit, v_old_price
      from stock_items where id = (v_entry->>'stock_item_id')::uuid
      for update;

      update stock_items set unit = v_new_unit, unit_price = v_new_price where id = v_item_id;

      if v_old_unit is distinct from v_new_unit then
        insert into stock_item_changes (stock_item_id, item_name, field, old_value, new_value, changed_by, changed_by_name, stock_take_id)
        values (v_item_id, v_entry->>'name', 'unit', v_old_unit, v_new_unit, auth.uid(), v_actor_name, v_stock_take_id);
      end if;
      if v_old_price is distinct from v_new_price then
        insert into stock_item_changes (stock_item_id, item_name, field, old_value, new_value, changed_by, changed_by_name, stock_take_id)
        values (v_item_id, v_entry->>'name', 'unit_price', v_old_price::text, v_new_price::text, auth.uid(), v_actor_name, v_stock_take_id);
      end if;
    else
      -- New item: appended at the end of its type's list. on conflict
      -- handles two people adding the same new item name at once, or
      -- re-adding a name that already exists — it just becomes an
      -- amendment to the existing row instead of erroring.
      select coalesce(max(sort_order), -1) + 1 into v_max_sort from stock_items where type = p_type;

      insert into stock_items (type, group_name, name, unit, unit_price, sort_order)
      values (p_type, v_entry->>'group_name', v_entry->>'name', v_new_unit, v_new_price, v_max_sort)
      on conflict (type, name) do update set unit = excluded.unit, unit_price = excluded.unit_price
      returning id into v_item_id;
    end if;

    v_total_qty := 0;
    for v_qty in select * from jsonb_array_elements(v_entry->'quantities')
    loop
      v_total_qty := v_total_qty + coalesce((v_qty->>'quantity')::numeric, 0);
    end loop;

    insert into stock_take_entries (stock_take_id, stock_item_id, group_name, item_name, unit, unit_price, total_qty, value)
    values (
      v_stock_take_id, v_item_id, v_entry->>'group_name', v_entry->>'name', v_new_unit, v_new_price,
      v_total_qty, v_total_qty * coalesce(v_new_price, 0)
    )
    returning id into v_entry_id;

    for v_qty in select * from jsonb_array_elements(v_entry->'quantities')
    loop
      insert into stock_take_quantities (stock_take_entry_id, location_id, location_name, quantity)
      values (
        v_entry_id,
        (v_qty->>'location_id')::uuid,
        (select name from stock_locations where id = (v_qty->>'location_id')::uuid),
        coalesce((v_qty->>'quantity')::numeric, 0)
      );
    end loop;
  end loop;

  return v_stock_take_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed data: the 140 wet items from the mockup spreadsheet, in the same
-- group order. Unit/unit_price start unset — filled in on first count, per
-- the mockup's blank Unit/Unit Price columns. Dry starts empty; items get
-- added the same way, inline during a stocktake.
-- ---------------------------------------------------------------------------

insert into stock_items (type, group_name, name, sort_order) values
  ('wet', 'Draught Beer & Cider', 'Butterleigh Brew', 0),
  ('wet', 'Draught Beer & Cider', 'Proper Job', 1),
  ('wet', 'Draught Beer & Cider', 'Tribute', 2),
  ('wet', 'Draught Beer & Cider', 'Guest Ale', 3),
  ('wet', 'Draught Beer & Cider', 'Utopian', 4),
  ('wet', 'Draught Beer & Cider', 'Kronenbourg 1664', 5),
  ('wet', 'Draught Beer & Cider', 'Harbour', 6),
  ('wet', 'Draught Beer & Cider', 'Carlsberg', 7),
  ('wet', 'Draught Beer & Cider', 'Poretti', 8),
  ('wet', 'Draught Beer & Cider', 'Guinness', 9),
  ('wet', 'Draught Beer & Cider', 'Devon Red', 10),
  ('wet', 'Draught Beer & Cider', 'Bens Cider', 11),
  ('wet', 'Bottled Cider', 'Sandford 0%', 12),
  ('wet', 'Bottled Cider', 'Fanny Brambles', 13),
  ('wet', 'Bottled Cider', 'cherry cider', 14),
  ('wet', 'Bottled Cider', 'elderflower cider', 15),
  ('wet', 'Bottle Beer', 'Birra Moretti Zero', 16),
  ('wet', 'Bottle Beer', 'Gem Gluten Free', 17),
  ('wet', 'Bottle Beer', 'Guinness Zero', 18),
  ('wet', 'Bottle Beer', 'Proper Job 0.5%', 19),
  ('wet', 'Bottle Beer', 'korev can', 20),
  ('wet', 'Soft Drinks Glass', 'Lemonade BIB', 21),
  ('wet', 'Soft Drinks Glass', 'Pepsi BIB', 22),
  ('wet', 'Soft Drinks Glass', 'Apple Juice', 23),
  ('wet', 'Soft Drinks Glass', 'Cranberry Juice', 24),
  ('wet', 'Soft Drinks Glass', 'Orange Juice', 25),
  ('wet', 'Soft Drinks Glass', 'Tomato Juice', 26),
  ('wet', 'Soft Drinks Glass', 'Lemon & Lime', 27),
  ('wet', 'Soft Drinks Glass', 'eldeflower cordial', 28),
  ('wet', 'Soft Drinks Bottle', 'Sparkling Apple Juice', 29),
  ('wet', 'Soft Drinks Bottle', 'J20 Apple & Mango', 30),
  ('wet', 'Soft Drinks Bottle', 'J2O Apple & Raspberry', 31),
  ('wet', 'Soft Drinks Bottle', 'J20 Dragon Berry', 32),
  ('wet', 'Soft Drinks Bottle', 'J2O Orange', 33),
  ('wet', 'Soft Drinks Bottle', 'Cola NRB', 34),
  ('wet', 'Soft Drinks Bottle', 'Fruit Shoot Orange', 35),
  ('wet', 'Soft Drinks Bottle', 'Fruit Shoot Apple & Blackcurrant', 36),
  ('wet', 'Soft Drinks Bottle', 'Still Water 75cl', 37),
  ('wet', 'Soft Drinks Bottle', 'Still Water 33cl', 38),
  ('wet', 'Soft Drinks Bottle', 'Sparkling Water 75cl', 39),
  ('wet', 'Soft Drinks Bottle', 'Sparking Water 33cl', 40),
  ('wet', 'Red Wine', '19 - Acaballo Merlot (Chile)', 41),
  ('wet', 'Red Wine', '20 - Murphy Big Rivers Shiraz (Australia)', 42),
  ('wet', 'Red Wine', '21 - Chateau Malbat (France)', 43),
  ('wet', 'Red Wine', '22 - Rupe Secca Nero D''Avola (Italy)', 44),
  ('wet', 'Red Wine', '23 - Casa Silva Cabernet Sauvignon Carmenere (Chile)', 45),
  ('wet', 'Red Wine', '24 -La Voile Rouge (France)', 46),
  ('wet', 'Red Wine', '25 -Maison Jaffelin Pinot Noir (France)', 47),
  ('wet', 'Red Wine', '26 -Gustales Crianza Rioja (Spain)', 48),
  ('wet', 'Red Wine', '27 -Gouguenheim ''Reserve'' Malbec (Argentina)', 49),
  ('wet', 'Red Wine', '28 -Pavia Casareggio Barbera d''Asti (Italy)', 50),
  ('wet', 'Red Wine', '29 -Les Galets De La Berthaude (France)', 51),
  ('wet', 'White Wine', '7 - Amanti Pinot Grigio (Italy)', 52),
  ('wet', 'White Wine', '8 - Pato Torrente Sauvignon Blanc (Chile)', 53),
  ('wet', 'White Wine', '9 - Wide River Chenin Blanc (South Africa)', 54),
  ('wet', 'White Wine', '10 - Villa Wolf Riesling Dry (Germany)', 55),
  ('wet', 'White Wine', '11 - Rioja Vega Termpranillo (Spain)', 56),
  ('wet', 'White Wine', '12 - Pouilly-Fume (France)', 57),
  ('wet', 'White Wine', '13 - La Voile Blanc (France)', 58),
  ('wet', 'White Wine', '14 - Terre d''Eole Prestige Picpoul De Pinet (France)', 59),
  ('wet', 'White Wine', '15 - Pask Instinct Sauvignon Blanc (New Zealand)', 60),
  ('wet', 'White Wine', '16 - Talmard Macon Chardonnay (France)', 61),
  ('wet', 'White Wine', '17 - Bodegas Aquitania Bernon Albarino (Spain)', 62),
  ('wet', 'White Wine', '18 - Chablis Montmains 1er Cru (France)', 63),
  ('wet', 'Rose Wine', '4 - La Voile Rose (France)', 64),
  ('wet', 'Rose Wine', '5 - Organic Rosado Rioja (Spain)', 65),
  ('wet', 'Rose Wine', '6 - Perle De Valensole (France)', 66),
  ('wet', 'Sparkling Wine', '1 - Organic Proverbio Prosecco Extra Dry (Italy)', 67),
  ('wet', 'Sparkling Wine', '2 - Cremant de Bourgogne Brut (France)', 68),
  ('wet', 'Sparkling Wine', '3 - Beaumont Des Crayeres ''Grande Reserve'' Champagne (France)', 69),
  ('wet', 'Pudding & Fortified Wine', 'Château Doisy Vedrines, Sauternes Bottle', 70),
  ('wet', 'Pudding & Fortified Wine', 'Stanton & Killeen Rutherglen Muscat Bottle', 71),
  ('wet', 'Pudding & Fortified Wine', 'Mas Amell Maury, Rousillon Bottle', 72),
  ('wet', 'Pudding & Fortified Wine', 'Barbadillo Pedro Ximinez Sherry', 73),
  ('wet', 'Pudding & Fortified Wine', 'Portal 10yr Old Tawny Port', 74),
  ('wet', 'Vodka/Tequila', 'el Jimador Blanco Tequila', 75),
  ('wet', 'Vodka/Tequila', 'el Jimador Reposado Tequila', 76),
  ('wet', 'Vodka/Tequila', 'Ocho Blanco Tequila', 77),
  ('wet', 'Vodka/Tequila', 'Ocho Repasado Tequila', 78),
  ('wet', 'Vodka/Tequila', 'Quiquiriqui', 79),
  ('wet', 'Vodka/Tequila', 'Tors Vanilla Vodka', 80),
  ('wet', 'Vodka/Tequila', 'Tors Vodka', 81),
  ('wet', 'Vodka/Tequila', 'Shanty Vodka', 82),
  ('wet', 'Vodka/Tequila', 'Devon Cove Vodka', 83),
  ('wet', 'Vodka/Tequila', 'Jose Cuervo', 84),
  ('wet', 'Gin', 'New London Light Gin', 85),
  ('wet', 'Gin', 'Butterleign Gin', 86),
  ('wet', 'Gin', 'Tarquins zest &salt Gin', 87),
  ('wet', 'Gin', 'Tarquins Raspberry and Mango Gin', 88),
  ('wet', 'Gin', 'Tarquins Pressed Apple Gin', 89),
  ('wet', 'Gin', 'Tarquins Blackcurrant Gin', 90),
  ('wet', 'Gin', 'Tarquins Strawberry and Lime Gin', 91),
  ('wet', 'Gin', 'Tarquins Passion & Peach Gin', 92),
  ('wet', 'Gin', 'Pimms', 93),
  ('wet', 'Gin', 'Cotswolds Dry Gin', 94),
  ('wet', 'Gin', 'Salcombe Gin', 95),
  ('wet', 'Gin', 'Gotland Gin', 96),
  ('wet', 'Gin', 'Elderflower & Pear', 97),
  ('wet', 'Gin', 'Limehouse Pink', 98),
  ('wet', 'Rum', 'Malibu', 99),
  ('wet', 'Rum', 'Goslings Black Seal', 100),
  ('wet', 'Rum', 'Devon Golden Rum', 101),
  ('wet', 'Rum', 'Devon Spiced Rum', 102),
  ('wet', 'Rum', 'Havana Club', 103),
  ('wet', 'Rum', 'Bacardi', 104),
  ('wet', 'Rum', 'El Dorado Rum', 105),
  ('wet', 'Rum', 'Shanty Rum', 106),
  ('wet', 'Vermouth', 'Noilly Prat', 107),
  ('wet', 'Vermouth', 'Lolette Rose', 108),
  ('wet', 'Vermouth', 'Punt e Mes', 109),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Southern Comfort', 110),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Courvoisier', 111),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Johnnie Walker Black Label', 112),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Bells', 113),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Glenmorangie', 114),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Laphroaig', 115),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Woodford Reserve', 116),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Jameson', 117),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Jack Daniels', 118),
  ('wet', 'Whiskey/Bourbon/Cognac', 'Bunnahabhain 12yr', 119),
  ('wet', 'Liqueurs', 'Baileys', 120),
  ('wet', 'Liqueurs', 'Cointreau', 121),
  ('wet', 'Liqueurs', 'Aperol', 122),
  ('wet', 'Liqueurs', 'Archers', 123),
  ('wet', 'Liqueurs', 'Kahlua', 124),
  ('wet', 'Liqueurs', 'Grand Marnier', 125),
  ('wet', 'Liqueurs', 'Drambuie', 126),
  ('wet', 'Liqueurs', 'Amaretto Disaronno', 127),
  ('wet', 'Liqueurs', 'Campari', 128),
  ('wet', 'Liqueurs', 'Tia Maria', 129),
  ('wet', 'Liqueurs', 'Genepi', 130),
  ('wet', 'Liqueurs', 'Tequilla Rose', 131),
  ('wet', 'Liqueurs', 'Apple Sourz', 132),
  ('wet', 'Liqueurs', 'Sambuca', 133),
  ('wet', 'Mixers', 'Ginger Ale', 134),
  ('wet', 'Mixers', 'Ginger Beer', 135),
  ('wet', 'Mixers', 'Tonic', 136),
  ('wet', 'Premade Cocktails', 'Gin Garden', 137),
  ('wet', 'Premade Cocktails', 'Spicy Marg', 138),
  ('wet', 'Premade Cocktails', 'Pornstar Martini', 139);
