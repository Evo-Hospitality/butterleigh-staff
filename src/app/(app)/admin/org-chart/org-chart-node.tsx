import Link from "next/link";
import type { Profile } from "@/lib/types";

export function OrgChartNode({ person, people, depth }: { person: Profile; people: Profile[]; depth: number }) {
  const children = people.filter((p) => p.manager_id === person.id);

  return (
    <div className={depth > 0 ? "ml-6 border-l border-border pl-4" : ""}>
      <div className="flex flex-wrap items-center gap-2 py-2">
        <Link href={`/admin/staff/${person.id}`} className="font-medium hover:text-accent">
          {person.full_name}
        </Link>
        {person.role === "admin" && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Admin
          </span>
        )}
        {person.is_manager && person.role !== "admin" && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Manager</span>
        )}
        <span className="text-xs capitalize text-muted-foreground">{person.employment_type}</span>
      </div>
      {children.map((child) => (
        <OrgChartNode key={child.id} person={child} people={people} depth={depth + 1} />
      ))}
    </div>
  );
}
