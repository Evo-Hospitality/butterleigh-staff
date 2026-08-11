-- New employees should default to having Maintenance access rather than
-- needing an admin to opt them in — only the "New staff" form's checkbox
-- actually needs this for the UI, but the column default should agree with
-- it so any other insert path (e.g. the handle_new_user() trigger, or a
-- future script) doesn't silently default someone out. Existing staff are
-- untouched — this only changes the default for rows created from now on.
alter table profiles alter column has_maintenance_access set default true;
