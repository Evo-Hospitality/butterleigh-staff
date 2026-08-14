-- Photos for Socials mini-app: any staff member can submit photos from their
-- phone for use on the company's social media accounts. A designated
-- reviewer (settings.social_photos_reviewer_id, admin-configurable — not
-- hardcoded, since the specific person can change) marks individual PHOTOS
-- (not whole posts) as used, which drives a £1-per-picture payroll bonus for
-- hourly staff. Fully open visibility, like Events/Tasks/SOPs — these photos
-- are headed for public social media anyway.

-- ---------------------------------------------------------------------------
-- social_photo_posts
-- ---------------------------------------------------------------------------

create table social_photo_posts (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles (id) on delete set null,
  submitted_by_name text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table social_photo_posts enable row level security;

create policy "social_photo_posts_select"
  on social_photo_posts for select
  to authenticated
  using (true);

create policy "social_photo_posts_insert"
  on social_photo_posts for insert
  to authenticated
  with check (submitted_by = auth.uid());

-- ---------------------------------------------------------------------------
-- social_photos — submitted_by/submitted_by_name denormalized here too (not
-- just on the post) since the payroll report groups directly on this table
-- by submitter and used-month; used_for_socials/used_at/used_by are only
-- ever written by set_photo_used() below, never by a client-side update.
-- ---------------------------------------------------------------------------

create table social_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_photo_posts (id) on delete cascade,
  submitted_by uuid references profiles (id) on delete set null,
  submitted_by_name text not null,
  url text not null,
  sort_order int not null default 0,
  used_for_socials boolean not null default false,
  used_at timestamptz,
  used_by uuid references profiles (id) on delete set null,
  used_by_name text,
  created_at timestamptz not null default now()
);

alter table social_photos enable row level security;

create policy "social_photos_select"
  on social_photos for select
  to authenticated
  using (true);

create policy "social_photos_insert"
  on social_photos for insert
  to authenticated
  with check (submitted_by = auth.uid());

-- No update policy for regular users — marking used/unused only ever
-- happens through set_photo_used() below. This is real payroll money, so it
-- goes through a security-definer RPC rather than a raw RLS update, same
-- reasoning as reassign_action_item()/complete_task(): keeps the
-- authorization check and the multi-column write (status + timestamp + who)
-- atomic and centrally auditable.

-- ---------------------------------------------------------------------------
-- settings — who the designated reviewer is (defaults to nobody; admin sets
-- it via /admin/social-photos-settings). Covered by the existing
-- settings_admin_write "for all" policy, no new policy needed.
-- ---------------------------------------------------------------------------

alter table settings add column social_photos_reviewer_id uuid references profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- set_photo_used — the only way used_for_socials/used_at/used_by change.
-- Callable by the designated reviewer or an admin (same admin-fallback
-- pattern used everywhere else). Toggle rather than one-way, so a misclick
-- can be undone.
-- ---------------------------------------------------------------------------

create function public.set_photo_used(p_photo_id uuid, p_used boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer_id uuid;
  v_caller_name text;
begin
  select social_photos_reviewer_id into v_reviewer_id from settings where id = true;

  if not (is_admin() or auth.uid() = v_reviewer_id) then
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

  if not found then
    raise exception 'Photo not found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photo storage — public bucket, random (unguessable) paths, 15MB cap
-- matching every other photo bucket. The image-only allowed_mime_types list
-- is what actually blocks video uploads — Storage rejects anything else
-- regardless of what the client sends.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-photos',
  'social-photos',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "social_photos_bucket_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'social-photos');
