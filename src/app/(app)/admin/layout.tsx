import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

const TABS = [
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/org-chart", label: "Org chart" },
  { href: "/admin/bank-holidays", label: "Bank holidays" },
  { href: "/admin/hours", label: "Monthly hours" },
  { href: "/admin/balances", label: "Balances" },
  { href: "/admin/payroll-report", label: "Payroll report" },
  { href: "/admin/activity-log", label: "Activity log" },
  { href: "/admin/maintenance-settings", label: "Maintenance settings" },
  { href: "/admin/social-photos-settings", label: "Social photos" },
  { href: "/admin/checkin-groups", label: "Agenda groups" },
  { href: "/admin/stock-locations", label: "Stock locations" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div>
      <nav className="mb-6 flex gap-1 border-b border-border text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-3 py-2 text-muted-foreground hover:text-accent"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
