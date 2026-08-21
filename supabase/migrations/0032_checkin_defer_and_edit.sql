-- Two additions to the Overview agenda.
--
-- "Discussed, carry to next week" is for an item that was talked about but
-- isn't finished. Marking it discussed would file it away as done; leaving it
-- open means it clutters the rest of the meeting. So it's hidden until the
-- end of the day and resurfaces tomorrow, still open, carrying a count of how
-- many weeks it's been rolling — which is itself worth seeing.
--
-- deferred_until holds the UK midnight following the meeting. It's a
-- timestamptz so the comparison is a plain instant comparison; working out
-- when UK midnight actually falls (GMT vs BST) happens in the app.
alter table checkin_items add column deferred_until timestamptz;
alter table checkin_items add column carried_count int not null default 0;
alter table checkin_items add column last_carried_at timestamptz;

-- Open items are now "not discussed AND not currently deferred", which this
-- index covers alongside the existing group lookup.
create index checkin_items_deferred_idx on checkin_items (deferred_until);
