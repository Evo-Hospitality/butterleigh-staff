-- Managers get the same implicit Maintenance access as admins: issues raised
-- by admins are often really something for a manager to sort out, so they
-- need to be assignable and able to act on requests without an explicit
-- per-person opt-in.

create or replace function public.can_access_maintenance()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select has_maintenance_access or role = 'admin' or is_manager from profiles where id = auth.uid()),
    false
  );
$$;
