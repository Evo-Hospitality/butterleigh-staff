-- The document store started as "somewhere to put the HMRC checklist". It's
-- actually the staff file: contracts, warning letters, right-to-work checks,
-- appraisals. Two things follow from that.
--
-- First, documents need a type, and the list can't be fixed in code — HR
-- paperwork accumulates categories nobody predicted. Same admin-managed
-- list-with-inline-add as stocktake units.
--
-- Second, and the important one: a warning letter is not the same kind of
-- thing as a payslip. Some documents are meant for the employee, some are
-- internal. So each is filed with an explicit decision about whether they
-- can see it, defaulting to NO for anything an admin uploads.

create table employee_document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table employee_document_types enable row level security;

-- Readable by anyone signed in: it's just a list of category names, and the
-- new starter's own form needs it. Admin-only to change.
create policy "employee_document_types_select"
  on employee_document_types for select
  to authenticated
  using (true);

create policy "employee_document_types_admin_write"
  on employee_document_types for all
  to authenticated
  using (is_admin())
  with check (is_admin());

insert into employee_document_types (name, sort_order) values
  ('HMRC Starter Checklist', 10),
  ('Employment contract', 20),
  ('Offer letter', 30),
  ('Right to work', 40),
  ('Warning letter', 50),
  ('Disciplinary note', 60),
  ('Appraisal', 70),
  ('Training certificate', 80),
  ('Other', 999);

alter table employee_documents
  add column document_type text not null default 'HMRC Starter Checklist',
  -- Whether the employee can see this on their own My details page.
  add column visible_to_staff boolean not null default false;

-- Everything already in there was uploaded by the starter themselves as part
-- of their own form, so of course they can still see it.
update employee_documents set visible_to_staff = true;

create index employee_documents_type_idx on employee_documents (staff_id, document_type);

-- ---------------------------------------------------------------------------
-- Reworked policies. The old ones predate the idea of an internal document.
-- ---------------------------------------------------------------------------
drop policy "employee_documents_select_own_or_admin" on employee_documents;
drop policy "employee_documents_delete_own_or_admin" on employee_documents;

create policy "employee_documents_select_shared_or_admin"
  on employee_documents for select
  to authenticated
  using (is_admin() or (staff_id = auth.uid() and visible_to_staff));

-- Deleting was previously open to the employee for anything on their record,
-- which with internal documents in the same table would have let someone
-- quietly destroy their own warning letter. Now they can only remove
-- something they uploaded themselves, and only while still filling the
-- starter form in. Everything else is the admin's.
create policy "employee_documents_delete_own_draft_or_admin"
  on employee_documents for delete
  to authenticated
  using (
    is_admin()
    or (
      staff_id = auth.uid()
      and uploaded_by = auth.uid()
      and exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.onboarding_status in ('pending', 'submitted')
      )
    )
  );

-- Admins can change their mind about whether something is shared. Employees
-- deliberately get no update policy, so nobody can flip visible_to_staff on
-- their own record to reveal something filed as internal.
create policy "employee_documents_admin_update"
  on employee_documents for update
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- The storage side of the same problem, which the table policy alone doesn't
-- close: employee-documents lets someone read anything under a folder named
-- for their own id. An internal warning letter filed at <their-id>/x.pdf
-- would be hidden from the table but still listable and readable straight
-- from storage.
--
-- So admin-filed documents live under admin/<staff-id>/ instead, which no
-- employee can reach. Where one of those IS shared with them, the app mints
-- a signed URL server-side after checking visible_to_staff — it never relies
-- on the employee's own storage permissions.
-- ---------------------------------------------------------------------------
drop policy "employee_documents_select_own_or_admin" on storage.objects;

create policy "employee_documents_storage_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and (
      is_admin()
      -- Their own folder only. "admin" is not a uuid, so this can never
      -- match the admin-filed prefix.
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
