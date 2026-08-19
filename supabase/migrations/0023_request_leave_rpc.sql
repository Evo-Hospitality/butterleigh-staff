-- Pending holiday requests didn't reserve any balance — used_hours/used_days
-- is only debited at approval time (approve_leave_request(), see
-- 0006_hourly_balance_guard.sql), so nothing stopped someone from creating
-- more pending requests than they actually have (a double-click on submit
-- created 4 identical 80-hour requests for someone with ~82 hours
-- available). This RPC locks the staff member's balance row before
-- checking, so the balance check + insert are atomic — this is what
-- actually closes the race a double-click (or two genuine concurrent
-- submissions) exploits, not just reduces its odds. The "reservation" is
-- computed live (balance minus used minus sum of other pending requests),
-- not stored — a rejected/cancelled request just drops out of that sum on
-- the next computation, no separate release step needed.

create function public.request_leave(
  p_start_date date,
  p_end_date date,
  p_amount numeric,
  p_is_unpaid boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := auth.uid();
  v_employment_type text;
  v_year int;
  v_balance leave_balances;
  v_pending numeric;
  v_remaining numeric;
  v_request_id uuid;
begin
  select employment_type into v_employment_type from profiles where id = v_staff_id;
  v_year := extract(year from p_start_date)::int;

  if not p_is_unpaid then
    -- Locks this staff member's balance row for the year, serializing
    -- concurrent submissions so the pending sum below always reflects any
    -- request an earlier, now-committed call already inserted.
    select * into v_balance from leave_balances
    where staff_id = v_staff_id and leave_year = v_year
    for update;

    select coalesce(sum(amount), 0) into v_pending
    from leave_requests
    where staff_id = v_staff_id and status = 'pending' and not is_unpaid
      and extract(year from start_date) = v_year;

    if v_employment_type = 'hourly' then
      v_remaining := coalesce(v_balance.brought_forward, 0) + coalesce(v_balance.accrued_hours, 0)
        - coalesce(v_balance.used_hours, 0) - v_pending;
    else
      v_remaining := coalesce(v_balance.brought_forward, 0) + coalesce(v_balance.base_allowance, 0)
        + coalesce(v_balance.lieu_days_earned, 0) - coalesce(v_balance.used_days, 0) - v_pending;
    end if;

    if p_amount > v_remaining then
      raise exception 'Only % % available (% already pending) — this request is for %',
        v_remaining, case when v_employment_type = 'hourly' then 'hours' else 'days' end, v_pending, p_amount;
    end if;
  end if;

  insert into leave_requests (staff_id, start_date, end_date, amount, is_unpaid, notes)
  values (v_staff_id, p_start_date, p_end_date, p_amount, p_is_unpaid, p_notes)
  returning id into v_request_id;

  return v_request_id;
end;
$$;
