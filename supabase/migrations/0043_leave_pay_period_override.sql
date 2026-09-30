-- Lets an admin move an approved holiday to a different payroll month.
--
-- The payroll report puts hourly holiday in the month it was submitted
-- (from the 25th, the next month) and salaried leave in the month it starts.
-- When something slips — submitted on cutoff day, then the person was
-- archived before that month's run — the admin needs to say "pay this in
-- October" without unapproving it (which would refund the balance and email
-- the person). The request stays approved and the balance is untouched; only
-- the month the report counts it in changes, with who moved it and when.
-- Clearing the override puts it back on the normal rule.

alter table leave_requests
  add column pay_year int,
  add column pay_month int check (pay_month between 1 and 12),
  add column pay_period_set_by uuid references profiles (id) on delete set null,
  add column pay_period_set_by_name text,
  add column pay_period_set_at timestamptz,
  add constraint leave_requests_pay_period_both check ((pay_year is null) = (pay_month is null));

-- Admin-only, and only for approved requests. Pass nulls to clear.
create or replace function public.set_leave_pay_period(p_request_id uuid, p_year int, p_month int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_actor_name text;
begin
  if not is_admin() then
    raise exception 'Admin only';
  end if;

  if (p_year is null) <> (p_month is null) or (p_month is not null and p_month not between 1 and 12) then
    raise exception 'Choose a valid month';
  end if;

  select status into v_status from leave_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if v_status <> 'approved' then
    raise exception 'Only approved holiday can be moved to a pay period';
  end if;

  select full_name into v_actor_name from profiles where id = auth.uid();

  update leave_requests
  set pay_year = p_year,
      pay_month = p_month,
      pay_period_set_by = case when p_year is null then null else auth.uid() end,
      pay_period_set_by_name = case when p_year is null then null else v_actor_name end,
      pay_period_set_at = case when p_year is null then null else now() end
  where id = p_request_id;
end;
$$;

grant execute on function public.set_leave_pay_period(uuid, int, int) to authenticated;
