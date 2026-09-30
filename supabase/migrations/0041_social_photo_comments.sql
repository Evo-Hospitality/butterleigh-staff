-- Comments on Photos for socials submissions — feedback on a post ("love
-- this, can you get one from the other side?") and the submitter's reply.
-- Open visibility, same as the posts themselves.

create table social_photo_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_photo_posts (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  author_name text not null,
  body text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  submission_token uuid,
  created_at timestamptz not null default now()
);

alter table social_photo_comments enable row level security;

create index social_photo_comments_post_idx on social_photo_comments (post_id, created_at);

create unique index social_photo_comments_submission_token_key
  on social_photo_comments (submission_token) where submission_token is not null;

create policy "social_photo_comments_select"
  on social_photo_comments for select
  to authenticated
  using (true);

create policy "social_photo_comments_insert"
  on social_photo_comments for insert
  to authenticated
  with check (author_id = auth.uid());

-- Your own comment, or any comment if you're an admin. No editing — delete
-- and re-post, which keeps the thread honest.
create policy "social_photo_comments_delete"
  on social_photo_comments for delete
  to authenticated
  using (author_id = auth.uid() or is_admin());
