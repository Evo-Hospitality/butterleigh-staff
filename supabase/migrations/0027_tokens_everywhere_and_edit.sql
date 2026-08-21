-- Part 1: extends the double-submit protection from 0026 to every other
-- module that creates a record. Same shape throughout — a nullable token
-- plus a partial unique index, so existing rows (all null) don't collide.
--
-- Part 2: lets the raiser, the assignee, or an admin edit an Action or a
-- maintenance request's wording after the fact.

-- ---------------------------------------------------------------------------
-- Part 1 — submission tokens
-- ---------------------------------------------------------------------------

alter table event_suggestions add column submission_token uuid;
alter table sop_entries add column submission_token uuid;
alter table tasks add column submission_token uuid;
alter table social_photo_posts add column submission_token uuid;
alter table leave_requests add column submission_token uuid;
alter table lieu_requests add column submission_token uuid;
alter table stock_takes add column submission_token uuid;

create unique index event_suggestions_submission_token_key
  on event_suggestions (submission_token) where submission_token is not null;
create unique index sop_entries_submission_token_key
  on sop_entries (submission_token) where submission_token is not null;
create unique index tasks_submission_token_key
  on tasks (submission_token) where submission_token is not null;
create unique index social_photo_posts_submission_token_key
  on social_photo_posts (submission_token) where submission_token is not null;
create unique index leave_requests_submission_token_key
  on leave_requests (submission_token) where submission_token is not null;
create unique index lieu_requests_submission_token_key
  on lieu_requests (submission_token) where submission_token is not null;
create unique index stock_takes_submission_token_key
  on stock_takes (submission_token) where submission_token is not null;

-- request_leave() gains a token parameter. Everything else is unchanged from
-- 0023 — the balance-reservation logic and the row lock stay exactly as they
-- were. Dropping first because the signature changes.
drop function if exists public.request_leave(date, date, numeric, boolean, text);

create function public.request_leave(
  p_start_date date,
  p_end_date date,
  p_amount numeric,
  p_is_unpaid boolean,
  p_notes text,
  p_submission_token uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_employment_type text;
  v_year int;
  v_balance leave_balances;
  v_pending numeric;
  v_remaining numeric;
  v_request_id uuid;
  v_existing uuid;
begin
  -- Same form submitted twice: hand back the request the first press made.
  if p_submission_token is not null then
    select id into v_existing from leave_requests where submission_token = p_submission_token;
    if found then
      return v_existing;
    end if;
  end if;

  select employment_type into v_employment_type from profiles where id = v_staff_id;
  v_year := extract(year from p_start_date)::int;

  if not p_is_unpaid then
    select * into v_balance from leave_balances
    where staff_id = v_staff_id and leave_year = v_year
    for update;

    select coalesce(sum(amount), 0) into v_pending
    from leave_requests
    where staff_id = v_staff_id and status = 'pending' and not is_unpaid
      and extract(year from start_date) = v_year;

    if v_employment_type = 'hourly' then
      v_remaining := coalesce(v_balance.brought_forward, 0) + coalesce(v_balance.accrued_hours, 0)
        - coalesce(v_balance.used_hours, 0) - v_pending;
    else
      v_remaining := coalesce(v_balance.brought_forward, 0) + coalesce(v_balance.base_allowance, 0)
        + coalesce(v_balance.lieu_days_earned, 0) - coalesce(v_balance.used_days, 0) - v_pending;
    end if;

    if p_amount > v_remaining then
      raise exception 'Only % % available (% already pending) — this request is for %',
        v_remaining, case when v_employment_type = 'hourly' then 'hours' else 'days' end, v_pending, p_amount;
    end if;
  end if;

  insert into leave_requests (staff_id, start_date, end_date, amount, is_unpaid, notes, submission_token)
  values (v_staff_id, p_start_date, p_end_date, p_amount, p_is_unpaid, p_notes, p_submission_token)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- save_stock_take() likewise. Only the new-stocktake branch uses the token —
-- resuming a draft already targets a specific id, so it can't duplicate.
drop function if exists public.save_stock_take(uuid, text, text, date, text, jsonb);

create function public.save_stock_take(
  p_stock_take_id uuid,
  p_type text,
  p_status text,
  p_stock_date date,
  p_notes text,
  p_entries jsonb,
  p_submission_token uuid default null
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
    if p_submission_token is not null then
      select id into v_stock_take_id from stock_takes where submission_token = p_submission_token;
      if found then
        return v_stock_take_id;
      end if;
    end if;

    insert into stock_takes (type, status, stock_date, submitted_by, submitted_by_name, notes, submitted_at, submission_token)
    values (
      p_type, p_status, p_stock_date, auth.uid(), v_actor_name, p_notes,
      case when p_status = 'submitted' then now() else null end,
      p_submission_token
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

-- ---------------------------------------------------------------------------
-- Part 2 — editing an Action / maintenance request
--
-- The existing update policies govern the assignee acting on a row (status,
-- reassignment). Editing the wording is a different question — the raiser
-- should be able to fix their own request even though they may not own it.
-- Both go through security-definer RPCs rather than widening those policies,
-- keeping the "who may change what" decision in one readable place and
-- writing the audit-log entry in the same transaction.
-- ---------------------------------------------------------------------------

create function public.edit_action_item(p_action_id uuid, p_title text, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row action_items;
  v_actor_name text;
  v_changed text[] := '{}';
begin
  select * into v_row from action_items where id = p_action_id for update;
  if not found then
    raise exception 'Action not found';
  end if;
  if not (v_row.submitted_by = auth.uid() or v_row.assigned_to = auth.uid() or is_admin()) then
    raise exception 'Not authorized to edit this Action';
  end if;
  if v_row.status <> 'open' then
    raise exception 'This Action is closed — reopen it before editing';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Give it a short title';
  end if;

  if v_row.title is distinct from p_title then v_changed := v_changed || 'title'; end if;
  if v_row.notes is distinct from p_notes then v_changed := v_changed || 'notes'; end if;
  if array_length(v_changed, 1) is null then
    return;  -- nothing actually changed; don't write a log entry
  end if;

  update action_items set title = p_title, notes = p_notes where id = p_action_id;

  select full_name into v_actor_name from profiles where id = auth.uid();
  insert into action_item_updates (action_id, author_id, author_name, kind, note)
  values (p_action_id, auth.uid(), v_actor_name, 'note',
          'Edited the ' || array_to_string(v_changed, ' and '));
end;
$$;

create function public.edit_maintenance_request(p_request_id uuid, p_title text, p_description text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row maintenance_requests;
  v_actor_name text;
  v_changed text[] := '{}';
begin
  select * into v_row from maintenance_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if not (v_row.submitted_by = auth.uid() or v_row.assigned_to = auth.uid() or is_admin()) then
    raise exception 'Not authorized to edit this request';
  end if;
  if v_row.status <> 'open' then
    raise exception 'This request is closed — reopen it before editing';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Give the issue a short title';
  end if;

  if v_row.title is distinct from p_title then v_changed := v_changed || 'title'; end if;
  if v_row.description is distinct from p_description then v_changed := v_changed || 'description'; end if;
  if array_length(v_changed, 1) is null then
    return;
  end if;

  update maintenance_requests set title = p_title, description = p_description where id = p_request_id;

  select full_name into v_actor_name from profiles where id = auth.uid();
  insert into maintenance_updates (request_id, author_id, author_name, kind, note)
  values (p_request_id, auth.uid(), v_actor_name, 'note',
          'Edited the ' || array_to_string(v_changed, ' and '));
end;
$$;
