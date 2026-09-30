// Not started / In progress / Closed as a coloured pill — Maintenance and Actions.
export function WorkStatusBadge({ status }: { status: string }) {
  const style =
    status === "open"
      ? "bg-yellow-100 text-yellow-800"
      : status === "in_progress"
        ? "bg-blue-100 text-blue-800"
        : "bg-green-100 text-green-800";
  const label = status === "in_progress" ? "In progress" : status === "open" ? "Not started" : "Closed";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}
