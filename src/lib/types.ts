export type EmploymentType = "salaried" | "hourly";
export type StaffRole = "staff" | "admin";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: StaffRole;
  employment_type: EmploymentType;
  working_days: number[]; // 0 = Sunday .. 6 = Saturday
  contracted_hours_per_week: number | null;
  annual_allowance_days: number | null; // salaried only
  manager_id: string | null;
  is_manager: boolean;
  active: boolean;
  invited_at: string | null;
  must_change_password: boolean;
  start_date: string | null;
  has_maintenance_access: boolean;
  created_at: string;
};

// The "owns this, can act on it" fallback pattern used across every
// mini-app — admins always qualify, managers always qualify, matching the
// admin/manager-only SQL functions (can_manage_sops(), etc.).
export function isManagerOrAdmin(profile: Profile): boolean {
  return profile.role === "admin" || profile.is_manager;
}

// Admins and managers have implicit access (same fallback pattern used
// throughout — the per-person flag is what an admin opts regular staff into,
// not a boundary admins/managers themselves are subject to).
export function canAccessMaintenance(profile: Profile): boolean {
  return profile.has_maintenance_access || isManagerOrAdmin(profile);
}

// Who a request can be routed TO — deliberately narrower than who can
// access the app. Anyone with maintenance access can see the shared log,
// but only admins/managers are the "someone should own fixing this" people
// that raisers pick from in Assign to / Reassign to.
export const canBeAssignedMaintenance = isManagerOrAdmin;

export type LeaveBalance = {
  id: string;
  staff_id: string;
  leave_year: number;
  brought_forward: number;
  base_allowance: number; // salaried, snapshotted from profile at year start
  lieu_days_earned: number;
  accrued_hours: number; // hourly only
  used_days: number;
  used_hours: number;
};

export type LeaveRequest = {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  amount: number; // days for salaried, hours for hourly
  is_unpaid: boolean; // salaried only — never touches the holiday balance
  status: RequestStatus;
  approver_id: string | null;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
};

export type LieuRequest = {
  id: string;
  staff_id: string;
  work_date: string;
  status: RequestStatus;
  approver_id: string | null;
  notes: string | null;
  created_at: string;
  decided_at: string | null;
};

export type MonthlyHoursEntry = {
  id: string;
  staff_id: string;
  year: number;
  month: number; // 1-12
  hours_worked: number;
  entered_by: string;
  entered_at: string;
};

export type BankHoliday = {
  id: string;
  date: string;
  name: string;
};

export type ImpersonationLogEntry = {
  id: string;
  admin_id: string | null;
  admin_name: string;
  target_id: string | null;
  target_name: string;
  started_at: string;
  ended_at: string | null;
};

export type MaintenanceStatus = "open" | "closed";
export type MaintenanceUpdateKind = "note" | "reassigned" | "status_changed";

export type MaintenanceRequest = {
  id: string;
  submitted_by: string | null;
  submitted_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  status: MaintenanceStatus;
  created_at: string;
  closed_at: string | null;
};

export type MaintenanceUpdateEntry = {
  id: string;
  request_id: string;
  author_id: string | null;
  author_name: string;
  kind: MaintenanceUpdateKind;
  note: string;
  created_at: string;
};

export type SopStatus = "unanswered" | "draft" | "answered";
export type SopBlockKind = "text" | "photo" | "link";

export type SopEntry = {
  id: string;
  title: string;
  asked_by: string | null;
  asked_by_name: string | null;
  status: SopStatus;
  answered_by: string | null;
  answered_by_name: string | null;
  created_at: string;
  answered_at: string | null;
};

export type SopBlock = {
  id: string;
  entry_id: string;
  kind: SopBlockKind;
  sort_order: number;
  body: string | null;
  url: string | null;
  caption: string | null;
  created_at: string;
};

export type EventSuggestionStatus = "pending" | "approved" | "declined";

export type EventSuggestion = {
  id: string;
  title: string;
  description: string | null;
  submitted_by: string | null;
  submitted_by_name: string;
  status: EventSuggestionStatus;
  decided_by: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
};

export type EventSuggestionPhoto = {
  id: string;
  suggestion_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

export type ActionItemStatus = "open" | "closed";
export type ActionItemUpdateKind = "note" | "reassigned" | "status_changed";

export type ActionItem = {
  id: string;
  submitted_by: string | null;
  submitted_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string;
  title: string;
  notes: string | null;
  photo_url: string | null;
  status: ActionItemStatus;
  created_at: string;
  closed_at: string | null;
};

export type ActionItemUpdateEntry = {
  id: string;
  action_id: string;
  author_id: string | null;
  author_name: string;
  kind: ActionItemUpdateKind;
  note: string;
  created_at: string;
};

export type RecurrenceUnit = "days" | "weeks" | "months";
export type TaskStatus = "pending" | "awaiting_review" | "done";
export type TaskReviewOutcome = "done" | "sent_back";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_by_name: string;
  assigned_to: string | null;
  assigned_to_name: string;
  due_date: string | null;
  due_time: string | null;
  recurrence_unit: RecurrenceUnit | null;
  recurrence_value: number | null;
  is_active: boolean;
  status: TaskStatus;
  completed_at: string | null;
  reviewed_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
};

export type TaskReview = {
  id: string;
  task_id: string;
  outcome: TaskReviewOutcome;
  completed_by: string | null;
  completed_by_name: string;
  reviewed_by: string | null;
  reviewed_by_name: string;
  note: string | null;
  completed_at: string;
  reviewed_at: string;
};

export type SocialPhotoPost = {
  id: string;
  submitted_by: string | null;
  submitted_by_name: string;
  caption: string | null;
  created_at: string;
};

export type SocialPhoto = {
  id: string;
  post_id: string;
  submitted_by: string | null;
  submitted_by_name: string;
  url: string;
  sort_order: number;
  used_for_socials: boolean;
  used_at: string | null;
  used_by: string | null;
  used_by_name: string | null;
  created_at: string;
};
