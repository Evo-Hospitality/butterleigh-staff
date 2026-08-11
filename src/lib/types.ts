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
