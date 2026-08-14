-- Tasks mini-app: ported from family-hub's House Tasks feature, minus the
-- points/scoreboard system, open to everyone (not gated to managers/admins
-- like Actions). The key difference from family-hub: completing a task
-- isn't terminal — it goes back to the creator to review and confirm.

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references profiles (id) on delete set null,
  created_by_name text not null,
  assigned_to uuid references profiles (id) on delete set null,
  assigned_to_name text not null,
  due_date date,
  due_time time,
  recurrence_unit text check (recurrence_unit in ('days', 'weeks', 'months')),
  recurrence_value int,
  is_active boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'awaiting_review', 'done')),
  completed_at timestamptz,
  reviewed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

-- Fully open — a shared board, matching family-hub's house_tasks behaviour.
create policy "tasks_select"
  on tasks for select
  to authenticated
  using (true);

create policy "tasks_insert"
  on tasks for insert
  to authenticated
  with check (created_by = auth.uid());

-- Covers general edits only (title/description/assigned_to/due date/
-- recurrence/active toggle) — the two status transitions below go through
-- security-definer RPCs instead, bypassing this policy entirely, since they
-- need tighter per-transition authorization than a single row policy can
-- express, and (per the reassignment bug fixed earlier this session)
-- changing a column that's also referenced in USING is exactly the shape
-- that caused unreliable failures. This policy's USING checks created_by,
-- and general edits never touch created_by, so that risk doesn't apply here.
create policy "tasks_update_by_creator"
  on tasks for update
  to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- task_reviews — every review decision, not just approvals
-- ---------------------------------------------------------------------------

create table task_reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  outcome text not null check (outcome in ('done', 'sent_back')),
  completed_by uuid references profiles (id) on delete set null,
  completed_by_name text not null,
  reviewed_by uuid references profiles (id) on delete set null,
  reviewed_by_name text not null,
  note text,
  completed_at timestamptz not null,
  reviewed_at timestamptz not null default now()
);

alter table task_reviews enable row level security;

create policy "task_reviews_select"
  on task_reviews for select
  to authenticated
  using (true);

-- No insert/update/delete policy for authenticated — only ever written by
-- review_task() below, which runs as the function owner.

-- ---------------------------------------------------------------------------
-- Status transitions — security-definer RPCs, not raw client UPDATEs
-- ---------------------------------------------------------------------------

create function public.complete_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if not (v_task.assigned_to = auth.uid() or is_admin()) then
    raise exception 'Not authorized to complete this task';
  end if;
  if v_task.status <> 'pending' then
    raise exception 'Task is not awaiting completion';
  end if;

  update tasks
  set status = 'awaiting_review', completed_at = now()
  where id = p_task_id;
end;
$$;

create function public.review_task(p_task_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task tasks;
  v_reviewer_name text;
  v_new_due_date date;
begin
  if p_outcome not in ('done', 'sent_back') then
    raise exception 'Invalid outcome';
  end if;

  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Task not found';
  end if;

  if not (v_task.created_by = auth.uid() or is_admin()) then
    raise exception 'Not authorized to review this task';
  end if;
  if v_task.status <> 'awaiting_review' then
    raise exception 'Task is not awaiting review';
  end if;

  select full_name into v_reviewer_name from profiles where id = auth.uid();

  insert into task_reviews (
    task_id, outcome, completed_by, completed_by_name,
    reviewed_by, reviewed_by_name, note, completed_at, reviewed_at
  )
  values (
    p_task_id, p_outcome, v_task.assigned_to, v_task.assigned_to_name,
    auth.uid(), v_reviewer_name, p_note, v_task.completed_at, now()
  );

  if p_outcome = 'done' and v_task.recurrence_unit is not null
     and v_task.recurrence_value is not null and v_task.due_date is not null then
    v_new_due_date := (v_task.due_date + (v_task.recurrence_value || ' ' || v_task.recurrence_unit)::interval)::date;
    update tasks
    set status = 'pending', completed_at = null, reviewed_at = now(),
        reminder_sent_at = null, due_date = v_new_due_date
    where id = p_task_id;
  elsif p_outcome = 'done' then
    update tasks
    set status = 'done', reviewed_at = now()
    where id = p_task_id;
  else
    update tasks
    set status = 'pending', completed_at = null, reviewed_at = now(), reminder_sent_at = null
    where id = p_task_id;
  end if;
end;
$$;
