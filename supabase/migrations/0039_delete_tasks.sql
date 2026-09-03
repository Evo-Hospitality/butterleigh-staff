-- Tasks had no delete policy at all, so nothing could ever be removed —
-- a typo'd or duplicated task stayed on the board for good.
--
-- Admin only, deliberately, and not the Stocktake-style "Manage" level:
-- a recurring task is a single row whose due date rolls forward on each
-- completion, so deleting one doesn't remove an occurrence, it removes the
-- whole repeating series and its review history with it (task_reviews
-- cascades). That's a bigger action than it looks and belongs with the
-- people who own the payroll and staff records.
create policy "tasks_delete_admin"
  on tasks for delete
  to authenticated
  using (is_admin());
