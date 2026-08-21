-- The time export contains clock-ins that aren't employees — "TRAINING,
-- TRAINING" is one, but there are others and they vary — so an import is now
-- reviewed line by line before anything is written, and any row can be left
-- out. Deliberately not a remembered rule: what counts as a non-employee
-- changes month to month, and a standing exclusion list would quietly drop a
-- real person who happened to share a name with a retired one.
--
-- Only a counter is needed on the import itself; the exclusions are decisions
-- made in the moment rather than stored state.

alter table hours_imports add column if not exists excluded_count int not null default 0;
