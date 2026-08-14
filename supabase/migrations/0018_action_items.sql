-- Actions mini-app: mirrors Maintenance's shape (title, notes, photo,
-- assign, update log, reassign, close) but private — visible only to the
-- submitter and assignee, plus admins who see everything. Not a shared log
-- like Maintenance's/SOPs' — a manager who isn't party to it doesn't see it.

-- Generic "is this user a manager or admin" predicate — who can raise an
-- Action and who's eligible to own one. The fourth near-identical copy of
-- this check across the codebase (can_manage_sops(), can_manage_events()),
-- so this one gets a properly reusable name instead of another app-specific
-- one.
create function public.is_manager_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' or is_manager from profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- action_items
-- ---------------------------------------------------------------------------

create table action_items (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles (id) on delete set null,
  submitted_by_name text not null,
  assigned_to uuid references profiles (id) on delete set null,
  assigned_to_name text not null,
  title text not null,
  notes text,
  photo_url text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

alter table action_items enable row level security;

-- Private: only the submitter, the assignee, and admins (not managers in
-- general) can see a given Action.
create policy "action_items_select"
  on action_items for select
  to authenticated
  using (submitted_by = auth.uid() or assigned_to = auth.uid() or is_admin());

-- Only managers/admins can raise one, and only as themselves.
create policy "action_items_insert"
  on action_items for insert
  to authenticated
  with check (submitted_by = auth.uid() and is_manager_or_admin());

-- USING governs who may act on the CURRENT row (must be its assignee, or
-- admin — not the submitter, unless they're also the assignee/admin).
-- WITH CHECK only re-confirms they're still part of the eligible
-- population on the NEW row, not that they remain the assignee, since
-- reassigning yourself away is exactly one of the allowed operations —
-- this doesn't affect who can *see* the row afterward, that's still
-- governed purely by the select policy above.
create policy "action_items_update"
  on action_items for update
  to authenticated
  using (assigned_to = auth.uid() or is_admin())
  with check (is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- action_item_updates — the private log
-- ---------------------------------------------------------------------------

create table action_item_updates (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references action_items (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  author_name text not null,
  kind text not null default 'note' check (kind in ('note', 'reassigned', 'status_changed')),
  note text not null,
  created_at timestamptz not null default now()
);

alter table action_item_updates enable row level security;

create policy "action_item_updates_select"
  on action_item_updates for select
  to authenticated
  using (
    exists (
      select 1 from action_items a
      where a.id = action_item_updates.action_id
        and (a.submitted_by = auth.uid() or a.assigned_to = auth.uid() or is_admin())
    )
  );

create policy "action_item_updates_insert"
  on action_item_updates for insert
  to authenticated
  with check (
    exists (
      select 1 from action_items a
      where a.id = action_item_updates.action_id
        and (a.assigned_to = auth.uid() or is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Photo storage — public bucket, random (unguessable) paths. 15MB cap
-- matches the ceiling established in 0017_increase_photo_limits.sql for
-- the other three photo buckets.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'action-photos',
  'action-photos',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "action_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'action-photos' and is_manager_or_admin());
