-- Which of the three employee statements they ticked on the HMRC Starter
-- Checklist. It's what decides their tax code on the first payslip, and
-- until now it was only knowable by opening the uploaded PDF and reading it,
-- which is no use when you're keying a starter into payroll.
alter table employee_details
  add column hmrc_statement text
  check (hmrc_statement is null or hmrc_statement in ('A', 'B', 'C'));
