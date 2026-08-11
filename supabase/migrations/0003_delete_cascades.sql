-- Lets a staff member be hard-deleted (for dummy/test data or hires that
-- never started) without foreign key errors, by making the "who approved
-- this" / "who manages this person" / "who entered these hours" references
-- degrade gracefully instead of blocking the delete.

alter table profiles
  drop constraint profiles_manager_id_fkey,
  add constraint profiles_manager_id_fkey
    foreign key (manager_id) references profiles (id) on delete set null;

alter table leave_requests
  drop constraint leave_requests_approver_id_fkey,
  add constraint leave_requests_approver_id_fkey
    foreign key (approver_id) references profiles (id) on delete set null;

alter table lieu_requests
  drop constraint lieu_requests_approver_id_fkey,
  add constraint lieu_requests_approver_id_fkey
    foreign key (approver_id) references profiles (id) on delete set null;

alter table monthly_hours
  alter column entered_by drop not null,
  drop constraint monthly_hours_entered_by_fkey,
  add constraint monthly_hours_entered_by_fkey
    foreign key (entered_by) references profiles (id) on delete set null;
