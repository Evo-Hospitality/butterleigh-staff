-- Maintenance mini-app: access flag, routing default, request/update tables,
-- and a public photo storage bucket.

alter table profiles add column has_maintenance_access boolean not null default false;
alter table settings add column default_maintenance_assignee_id uuid references profiles (id) on delete set null;

-- Single source of truth for "can this user see/use Maintenance" — admins
-- always have implicit access, matching the admin-fallback pattern used
-- throughout the rest of the app (is_admin() in other policies, etc.).
create function public.can_access_maintenance()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select has_maintenance_access or role = 'admin' from profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- maintenance_requests
-- ---------------------------------------------------------------------------

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles (id) on delete set null,
  submitted_by_name text not null,
  assigned_to uuid references profiles (id) on delete set null,
  assigned_to_name text not null,
  title text not null,
  description text,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table maintenance_requests enable row level security;

-- Deliberately visible to everyone with maintenance access, not scoped to
-- submitter/assignee — the whole point is a shared, visible log.
create policy "maintenance_requests_select"
  on maintenance_requests for select
  to authenticated
  using (can_access_maintenance());

create policy "maintenance_requests_insert"
  on maintenance_requests for insert
  to authenticated
  with check (can_access_maintenance() and submitted_by = auth.uid());

-- USING governs who may act on the CURRENT row (must be its assignee, or
-- admin); WITH CHECK only re-confirms they still have general maintenance
-- access on the NEW row — not that they remain the assignee, since
-- reassigning yourself away is exactly one of the allowed operations.
create policy "maintenance_requests_update"
  on maintenance_requests for update
  to authenticated
  using (assigned_to = auth.uid() or is_admin())
  with check (can_access_maintenance());

-- ---------------------------------------------------------------------------
-- maintenance_updates — the shared log
-- ---------------------------------------------------------------------------

create table maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references maintenance_requests (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  author_name text not null,
  kind text not null default 'note' check (kind in ('note', 'reassigned', 'status_changed')),
  note text not null,
  created_at timestamptz not null default now()
);

alter table maintenance_updates enable row level security;

create policy "maintenance_updates_select"
  on maintenance_updates for select
  to authenticated
  using (can_access_maintenance());

create policy "maintenance_updates_insert"
  on maintenance_updates for insert
  to authenticated
  with check (
    can_access_maintenance()
    and exists (
      select 1 from maintenance_requests r
      where r.id = maintenance_updates.request_id
        and (r.assigned_to = auth.uid() or is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Photo storage — public bucket, random (unguessable) paths
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'maintenance-photos',
  'maintenance-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "maintenance_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'maintenance-photos' and can_access_maintenance());
