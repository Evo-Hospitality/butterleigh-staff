-- Deleting a staff member cascades: profiles -> monthly_hours (ON DELETE
-- CASCADE). That monthly_hours delete fires recalc_accrued_hours(), which
-- tried to re-upsert a leave_balances row for the same staff_id — but their
-- profiles row is being deleted in the same cascade, so the leave_balances
-- FK to profiles fails, and the whole staff deletion is refused with a
-- generic "Database error deleting user".
--
-- Fix: skip the recalculation entirely if the staff member's profile no
-- longer exists — nothing to accrue for someone who's being removed.
create or replace function public.recalc_accrued_hours()
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
  if not exists (select 1 from profiles where id = v_staff_id) then
    return coalesce(new, old);
  end if;

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
