-- Events suggestions mini-app: anyone can suggest an event idea with photos,
-- admins/managers review it as a fully-open shared idea board (unlike SOPs'
-- unanswered-question privacy, nothing here is hidden by status).

create function public.can_manage_events()
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
-- event_suggestions
-- ---------------------------------------------------------------------------

create table event_suggestions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  submitted_by uuid references profiles (id) on delete set null,
  submitted_by_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references profiles (id) on delete set null,
  decided_by_name text,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table event_suggestions enable row level security;

-- Fully open — a shared idea board, not a support queue. Everyone sees
-- everything regardless of status.
create policy "event_suggestions_select"
  on event_suggestions for select
  to authenticated
  using (true);

-- Only creation path: submitting your own pending idea. No admin
-- "author directly / pre-approved" shortcut like SOPs has.
create policy "event_suggestions_insert"
  on event_suggestions for insert
  to authenticated
  with check (status = 'pending' and submitted_by = auth.uid());

-- Deciding (approve/decline).
create policy "event_suggestions_update"
  on event_suggestions for update
  to authenticated
  using (can_manage_events())
  with check (can_manage_events());

-- ---------------------------------------------------------------------------
-- event_suggestion_photos — flat list, not ordered blocks like SOPs
-- ---------------------------------------------------------------------------

create table event_suggestion_photos (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references event_suggestions (id) on delete cascade,
  url text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table event_suggestion_photos enable row level security;

create policy "event_suggestion_photos_select"
  on event_suggestion_photos for select
  to authenticated
  using (true);

-- You can only attach photos to a suggestion you yourself submitted — this
-- is the submitter uploading their own example photos, not admin-authored
-- content like SOPs' blocks.
create policy "event_suggestion_photos_insert"
  on event_suggestion_photos for insert
  to authenticated
  with check (
    exists (
      select 1 from event_suggestions s
      where s.id = event_suggestion_photos.suggestion_id
        and s.submitted_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Photo storage — public bucket, random (unguessable) paths. Open to any
-- authenticated staff member (unlike Maintenance/SOPs' photo buckets, which
-- gate on a feature-specific check) since submitting an idea is open to
-- everyone.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-photos',
  'event-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "event_photos_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-photos');
