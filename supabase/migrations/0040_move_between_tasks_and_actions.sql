-- Move a record between Tasks and Actions when it's been filed in the wrong
-- one. The distinction is a judgement call — work done at the pub on shift
-- versus manager work off site — so getting it wrong is normal, and re-keying
-- it by hand loses whoever raised it and when.
--
-- The two tables don't hold the same things. Rather than silently dropping
-- what doesn't fit, anything without a home on the other side is written into
-- the destination's text: a Task's due date and recurrence, an Action's
-- photo. The same goes for their history — the structured log can't move, so
-- it's carried across as text and the original row is then deleted, leaving
-- no duplicate to confuse anyone.
--
-- Security definer because the move deletes the source, and deleting a task
-- is admin-only (0039) while moving between the two is a manager's job. The
-- function does its own check instead: you need access to BOTH apps.

create function public.move_task_to_action(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
  v_notes text;
  v_history text;
  v_new_id uuid;
begin
  if not (has_app_access('tasks', 'use') and has_app_access('actions', 'use')) then
    raise exception 'You need access to both Tasks and Actions to move something between them';
  end if;

  select * into v_task from tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'That task no longer exists';
  end if;

  v_notes := coalesce(v_task.description, '');

  -- An Action has no due date and doesn't repeat, so say so in words.
  if v_task.due_date is not null then
    v_notes := v_notes || E'\n\nWas due ' || to_char(v_task.due_date, 'DD/MM/YYYY')
      || coalesce(' at ' || to_char(v_task.due_time, 'HH24:MI'), '') || ' as a Task.';
  end if;
  if v_task.recurrence_unit is not null and v_task.recurrence_value is not null then
    v_notes := v_notes || E'\nRepeated every ' || v_task.recurrence_value || ' '
      || v_task.recurrence_unit || ' as a Task. Actions don''t repeat.';
  end if;

  select string_agg(
    format('%s — %s %s%s',
      to_char(reviewed_at, 'DD/MM/YYYY HH24:MI'),
      reviewed_by_name,
      case when outcome = 'done' then 'confirmed done' else 'sent it back' end,
      coalesce(': ' || note, '')
    ), E'\n' order by reviewed_at)
  into v_history
  from task_reviews where task_id = p_task_id;

  if v_history is not null then
    v_notes := v_notes || E'\n\nHistory carried over from Tasks:\n' || v_history;
  end if;

  insert into action_items (
    submitted_by, submitted_by_name, assigned_to, assigned_to_name,
    title, notes, status, closed_at
  ) values (
    v_task.created_by, v_task.created_by_name, v_task.assigned_to, v_task.assigned_to_name,
    v_task.title, nullif(btrim(v_notes), ''),
    case when v_task.status = 'done' then 'closed' else 'open' end,
    case when v_task.status = 'done' then now() else null end
  )
  returning id into v_new_id;

  delete from tasks where id = p_task_id;
  return v_new_id;
end;
$$;

grant execute on function public.move_task_to_action(uuid) to authenticated;

create function public.move_action_to_task(p_action_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action action_items;
  v_description text;
  v_history text;
  v_new_id uuid;
begin
  if not (has_app_access('tasks', 'use') and has_app_access('actions', 'use')) then
    raise exception 'You need access to both Tasks and Actions to move something between them';
  end if;

  select * into v_action from action_items where id = p_action_id;
  if v_action.id is null then
    raise exception 'That action no longer exists';
  end if;

  v_description := coalesce(v_action.notes, '');

  -- Tasks carry no photo, so keep the link rather than losing the picture.
  if v_action.photo_url is not null then
    v_description := v_description || E'\n\nPhoto from the Action: ' || v_action.photo_url;
  end if;

  select string_agg(
    format('%s — %s: %s', to_char(created_at, 'DD/MM/YYYY HH24:MI'), author_name, note),
    E'\n' order by created_at)
  into v_history
  from action_item_updates where action_id = p_action_id;

  if v_history is not null then
    v_description := v_description || E'\n\nHistory carried over from Actions:\n' || v_history;
  end if;

  insert into tasks (
    title, description, created_by, created_by_name, assigned_to, assigned_to_name,
    status, completed_at, reviewed_at
  ) values (
    v_action.title, nullif(btrim(v_description), ''),
    v_action.submitted_by, v_action.submitted_by_name,
    v_action.assigned_to, v_action.assigned_to_name,
    case when v_action.status = 'closed' then 'done' else 'pending' end,
    case when v_action.status = 'closed' then coalesce(v_action.closed_at, now()) else null end,
    case when v_action.status = 'closed' then coalesce(v_action.closed_at, now()) else null end
  )
  returning id into v_new_id;

  delete from action_items where id = p_action_id;
  return v_new_id;
end;
$$;

grant execute on function public.move_action_to_task(uuid) to authenticated;
