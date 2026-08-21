-- Fixes "malformed array literal" from 0027's edit functions.
--
-- `v_changed := v_changed || 'title'` looks like appending a string to a
-- text[], but with an untyped literal on the right Postgres resolves the
-- anyarray || anyarray form and tries to parse 'title' AS an array literal,
-- which fails at runtime. array_append() has no such ambiguity.
--
-- Only the two array_append lines differ in each function; everything else
-- is byte-for-byte 0027.

create or replace function public.edit_action_item(p_action_id uuid, p_title text, p_notes text)
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

  if v_row.title is distinct from p_title then v_changed := array_append(v_changed, 'title'); end if;
  if v_row.notes is distinct from p_notes then v_changed := array_append(v_changed, 'notes'); end if;
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

create or replace function public.edit_maintenance_request(p_request_id uuid, p_title text, p_description text)
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

  if v_row.title is distinct from p_title then v_changed := array_append(v_changed, 'title'); end if;
  if v_row.description is distinct from p_description then v_changed := array_append(v_changed, 'description'); end if;
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
