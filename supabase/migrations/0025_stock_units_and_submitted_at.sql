-- Two changes to the Stocktake app:
--
-- 1. Units become a managed dropdown list rather than free text, with
--    separate lists per type (a keg/cask means nothing in a dry store).
--    Unlike stock_items — where every write goes through save_stock_take()
--    so the audit log can't be bypassed — stock_units is just a lookup
--    list with no audit implications, so it gets a plain open insert
--    policy: anyone can add one straight from the dropdown mid-stocktake,
--    which is the whole point. Admin-only delete keeps the list tidy.
--
-- 2. stock_takes.submitted_at records when a stocktake was actually
--    submitted, as distinct from stock_date (the date the stock was
--    counted, which the user sets and may backdate) and created_at (when
--    the draft was first started).

create table stock_units (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('wet', 'dry')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (type, name)
);

alter table stock_units enable row level security;

create policy "stock_units_select"
  on stock_units for select
  to authenticated
  using (true);

create policy "stock_units_insert"
  on stock_units for insert
  to authenticated
  with check (true);

create policy "stock_units_admin_delete"
  on stock_units for delete
  to authenticated
  using (is_admin());

insert into stock_units (type, name, sort_order) values
  ('wet', 'keg', 0),
  ('wet', 'cask', 1),
  ('wet', 'bottle', 2),
  ('wet', 'case', 3),
  ('wet', 'litre', 4),
  ('wet', 'each', 5),
  ('dry', 'case', 0),
  ('dry', 'box', 1),
  ('dry', 'bag', 2),
  ('dry', 'kg', 3),
  ('dry', 'each', 4);

alter table stock_takes add column submitted_at timestamptz;

-- Recreated to set submitted_at the moment status becomes 'submitted'.
-- Everything else is unchanged from 0024.
create or replace function public.save_stock_take(
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
    insert into stock_takes (type, status, stock_date, submitted_by, submitted_by_name, notes, submitted_at)
    values (
      p_type, p_status, p_stock_date, auth.uid(), v_actor_name, p_notes,
      case when p_status = 'submitted' then now() else null end
    )
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
    set status = p_status,
        stock_date = p_stock_date,
        notes = p_notes,
        updated_at = now(),
        submitted_at = case when p_status = 'submitted' then now() else null end
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
