-- Lets an admin correct a submitted stocktake without reopening it.
--
-- Reopening (back to draft) would lose who submitted it and when, and a
-- re-submit would stamp the admin's name on someone else's count. Instead
-- the count stays submitted with its original submitter and submission time,
-- and the edit is recorded separately (edited_by / edited_at) for a small
-- note on the stocktake screen.
--
-- Unlike save_stock_take(), this does NOT write units/prices back to the
-- master item list: correcting an old count mustn't quietly change the
-- prices the next count starts from. Its lines are a snapshot, and only the
-- snapshot changes. A brand-new item added during the edit is created in the
-- master list (it needs an id), with the unit and price entered.

alter table stock_takes
  add column edited_by uuid references profiles (id) on delete set null,
  add column edited_by_name text,
  add column edited_at timestamptz;

create or replace function public.admin_edit_stock_take(
  p_stock_take_id uuid,
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
  v_type text;
  v_status text;
  v_actor_name text;
  v_entry jsonb;
  v_qty jsonb;
  v_item_id uuid;
  v_unit text;
  v_price numeric;
  v_max_sort int;
  v_total_qty numeric;
  v_entry_id uuid;
begin
  if not is_admin() then
    raise exception 'Only an admin can edit a submitted stocktake';
  end if;

  select type, status into v_type, v_status from stock_takes where id = p_stock_take_id for update;
  if not found then
    raise exception 'Stocktake not found';
  end if;
  if v_status <> 'submitted' then
    raise exception 'This stocktake is still a draft — resume it instead';
  end if;

  select full_name into v_actor_name from profiles where id = auth.uid();

  update stock_takes
  set stock_date = p_stock_date,
      notes = p_notes,
      edited_by = auth.uid(),
      edited_by_name = v_actor_name,
      edited_at = now(),
      updated_at = now()
  where id = p_stock_take_id;

  delete from stock_take_entries where stock_take_id = p_stock_take_id;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_unit := nullif(v_entry->>'unit', '');
    v_price := nullif(v_entry->>'unit_price', '')::numeric;

    if v_entry->>'stock_item_id' is not null then
      v_item_id := (v_entry->>'stock_item_id')::uuid;
    else
      select coalesce(max(sort_order), -1) + 1 into v_max_sort from stock_items where type = v_type;
      insert into stock_items (type, group_name, name, unit, unit_price, sort_order)
      values (v_type, v_entry->>'group_name', v_entry->>'name', v_unit, v_price, v_max_sort)
      on conflict (type, name) do nothing
      returning id into v_item_id;
      if v_item_id is null then
        select id into v_item_id from stock_items where type = v_type and name = v_entry->>'name';
      end if;
    end if;

    v_total_qty := 0;
    for v_qty in select * from jsonb_array_elements(v_entry->'quantities')
    loop
      v_total_qty := v_total_qty + coalesce((v_qty->>'quantity')::numeric, 0);
    end loop;

    insert into stock_take_entries (stock_take_id, stock_item_id, group_name, item_name, unit, unit_price, total_qty, value)
    values (
      p_stock_take_id, v_item_id, v_entry->>'group_name', v_entry->>'name', v_unit, v_price,
      v_total_qty, v_total_qty * coalesce(v_price, 0)
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

  return p_stock_take_id;
end;
$$;

grant execute on function public.admin_edit_stock_take(uuid, date, text, jsonb) to authenticated;
