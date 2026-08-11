-- SOPs / FAQ mini-app: questions raised by anyone, answered by admins/managers
-- (a shared queue, not routed to one person) as an ordered sequence of
-- text/photo/link blocks, plus a direct-author path with no question at all.

-- Same admin-fallback pattern as can_access_maintenance(), reused for both
-- RLS and app-side "who can answer / author" checks.
create function public.can_manage_sops()
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
-- sop_entries
-- ---------------------------------------------------------------------------

create table sop_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  asked_by uuid references profiles (id) on delete set null,
  asked_by_name text,
  status text not null default 'unanswered' check (status in ('unanswered', 'answered')),
  answered_by uuid references profiles (id) on delete set null,
  answered_by_name text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table sop_entries enable row level security;

-- Answered entries are the public FAQ — visible to everyone. Unanswered
-- questions are only visible to their asker and to admins/managers (the
-- queue isn't broadcast the way Maintenance's shared log is).
create policy "sop_entries_select"
  on sop_entries for select
  to authenticated
  using (status = 'answered' or asked_by = auth.uid() or can_manage_sops());

-- Covers both creation paths in one policy: anyone can post their own
-- unanswered question; admins/managers can insert anything, including an
-- already-answered entry with no asker (the "author directly" path).
create policy "sop_entries_insert"
  on sop_entries for insert
  to authenticated
  with check (
    (status = 'unanswered' and asked_by = auth.uid())
    or can_manage_sops()
  );

-- Answering an existing question (unanswered -> answered + blocks).
create policy "sop_entries_update"
  on sop_entries for update
  to authenticated
  using (can_manage_sops())
  with check (can_manage_sops());

-- ---------------------------------------------------------------------------
-- sop_blocks — the ordered text/photo/link sequence making up an answer
-- ---------------------------------------------------------------------------

create table sop_blocks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references sop_entries (id) on delete cascade,
  kind text not null check (kind in ('text', 'photo', 'link')),
  sort_order int not null,
  body text,
  url text,
  caption text,
  created_at timestamptz not null default now(),
  constraint sop_blocks_fields_match_kind check (
    (kind = 'text' and body is not null and url is null)
    or (kind in ('photo', 'link') and url is not null)
  )
);

alter table sop_blocks enable row level security;

create policy "sop_blocks_select"
  on sop_blocks for select
  to authenticated
  using (
    exists (
      select 1 from sop_entries e
      where e.id = sop_blocks.entry_id
        and (e.status = 'answered' or e.asked_by = auth.uid() or can_manage_sops())
    )
  );

-- Only admins/managers ever write blocks — both creation paths (answering,
-- authoring directly) are admin/manager-only.
create policy "sop_blocks_insert"
  on sop_blocks for insert
  to authenticated
  with check (can_manage_sops());

-- ---------------------------------------------------------------------------
-- Photo storage — public bucket, random (unguessable) paths, uploaded
-- directly from the browser by the block editor (see lib/sops/blocks.ts)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-photos',
  'sop-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "sop_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'sop-photos' and can_manage_sops());
