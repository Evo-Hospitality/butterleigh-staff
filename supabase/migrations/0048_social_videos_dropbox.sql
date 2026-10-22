-- Videos for Photos for socials, stored in Dropbox rather than here.
--
-- Phone videos are far bigger than Supabase's free-plan storage allows, so
-- the phone uploads a video straight to a Dropbox app folder (via a one-off
-- upload link the server asks Dropbox for) and only a small thumbnail is kept
-- in the social-photos bucket. social_photos gains a kind and, for videos,
-- the file's Dropbox path; url stays the thumbnail so everything that shows
-- or counts photos (feed, Mark used, the £1 payroll report) works unchanged —
-- a used video counts exactly like a used photo.

alter table social_photos
  add column kind text not null default 'photo' check (kind in ('photo', 'video')),
  add column dropbox_path text,
  add column file_name text,
  add column size_bytes bigint;

-- The Dropbox connection made from Admin → Social photos. Holds a long-lived
-- refresh token, so it is readable only with the service-role key: RLS on and
-- deliberately no policies, so no signed-in user can select it.
create table dropbox_connection (
  id boolean primary key default true check (id),
  refresh_token text not null,
  account_name text,
  connected_by uuid references profiles (id) on delete set null,
  connected_by_name text,
  connected_at timestamptz not null default now()
);

alter table dropbox_connection enable row level security;
