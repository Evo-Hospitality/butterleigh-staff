-- Stops a double-pressed submit button creating two identical Actions or
-- maintenance requests. Disabling the button while the form is in flight
-- (see components/submit-button.tsx) handles the common case, but it's a
-- client-side courtesy, not a guarantee — it does nothing about a held
-- Enter key, a browser retry, or two tabs open on the same form.
--
-- Each render of a "new" form carries a token. Both presses of the same
-- button send the same token, so the second insert collides with this
-- unique index and the server action redirects to the record the first
-- press already created, instead of making a duplicate. Two deliberate
-- submissions come from two page renders with two different tokens, so
-- genuinely raising the same title twice still works.
--
-- Nullable + a partial index because every existing row predates this and
-- has no token; without "where ... is not null" they'd all collide with
-- each other on null.

alter table action_items add column submission_token uuid;
alter table maintenance_requests add column submission_token uuid;

create unique index action_items_submission_token_key
  on action_items (submission_token)
  where submission_token is not null;

create unique index maintenance_requests_submission_token_key
  on maintenance_requests (submission_token)
  where submission_token is not null;
