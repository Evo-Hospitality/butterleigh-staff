-- The HMRC Starter Checklist isn't reliably one file. People print it, fill
-- it in by hand and photograph each page, so a single hmrc_checklist_path
-- can't hold what actually arrives. And an admin filling in an existing
-- member of staff's record needs to attach their paperwork on their behalf,
-- which the "you may only write into your own folder" storage policy blocked.

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  -- Path within the private employee-documents bucket, not a URL.
  path text not null,
  file_name text not null,
  uploaded_by uuid references profiles (id) on delete set null,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create index employee_documents_staff_idx on employee_documents (staff_id, created_at);

alter table employee_documents enable row level security;

-- Same audience as employee_details: the employee and admins, never managers.
create policy "employee_documents_select_own_or_admin"
  on employee_documents for select
  to authenticated
  using (staff_id = auth.uid() or is_admin());

create policy "employee_documents_insert_own_or_admin"
  on employee_documents for insert
  to authenticated
  with check (staff_id = auth.uid() or is_admin());

create policy "employee_documents_delete_own_or_admin"
  on employee_documents for delete
  to authenticated
  using (staff_id = auth.uid() or is_admin());

-- Carry across anything already uploaded under the old single-file column.
insert into employee_documents (staff_id, path, file_name, created_at)
select staff_id, hmrc_checklist_path, 'HMRC Starter Checklist', coalesce(submitted_at, now())
from employee_details
where hmrc_checklist_path is not null;

alter table employee_details drop column hmrc_checklist_path;

-- An admin attaching paperwork for someone else writes into that person's
-- folder, which the original own-folder-only policy refused.
create policy "employee_documents_storage_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'employee-documents' and is_admin());

-- Removing a document row should take the file with it.
create policy "employee_documents_storage_delete_own_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'employee-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
