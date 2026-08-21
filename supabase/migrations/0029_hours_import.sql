-- Replaces hand-keying monthly hours with a CSV import from the time-clock
-- system (the same TimeEntries export already used for Books payroll).
--
-- Imports are reversible: monthly_hours rows carry the import that created
-- them and cascade away when it's deleted, so a set of figures can be pulled
-- back out if the numbers change before payroll is finalised. The existing
-- monthly_hours_recalc trigger fires on delete too, so holiday accrual
-- follows the reversal automatically.
--
-- Names that don't match a staff record don't block the import — they're
-- recorded here so the admin can create the person, or point the name at an
-- existing record. The time system is treated as the definitive spelling:
-- linking renames the staff record to match, so the mismatch never recurs.

create table hours_imports (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  filename text,
  period_start date,
  period_end date,
  entry_count int not null default 0,
  matched_count int not null default 0,
  -- Salaried staff appear in the time export (Liz clocks in like everyone
  -- else) but monthly_hours is hourly-only — it drives the 12.07% accrual,
  -- and a salaried person's allowance is fixed. Their hours are deliberately
  -- not posted; counted here so the import summary can say so rather than
  -- looking like they went missing.
  skipped_salaried int not null default 0,
  total_hours numeric not null default 0,
  imported_by uuid references profiles (id) on delete set null,
  imported_by_name text not null,
  created_at timestamptz not null default now()
);

alter table hours_imports enable row level security;

create policy "hours_imports_admin"
  on hours_imports for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Null for anything keyed in by hand, which is why a manual correction
-- survives an import being deleted.
alter table monthly_hours add column import_id uuid references hours_imports (id) on delete cascade;

-- One row per employee name in the file that had no staff record. Kept
-- after the import so the prompt to deal with them persists across page
-- loads, rather than being a message that vanishes on refresh.
create table hours_import_unmatched (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references hours_imports (id) on delete cascade,
  raw_name text not null,
  display_name text not null,
  hours numeric not null default 0,
  resolved_profile_id uuid references profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table hours_import_unmatched enable row level security;

create policy "hours_import_unmatched_admin"
  on hours_import_unmatched for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create index hours_import_unmatched_import_idx on hours_import_unmatched (import_id);
