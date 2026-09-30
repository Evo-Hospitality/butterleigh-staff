-- Actions gain an "In progress" status, as Maintenance did in 0044. In
-- progress counts as still open everywhere: it can be edited, reassigned and
-- closed as before, and moving an in-progress Action to Tasks makes an open
-- Task (0040 already maps anything not closed to 'pending').

alter table action_items drop constraint if exists action_items_status_check;
alter table action_items
  add constraint action_items_status_check check (status in ('open', 'in_progress', 'closed'));

-- Editing was only allowed while status = 'open'; now anything not closed.
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
  if v_row.status = 'closed' then
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
