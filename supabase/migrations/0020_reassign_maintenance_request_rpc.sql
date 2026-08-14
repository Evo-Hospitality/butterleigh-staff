-- Same fix as 0019_reassign_action_item_rpc.sql, applied to Maintenance —
-- maintenance_requests_update has the identical shape (USING checks
-- assigned_to = auth.uid(), WITH CHECK is a broad eligibility function),
-- which was proven to fail unreliably for non-admin managers specifically
-- when assigned_to's value actually changes. Never caught before because
-- reassignment had only ever been tested end-to-end by an admin account.
--
-- Also fixes a second, related gap discovered alongside it: the app's
-- reassign flow looked up the new assignee's profile using the acting
-- user's own RLS-scoped session, which only sees yourself and your direct
-- reports — a non-admin manager reassigning to a peer outside their
-- reporting line would fail to even find them. This function runs with
-- elevated privileges, sidestepping that too.
create function public.reassign_maintenance_request(p_request_id uuid, p_new_assignee_id uuid)
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

  select full_name into v_new_assignee_name
  from profiles
  where id = p_new_assignee_id and (role = 'admin' or is_manager);
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
