-- Several related fixes to the approval flow:
-- 1. Neither hourly nor salaried staff can be approved into a negative
--    balance anymore — refused outright with a clear message, rather than
--    silently going negative (or, for hourly, raising a raw Postgres error
--    that surfaced to users as a generic server-error page).
-- 2. Adds an "unpaid leave" option: a leave request marked unpaid never
--    touches the holiday balance at all (no cap check, no debit) — it's a
--    distinct payroll category (deduct pay for those days) rather than
--    holiday, so it's tracked separately for the payroll report instead.

alter table leave_requests add column is_unpaid boolean not null default false;

create or replace function public.approve_leave_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request leave_requests;
  v_employment_type text;
  v_year int;
  v_balance leave_balances;
  v_remaining numeric;
begin
  select * into v_request from leave_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if not (is_manager_of(v_request.staff_id) or is_admin()) then
    raise exception 'Not authorized to approve this request';
  end if;

  -- Unpaid leave is a distinct payroll category, not a draw against the
  -- holiday balance — approve it outright with no balance involvement.
  if v_request.is_unpaid then
    update leave_requests
    set status = 'approved', approver_id = auth.uid(), decided_at = now()
    where id = p_request_id;
    return;
  end if;

  select employment_type into v_employment_type from profiles where id = v_request.staff_id;
  v_year := extract(year from v_request.start_date)::int;

  select * into v_balance from leave_balances
  where staff_id = v_request.staff_id and leave_year = v_year
  for update;

  if not found then
    raise exception 'No leave balance set up for this staff member for %; ask an admin to initialize it first', v_year;
  end if;

  if v_employment_type = 'hourly' then
    v_remaining := v_balance.brought_forward + v_balance.accrued_hours - v_balance.used_hours;
    if v_remaining < v_request.amount then
      raise exception 'Only % hours remaining, but this request is for % hours', v_remaining, v_request.amount;
    end if;
    update leave_balances set used_hours = used_hours + v_request.amount where id = v_balance.id;
  else
    v_remaining := v_balance.brought_forward + v_balance.base_allowance + v_balance.lieu_days_earned - v_balance.used_days;
    if v_remaining < v_request.amount then
      raise exception 'Only % days remaining, but this request is for % days — mark it as unpaid leave if that''s intended', v_remaining, v_request.amount;
    end if;
    update leave_balances set used_days = used_days + v_request.amount where id = v_balance.id;
  end if;

  update leave_requests
  set status = 'approved', approver_id = auth.uid(), decided_at = now()
  where id = p_request_id;
end;
$$;
