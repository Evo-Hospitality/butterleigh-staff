-- profiles is admin-write only (profiles_admin_write, 0001_init.sql), so a
-- new starter can't flip their own onboarding_status to 'submitted' — the
-- update is silently filtered out by RLS and they'd sit on the form forever.
--
-- Same fix as clear_must_change_password() in 0005: a narrow security definer
-- function that can only make the one transition, for the caller only. It
-- can't be used to jump straight to 'approved', so review can't be skipped.
create function public.mark_onboarding_submitted()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set onboarding_status = 'submitted'
  where id = auth.uid()
    and onboarding_status = 'pending';
$$;

grant execute on function public.mark_onboarding_submitted() to authenticated;
