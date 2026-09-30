-- Who a maintenance request can be reassigned to still followed the rule
-- from before per-app access (0038): "an admin or is_manager". Since 0038,
-- is_manager only means "approves holiday", and the reassign picker lists
-- everyone with Manage on Maintenance — so choosing someone with Manage who
-- isn't a holiday approver was refused with "Chosen assignee is not
-- eligible". Eligibility now matches the picker: an active admin, or an
-- active person with Manage on Maintenance. Who may reassign is unchanged.

create or replace function public.reassign_maintenance_request(p_request_id uuid, p_new_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request maintenance_requests;
  v_new_assignee_name text;
  v_actor_name text;
begin
  select * into v_request from maintenance_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;

  if not (v_request.assigned_to = auth.uid() or is_admin()) then
    raise exception 'Not authorized to reassign this request';
  end if;

  select p.full_name into v_new_assignee_name
  from profiles p
  where p.id = p_new_assignee_id
    and p.active
    and (
      p.role = 'admin'
      or exists (
        select 1 from app_access a
        where a.staff_id = p.id and a.app = 'maintenance' and a.level = 'manage'
      )
    );
  if not found then
    raise exception 'Chosen assignee is not eligible';
  end if;

  select full_name into v_actor_name from profiles where id = auth.uid();

  update maintenance_requests
  set assigned_to = p_new_assignee_id, assigned_to_name = v_new_assignee_name
  where id = p_request_id;

  insert into maintenance_updates (request_id, author_id, author_name, kind, note)
  values (
    p_request_id,
    auth.uid(),
    v_actor_name,
    'reassigned',
    'Reassigned from ' || v_request.assigned_to_name || ' to ' || v_new_assignee_name
  );
end;
$$;
