-- One way of deciding who can open what, replacing five.
--
-- Access was being decided by: nothing at all (open to everyone), a bespoke
-- has_maintenance_access flag, is_manager, is_manager_or_admin, role = admin,
-- and a single named reviewer in settings. Adding an app meant inventing
-- another rule, and there was no way to say "this person can report a
-- maintenance fault but not close one off".
--
-- Now: a row per person per app, at one of three levels.
--   none   — the app isn't theirs; it doesn't appear
--   use    — open it and do the everyday thing
--   manage — plus the decisions inside it (approve, decline, delete, answer)
--
-- Admins bypass this entirely, so nobody can lock themselves out of the
-- system by editing a grid.
--
-- is_manager keeps only its real meaning — "approves holiday for their
-- reports" — and stops doubling as a back door into Actions and Overview.

create table app_access (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  app text not null check (app in (
    'overview', 'tasks', 'holiday', 'social_photos', 'events',
    'maintenance', 'sops', 'actions', 'stocktake'
  )),
  level text not null default 'none' check (level in ('none', 'use', 'manage')),
  updated_at timestamptz not null default now(),
  unique (staff_id, app)
);

create index app_access_staff_idx on app_access (staff_id);

alter table app_access enable row level security;

-- Everyone can read their own row — the nav needs it on every request.
create policy "app_access_select_own_or_admin"
  on app_access for select
  to authenticated
  using (staff_id = auth.uid() or is_admin());

create policy "app_access_admin_write"
  on app_access for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- The one question every gate asks.
-- ---------------------------------------------------------------------------
create function public.has_app_access(p_app text, p_min text default 'use')
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_level text;
begin
  if is_admin() then
    return true;
  end if;

  select level into v_level
  from app_access
  where staff_id = auth.uid() and app = p_app;

  if v_level is null or v_level = 'none' then
    return false;
  end if;

  if p_min = 'manage' then
    return v_level = 'manage';
  end if;

  return true;
end;
$$;

grant execute on function public.has_app_access(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed from exactly what each person can do today, so nobody's access
-- changes the moment this runs. Every difference from here on is a
-- deliberate edit in the grid.
-- ---------------------------------------------------------------------------
insert into app_access (staff_id, app, level)
select
  p.id,
  a.app,
  case a.app
    -- Anyone could already raise a task for anyone else, so everyone keeps
    -- that until it's deliberately dialled back.
    when 'tasks' then 'manage'
    -- Everyone requests holiday; approving is today's is_manager/admin.
    when 'holiday' then case when p.is_manager or p.role = 'admin' then 'manage' else 'use' end
    -- Anyone submits photos; only the named reviewer and admins mark them used.
    when 'social_photos' then case
      when p.role = 'admin' or p.id = (select social_photos_reviewer_id from settings limit 1)
      then 'manage' else 'use' end
    when 'events' then case when p.is_manager or p.role = 'admin' then 'manage' else 'use' end
    when 'sops' then case when p.is_manager or p.role = 'admin' then 'manage' else 'use' end
    -- The one app that already had a switch.
    when 'maintenance' then case
      when p.is_manager or p.role = 'admin' then 'manage'
      when p.has_maintenance_access then 'use'
      else 'none' end
    -- Manager/admin only today, both of them.
    when 'actions' then case when p.is_manager or p.role = 'admin' then 'manage' else 'none' end
    when 'overview' then case when p.is_manager or p.role = 'admin' then 'manage' else 'none' end
    -- Everyone counts stock; only admins delete a count.
    when 'stocktake' then case when p.role = 'admin' then 'manage' else 'use' end
  end
from profiles p
cross join (
  values ('overview'), ('tasks'), ('holiday'), ('social_photos'), ('events'),
         ('maintenance'), ('sops'), ('actions'), ('stocktake')
) as a(app)
on conflict (staff_id, app) do nothing;

-- A new starter gets the ordinary staff set automatically, so the grid is
-- for exceptions rather than a chore on every hire.
create function public.seed_default_app_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into app_access (staff_id, app, level) values
    (new.id, 'tasks', 'use'),
    (new.id, 'holiday', 'use'),
    (new.id, 'social_photos', 'use'),
    (new.id, 'events', 'use'),
    (new.id, 'sops', 'use'),
    (new.id, 'stocktake', 'use'),
    (new.id, 'maintenance', 'none'),
    (new.id, 'actions', 'none'),
    (new.id, 'overview', 'none')
  on conflict (staff_id, app) do nothing;
  return new;
end;
$$;

create trigger profiles_seed_app_access
  after insert on profiles
  for each row execute function seed_default_app_access();

-- ---------------------------------------------------------------------------
-- Point the existing helpers at the new table. Roughly thirty policies call
-- these by name; redefining the functions moves the whole app over without
-- touching a single policy.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_maintenance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_app_access('maintenance', 'use');
$$;

create or replace function public.can_manage_sops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_app_access('sops', 'manage');
$$;

create or replace function public.can_manage_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_app_access('events', 'manage');
$$;

-- is_manager_or_admin() is the exception: it guards two different apps, so
-- it can't be redefined to mean one of them. Its policies are recreated
-- against the app they actually belong to.
create policy "checkin_groups_select_v2"
  on checkin_groups for select to authenticated
  using (has_app_access('overview', 'use'));
drop policy "checkin_groups_select" on checkin_groups;

create policy "checkin_items_select_v2"
  on checkin_items for select to authenticated
  using (has_app_access('overview', 'use'));
drop policy "checkin_items_select" on checkin_items;

create policy "checkin_items_insert_v2"
  on checkin_items for insert to authenticated
  with check (has_app_access('overview', 'use') and created_by = auth.uid());
drop policy "checkin_items_insert" on checkin_items;

create policy "checkin_items_update_v2"
  on checkin_items for update to authenticated
  using (has_app_access('overview', 'use'))
  with check (has_app_access('overview', 'use'));
drop policy "checkin_items_update" on checkin_items;

create policy "checkin_items_delete_v2"
  on checkin_items for delete to authenticated
  using (has_app_access('overview', 'use'));
drop policy "checkin_items_delete" on checkin_items;

create policy "action_items_insert_v2"
  on action_items for insert to authenticated
  with check (submitted_by = auth.uid() and has_app_access('actions', 'use'));
drop policy "action_items_insert" on action_items;

create policy "action_items_update_v2"
  on action_items for update to authenticated
  using (assigned_to = auth.uid() or is_admin())
  with check (has_app_access('actions', 'use'));
drop policy "action_items_update" on action_items;

create policy "action_photos_insert_v2"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'action-photos' and has_app_access('actions', 'use'));
drop policy "action_photos_insert" on storage.objects;

-- ---------------------------------------------------------------------------
-- Marking a photo as used was tied to one named person in settings. That was
-- the sixth way of deciding access; it becomes Manage on Social photos like
-- everything else. The named reviewer is seeded to Manage above, so whoever
-- does it today keeps doing it.
-- ---------------------------------------------------------------------------
create or replace function public.set_photo_used(p_photo_id uuid, p_used boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_name text;
begin
  if not has_app_access('social_photos', 'manage') then
    raise exception 'Not authorized to mark this photo';
  end if;

  select full_name into v_caller_name from profiles where id = auth.uid();

  if p_used then
    update social_photos
    set used_for_socials = true, used_at = now(), used_by = auth.uid(), used_by_name = v_caller_name
    where id = p_photo_id;
  else
    update social_photos
    set used_for_socials = false, used_at = null, used_by = null, used_by_name = null
    where id = p_photo_id;
  end if;
end;
$$;

-- The old per-app flag, now that its value has been carried into the grid
-- above. Leaving it would give two places that appear to control the same
-- thing, only one of which does anything — which is the mess this migration
-- exists to clear up.
alter table profiles drop column has_maintenance_access;
