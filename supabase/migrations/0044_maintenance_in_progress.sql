-- Maintenance gains an "In progress" status between open and closed, so the
-- list shows at a glance what's being worked on versus not yet started.
-- In progress counts as still open everywhere: it stays in the open list,
-- can still be edited and reassigned, and closing works the same.

alter table maintenance_requests drop constraint if exists maintenance_requests_status_check;
alter table maintenance_requests
  add constraint maintenance_requests_status_check check (status in ('open', 'in_progress', 'closed'));

-- Editing was only allowed while status = 'open'; now anything not closed.
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
  if v_row.status = 'closed' then
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
