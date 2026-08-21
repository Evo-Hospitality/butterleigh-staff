-- Check Ins: the working space for the weekly management meeting. Two parts —
-- a rolling agenda board, and (built in the app, not here) a summary of what's
-- outstanding across the other apps.
--
-- Rolling rather than one record per week: items are added as they come up
-- during the week, worked through at the meeting, then ticked off. A ticked
-- item isn't deleted — it keeps who ticked it and when, and moves into the
-- Discussed section, so there's a permanent record to refer back to.
--
-- Manager/admin only throughout. is_manager_or_admin() already exists from
-- 0018_action_items.sql.

create table checkin_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  -- Archived rather than deleted once a group has history against it, so
  -- retiring a heading never takes past discussions with it.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table checkin_groups enable row level security;

create policy "checkin_groups_select"
  on checkin_groups for select
  to authenticated
  using (is_manager_or_admin());

-- Groups are the meeting's structure — changed rarely and deliberately.
create policy "checkin_groups_admin_write"
  on checkin_groups for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create table checkin_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references checkin_groups (id) on delete cascade,
  title text not null,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_by_name text not null,
  discussed boolean not null default false,
  discussed_at timestamptz,
  discussed_by uuid references profiles (id) on delete set null,
  discussed_by_name text,
  -- What was decided, captured as it's ticked off. Optional — often the
  -- conversation is the point and there's nothing to record.
  outcome text,
  created_at timestamptz not null default now()
);

alter table checkin_items enable row level security;

create policy "checkin_items_select"
  on checkin_items for select
  to authenticated
  using (is_manager_or_admin());

-- Anyone in the meeting can raise an item and tick one off. The update
-- policy's USING clause doesn't reference any column the update changes, so
-- a plain RLS update is safe here — unlike the reassignment case in
-- 0019_reassign_action_item_rpc.sql that needed an RPC.
create policy "checkin_items_insert"
  on checkin_items for insert
  to authenticated
  with check (is_manager_or_admin() and created_by = auth.uid());

create policy "checkin_items_update"
  on checkin_items for update
  to authenticated
  using (is_manager_or_admin())
  with check (is_manager_or_admin());

create policy "checkin_items_delete"
  on checkin_items for delete
  to authenticated
  using (is_manager_or_admin());

create index checkin_items_group_idx on checkin_items (group_id, discussed);

-- A starting structure so the first meeting isn't a blank page. Rename,
-- reorder or archive them under Admin.
insert into checkin_groups (name, sort_order) values
  ('People & rotas', 0),
  ('Food & kitchen', 1),
  ('Drink & cellar', 2),
  ('Guest feedback', 3),
  ('Maintenance & premises', 4),
  ('Marketing & events', 5),
  ('Numbers', 6),
  ('Any other business', 7);
