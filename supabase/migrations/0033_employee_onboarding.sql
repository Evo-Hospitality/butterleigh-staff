-- New-starter onboarding: replaces the ClickUp "New Employee Form".
--
-- A new employee gets their login, is forced to set a password (existing
-- must_change_password flow), then can't reach any mini-app until they've
-- filled this in and an admin has approved it.
--
-- The data here is materially more sensitive than anything else in the app —
-- National Insurance number, date of birth, home address and bank details.
-- So, unlike every other table: managers get nothing. Visibility is the
-- employee themselves and admins, full stop. The HMRC checklist goes in a
-- PRIVATE storage bucket read through short-lived signed URLs, not the
-- public-bucket-with-unguessable-path pattern the photo features use — an
-- unguessable URL is fine for a picture of the garden, not for a document
-- carrying someone's NI number.

-- ---------------------------------------------------------------------------
-- Gate flag on profiles — cheap to check, since the profile is already loaded
-- on every request.
--   not_required : existing staff at go-live, and anyone an admin exempts
--   pending      : needs to complete the form (the default for new starters)
--   submitted    : waiting on an admin
--   approved     : full access
-- ---------------------------------------------------------------------------
alter table profiles
  add column onboarding_status text not null default 'pending'
  check (onboarding_status in ('not_required', 'pending', 'submitted', 'approved'));

-- Everyone who already exists predates this and must not be locked out.
-- Their details get migrated by hand.
update profiles set onboarding_status = 'not_required';

-- ---------------------------------------------------------------------------
-- employee_details — one row per person, created when they first submit.
-- ---------------------------------------------------------------------------
create table employee_details (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references profiles (id) on delete cascade,
  full_name text,
  start_date date,
  ni_number text,
  date_of_birth date,
  home_address text,
  mobile_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_email text,
  bank_name text,
  bank_sort_code text,
  bank_account_number text,
  -- Path within the private employee-documents bucket, not a URL.
  hmrc_checklist_path text,
  submitted_at timestamptz,
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  -- What needs fixing, when a submission is sent back.
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employee_details enable row level security;

create policy "employee_details_select_own_or_admin"
  on employee_details for select
  to authenticated
  using (staff_id = auth.uid() or is_admin());

create policy "employee_details_insert_own"
  on employee_details for insert
  to authenticated
  with check (staff_id = auth.uid() or is_admin());

create policy "employee_details_update_own_or_admin"
  on employee_details for update
  to authenticated
  using (staff_id = auth.uid() or is_admin())
  with check (staff_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- bank_change_requests — a change of bank details is the obvious fraud vector
-- (compromised mailbox, "please pay me here instead"), so it never applies
-- straight away. It queues for an admin, who rings the employee on the number
-- already on file before approving.
-- ---------------------------------------------------------------------------
create table bank_change_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  staff_name text not null,
  bank_name text not null,
  bank_sort_code text not null,
  bank_account_number text not null,
  -- Snapshotted so the reviewer can see exactly what's changing.
  previous_bank_name text,
  previous_bank_sort_code text,
  previous_bank_account_number text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text
);

alter table bank_change_requests enable row level security;

create policy "bank_change_requests_select_own_or_admin"
  on bank_change_requests for select
  to authenticated
  using (staff_id = auth.uid() or is_admin());

create policy "bank_change_requests_insert_own"
  on bank_change_requests for insert
  to authenticated
  with check (staff_id = auth.uid() and status = 'pending');

-- Only admins decide. Deliberately no self-update policy, so nobody can
-- approve their own change.
create policy "bank_change_requests_admin_update"
  on bank_change_requests for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create index bank_change_requests_status_idx on bank_change_requests (status);

-- ---------------------------------------------------------------------------
-- Private document storage. public = false, so there is no public URL at all
-- and reads must go through a signed URL minted server-side.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Uploads land under a folder named for the employee's own uid, which is what
-- the policy checks — so nobody can write into anyone else's folder.
create policy "employee_documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'employee-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "employee_documents_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

-- ---------------------------------------------------------------------------
-- The actual anti-fraud enforcement. The self-service "my details" screen
-- routes bank changes through bank_change_requests, but a policy that lets an
-- employee update their own row would otherwise let a compromised session
-- write straight to the bank columns and skip the phone call entirely.
--
-- So: once someone's details are settled (approved, or an existing member of
-- staff migrated in), only an admin may move the bank columns. Before that —
-- while they're still filling the form in or fixing a sent-back submission —
-- they set them freely, because nothing is on payroll yet.
-- ---------------------------------------------------------------------------
create or replace function guard_bank_detail_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if new.bank_name is not distinct from old.bank_name
     and new.bank_sort_code is not distinct from old.bank_sort_code
     and new.bank_account_number is not distinct from old.bank_account_number then
    return new;
  end if;

  -- auth.uid() is null for the service_role key, which is server-only and
  -- already behind an admin check in the application layer.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  select onboarding_status into v_status from profiles where id = new.staff_id;

  if v_status in ('pending', 'submitted') then
    return new;
  end if;

  raise exception 'Bank details can only be changed by an admin, after a phone check';
end;
$$;

create trigger employee_details_guard_bank
  before update on employee_details
  for each row execute function guard_bank_detail_changes();
