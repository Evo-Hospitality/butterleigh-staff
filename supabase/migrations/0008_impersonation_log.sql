-- Audit trail for admin "log in as" impersonation. Names are snapshotted at
-- insert time so the log stays legible even if someone is later deleted
-- (admin_id/target_id degrade to null via the profile's own delete, not the
-- row itself — see the pattern already used for approver_id/manager_id in
-- 0003_delete_cascades.sql).
create table impersonation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles (id) on delete set null,
  admin_name text not null,
  target_id uuid references profiles (id) on delete set null,
  target_name text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table impersonation_log enable row level security;

create policy "impersonation_log_admin_only"
  on impersonation_log for all
  to authenticated
  using (is_admin())
  with check (is_admin());
