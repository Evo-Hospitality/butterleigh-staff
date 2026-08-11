-- "Automatically expose new tables" was intentionally left off when creating
-- the project (safer default — access is granted explicitly via RLS policies
-- rather than every new table being world-writable by default). That setting
-- also controls whether Supabase auto-grants base table privileges, so we
-- grant them here ourselves. RLS policies (0001_init.sql) still govern which
-- rows `authenticated` can actually see/touch; `service_role` bypasses RLS
-- but still needs these grants to touch the tables at all.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

grant execute on all functions in schema public to authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
