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
