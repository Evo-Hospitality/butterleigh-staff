-- Adds a "draft" status so an in-progress answer (or a directly-authored
-- SOP not ready to go live) can be saved without publishing it — visible
-- only to its asker (same "still pending" placeholder as unanswered) and
-- to admins/managers, same as unanswered questions already are.
alter table sop_entries drop constraint sop_entries_status_check;
alter table sop_entries add constraint sop_entries_status_check
  check (status in ('unanswered', 'draft', 'answered'));
