-- Butterleigh Staff Portal — initial schema for the Holiday mini-app.
-- Run against the Supabase project's SQL editor (or via the Supabase CLI).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  employment_type text not null check (employment_type in ('salaried', 'hourly')),
  -- 0 = Sunday .. 6 = Saturday
  working_days int[] not null default '{1,2,3,4,5}',
  contracted_hours_per_week numeric,
  -- Salaried only. No formula — set per person by the admin (defaults to 28
  -- = 20 base + 8 bank-holiday compensation when a new salaried profile is
  -- created, see app-side default; not enforced in the schema).
  annual_allowance_days numeric,
  manager_id uuid references profiles (id),
  is_manager boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Auto-create a profile row whenever an admin invites a staff member via
-- supabase.auth.admin.inviteUserByEmail (the invite call passes the rest of
-- the profile fields in raw_user_meta_data; see app/lib/holiday/staff.ts).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, email, role, employment_type,
    working_days, contracted_hours_per_week, annual_allowance_days,
    manager_id, is_manager
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'staff'),
    coalesce(new.raw_user_meta_data ->> 'employment_type', 'hourly'),
    coalesce(
      (select array_agg(x::int) from jsonb_array_elements_text(new.raw_user_meta_data -> 'working_days') x),
      '{1,2,3,4,5}'
    ),
    nullif(new.raw_user_meta_data ->> 'contracted_hours_per_week', '')::numeric,
    nullif(new.raw_user_meta_data ->> 'annual_allowance_days', '')::numeric,
    nullif(new.raw_user_meta_data ->> 'manager_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'is_manager')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Single source of truth for "is this user an admin" / "is this user the
-- direct manager of this staff member", used by every policy below.
-- security definer avoids RLS recursion when policies query profiles.
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create function public.is_manager_of(p_staff_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = p_staff_id and manager_id = auth.uid()
  );
$$;

create policy "profiles_select_own_reports_or_admin"
  on profiles for select
  to authenticated
  using (id = auth.uid() or manager_id = auth.uid() or is_admin());

create policy "profiles_admin_write"
  on profiles for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- settings (single row)
-- ---------------------------------------------------------------------------

create table settings (
  id boolean primary key default true check (id),
  default_allowance_days numeric not null default 28,
  hourly_accrual_rate numeric not null default 0.1207
);

insert into settings (id) values (true);

alter table settings enable row level security;

create policy "settings_select_authenticated"
  on settings for select
  to authenticated
  using (true);

create policy "settings_admin_write"
  on settings for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- bank_holidays (reference/calendar display only)
-- ---------------------------------------------------------------------------

create table bank_holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null
);

alter table bank_holidays enable row level security;

create policy "bank_holidays_select_authenticated"
  on bank_holidays for select
  to authenticated
  using (true);

create policy "bank_holidays_admin_write"
  on bank_holidays for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- leave_balances — one row per staff member per calendar leave year
-- ---------------------------------------------------------------------------

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  leave_year int not null,
  brought_forward numeric not null default 0,
  base_allowance numeric not null default 0,
  lieu_days_earned numeric not null default 0,
  accrued_hours numeric not null default 0,
  used_days numeric not null default 0,
  used_hours numeric not null default 0,
  unique (staff_id, leave_year)
);

alter table leave_balances enable row level security;

create policy "leave_balances_select_own_reports_or_admin"
  on leave_balances for select
  to authenticated
  using (staff_id = auth.uid() or is_manager_of(staff_id) or is_admin());

create policy "leave_balances_admin_write"
  on leave_balances for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  amount numeric not null, -- days (salaried) or hours (hourly)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references profiles (id),
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (end_date >= start_date)
);

alter table leave_requests enable row level security;

create policy "leave_requests_select_own_reports_or_admin"
  on leave_requests for select
  to authenticated
  using (staff_id = auth.uid() or is_manager_of(staff_id) or is_admin());

create policy "leave_requests_insert_own"
  on leave_requests for insert
  to authenticated
  with check (staff_id = auth.uid());

-- Staff may only cancel their own request, and only while it's still
-- pending — anything already decided goes through the approver functions
-- below instead. All other transitions (approve/reject/admin-cancel) happen
-- through the security-definer functions further down, not raw updates.
create policy "leave_requests_cancel_own_pending"
  on leave_requests for update
  to authenticated
  using (staff_id = auth.uid() and status = 'pending')
  with check (staff_id = auth.uid() and status = 'cancelled');

-- ---------------------------------------------------------------------------
-- lieu_requests — salaried only; approval credits +1 day for that year
-- ---------------------------------------------------------------------------

create table lieu_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  work_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approver_id uuid references profiles (id),
  notes text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table lieu_requests enable row level security;

create policy "lieu_requests_select_own_reports_or_admin"
  on lieu_requests for select
  to authenticated
  using (staff_id = auth.uid() or is_manager_of(staff_id) or is_admin());

create policy "lieu_requests_insert_own"
  on lieu_requests for insert
  to authenticated
  with check (staff_id = auth.uid());

create policy "lieu_requests_cancel_own_pending"
  on lieu_requests for update
  to authenticated
  using (staff_id = auth.uid() and status = 'pending')
  with check (staff_id = auth.uid() and status = 'cancelled');

-- ---------------------------------------------------------------------------
-- monthly_hours — hourly staff only; drives accrual via trigger below
-- ---------------------------------------------------------------------------

create table monthly_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  hours_worked numeric not null,
  entered_by uuid not null references profiles (id),
  entered_at timestamptz not null default now(),
  unique (staff_id, year, month)
);

alter table monthly_hours enable row level security;

create policy "monthly_hours_select_own_or_admin"
  on monthly_hours for select
  to authenticated
  using (staff_id = auth.uid() or is_admin());

create policy "monthly_hours_admin_write"
  on monthly_hours for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Recompute accrued_hours for (staff, year) as the sum of that year's
-- monthly hours entries × the hourly accrual rate, whenever an entry is
-- inserted, edited, or removed. Auto-creates the leave_balances row on first
-- entry (brought_forward left at 0 — admin sets that separately once).
create function public.recalc_accrued_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := coalesce(new.staff_id, old.staff_id);
  v_year int := coalesce(new.year, old.year);
  v_rate numeric;
  v_total_hours numeric;
begin
  select hourly_accrual_rate into v_rate from settings limit 1;

  select coalesce(sum(hours_worked), 0) into v_total_hours
  from monthly_hours
  where staff_id = v_staff_id and year = v_year;

  insert into leave_balances (staff_id, leave_year, accrued_hours)
  values (v_staff_id, v_year, v_total_hours * v_rate)
  on conflict (staff_id, leave_year)
  do update set accrued_hours = v_total_hours * v_rate;

  return coalesce(new, old);
end;
$$;

create trigger monthly_hours_recalc
  after insert or update or delete on monthly_hours
  for each row execute function public.recalc_accrued_hours();

-- ---------------------------------------------------------------------------
-- Approval functions (security definer — the only way requests move out of
-- "pending", and the only way balances are debited/credited, so the balance
-- math can't be bypassed by a crafted client-side update).
-- ---------------------------------------------------------------------------

create function public.approve_leave_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request leave_requests;
  v_employment_type text;
  v_year int;
begin
  select * into v_request from leave_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if not (is_manager_of(v_request.staff_id) or is_admin()) then
    raise exception 'Not authorized to approve this request';
  end if;

  select employment_type into v_employment_type from profiles where id = v_request.staff_id;
  v_year := extract(year from v_request.start_date)::int;

  if v_employment_type = 'hourly' then
    update leave_balances set used_hours = used_hours + v_request.amount
    where staff_id = v_request.staff_id and leave_year = v_year;
  else
    update leave_balances set used_days = used_days + v_request.amount
    where staff_id = v_request.staff_id and leave_year = v_year;
  end if;

  if not found then
    raise exception 'No leave balance set up for this staff member for %; ask an admin to initialize it first', v_year;
  end if;

  update leave_requests
  set status = 'approved', approver_id = auth.uid(), decided_at = now()
  where id = p_request_id;
end;
$$;

create function public.reject_leave_request(p_request_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request leave_requests;
begin
  select * into v_request from leave_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if not (is_manager_of(v_request.staff_id) or is_admin()) then
    raise exception 'Not authorized to decide this request';
  end if;

  update leave_requests
  set status = 'rejected', approver_id = auth.uid(), decided_at = now(),
      notes = coalesce(p_notes, notes)
  where id = p_request_id;
end;
$$;

-- Admin-only: reverse an already-approved request (refunds the balance).
create function public.admin_cancel_leave_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request leave_requests;
  v_employment_type text;
  v_year int;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_request from leave_requests where id = p_request_id for update;
  if not found or v_request.status <> 'approved' then
    raise exception 'Request is not approved';
  end if;

  select employment_type into v_employment_type from profiles where id = v_request.staff_id;
  v_year := extract(year from v_request.start_date)::int;

  if v_employment_type = 'hourly' then
    update leave_balances set used_hours = used_hours - v_request.amount
    where staff_id = v_request.staff_id and leave_year = v_year;
  else
    update leave_balances set used_days = used_days - v_request.amount
    where staff_id = v_request.staff_id and leave_year = v_year;
  end if;

  update leave_requests set status = 'cancelled', decided_at = now() where id = p_request_id;
end;
$$;

create function public.approve_lieu_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request lieu_requests;
  v_year int;
begin
  select * into v_request from lieu_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if not (is_manager_of(v_request.staff_id) or is_admin()) then
    raise exception 'Not authorized to approve this request';
  end if;

  v_year := extract(year from v_request.work_date)::int;

  update leave_balances set lieu_days_earned = lieu_days_earned + 1
  where staff_id = v_request.staff_id and leave_year = v_year;

  if not found then
    raise exception 'No leave balance set up for this staff member for %; ask an admin to initialize it first', v_year;
  end if;

  update lieu_requests
  set status = 'approved', approver_id = auth.uid(), decided_at = now()
  where id = p_request_id;
end;
$$;

create function public.reject_lieu_request(p_request_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request lieu_requests;
begin
  select * into v_request from lieu_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if not (is_manager_of(v_request.staff_id) or is_admin()) then
    raise exception 'Not authorized to decide this request';
  end if;

  update lieu_requests
  set status = 'rejected', approver_id = auth.uid(), decided_at = now(),
      notes = coalesce(p_notes, notes)
  where id = p_request_id;
end;
$$;

create function public.admin_cancel_lieu_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request lieu_requests;
  v_year int;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_request from lieu_requests where id = p_request_id for update;
  if not found or v_request.status <> 'approved' then
    raise exception 'Request is not approved';
  end if;

  v_year := extract(year from v_request.work_date)::int;

  update leave_balances set lieu_days_earned = lieu_days_earned - 1
  where staff_id = v_request.staff_id and leave_year = v_year;

  update lieu_requests set status = 'cancelled', decided_at = now() where id = p_request_id;
end;
$$;
