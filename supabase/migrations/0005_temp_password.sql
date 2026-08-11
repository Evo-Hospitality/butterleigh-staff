-- Lets an admin set a staff member's password directly (told to them
-- verbally, by text, etc.) as an alternative to the email-invite link.
-- must_change_password forces them through /auth/set-password on next
-- login before they can reach anything else.
alter table profiles add column must_change_password boolean not null default false;

-- Callable by any authenticated user, but only ever touches their own row —
-- lets the set-password page clear the flag once they've changed it,
-- without needing a general-purpose "update own profile" policy.
create function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set must_change_password = false where id = auth.uid();
$$;

grant execute on function public.clear_must_change_password() to authenticated;
