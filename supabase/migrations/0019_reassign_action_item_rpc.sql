-- Reassigning an Action goes through this function instead of a direct
-- client-side UPDATE. Extensive testing showed a plain RLS UPDATE that
-- changes assigned_to (the same column action_items_update's USING clause
-- checks) fails unreliably for non-admin managers specifically, in a way
-- that couldn't be fully root-caused through black-box testing — this
-- sidesteps it entirely, using the same authorized-mutation-via-RPC
-- pattern already established for leave/lieu approval (0001_init.sql).
--
-- Also atomically logs the reassignment: the acting user, if not admin,
-- loses UPDATE rights on the row the instant it's reassigned away from
-- them, which would otherwise block a separate follow-up INSERT into
-- action_item_updates logging their own reassignment.
create function public.reassign_action_item(p_action_id uuid, p_new_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action action_items;
  v_new_assignee_name text;
  v_actor_name text;
begin
  select * into v_action from action_items where id = p_action_id for update;
  if not found then
    raise exception 'Action not found';
  end if;

  if not (v_action.assigned_to = auth.uid() or is_admin()) then
    raise exception 'Not authorized to reassign this Action';
  end if;

  select full_name into v_new_assignee_name
  from profiles
  where id = p_new_assignee_id and (role = 'admin' or is_manager);
  if not found then
    raise exception 'Chosen assignee is not eligible';
  end if;

  select full_name into v_actor_name from profiles where id = auth.uid();

  update action_items
  set assigned_to = p_new_assignee_id, assigned_to_name = v_new_assignee_name
  where id = p_action_id;

  insert into action_item_updates (action_id, author_id, author_name, kind, note)
  values (
    p_action_id,
    auth.uid(),
    v_actor_name,
    'reassigned',
    'Reassigned from ' || v_action.assigned_to_name || ' to ' || v_new_assignee_name
  );
end;
$$;
