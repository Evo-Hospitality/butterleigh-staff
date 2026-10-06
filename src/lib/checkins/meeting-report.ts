import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, ShadingType, TextRun } from "docx";
import { partitionAgenda } from "./agenda";
import { formatDate, formatDateOnly } from "@/lib/format";
import { isManagerOrAdmin } from "@/lib/types";
import type {
  ActionItem,
  ActionItemUpdateEntry,
  CheckinGroup,
  CheckinItem,
  EventSuggestion,
  MaintenanceRequest,
  MaintenanceUpdateEntry,
  Profile,
  Task,
  TaskReview,
} from "@/lib/types";

// The weekly management meeting pack as a Word document: the agenda by
// group, then open Actions, maintenance and management-team tasks grouped by
// who they're assigned to (each with its status and, in smaller text, its two
// most recent updates), then event ideas awaiting a decision.
//
// Same population as the Overview board (src/lib/checkins/summary.ts):
// maintenance, tasks and events read org-wide with the service-role client;
// Actions through the caller's own client, so they stay private to their
// raiser and owner (an admin sees them all, a manager only theirs); "tasks"
// means open tasks assigned to managers/admins.

const FONT = "Arial";
const BODY = 21; // half-points: 10.5pt
const SMALL = 17; // 8.5pt
const GREY = "6B7280";
const ACCENT = "FF6900";

type Update = { at: string; who: string; text: string };

function lastTwo<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2);
}

function byPerson<T>(rows: T[], name: (r: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = name(r) || "Unassigned";
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const heading1 = (text: string) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 120 }, children: [new TextRun({ text, font: FONT, bold: true, size: 30 })] });

const heading2 = (text: string, count?: number) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text, font: FONT, bold: true, size: 24 }),
      ...(count !== undefined ? [new TextRun({ text: `  (${count})`, font: FONT, size: 20, color: GREY })] : []),
    ],
  });

const emptyLine = (text: string) =>
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, font: FONT, size: BODY, italics: true, color: GREY })] });

// One item: a bulleted title line, an optional status pill, then small grey
// detail lines underneath.
function itemBlock(opts: { title: string; status?: string; meta?: string; details?: string[]; updates?: Update[] }) {
  const out: Paragraph[] = [
    new Paragraph({
      bullet: { level: 0 },
      spacing: { before: 60, after: 20 },
      children: [
        new TextRun({ text: opts.title, font: FONT, size: BODY, bold: true }),
        ...(opts.status
          ? [
              new TextRun({ text: "  ", font: FONT, size: BODY }),
              new TextRun({
                text: ` ${opts.status} `,
                font: FONT,
                size: SMALL,
                bold: true,
                color: "FFFFFF",
                shading: { type: ShadingType.CLEAR, color: "auto", fill: opts.status === "In progress" ? "2563EB" : ACCENT },
              }),
            ]
          : []),
      ],
    }),
  ];
  const small = (text: string, italics = false) =>
    new Paragraph({
      indent: { left: 720 },
      spacing: { after: 20 },
      children: [new TextRun({ text, font: FONT, size: SMALL, color: GREY, italics })],
    });
  if (opts.meta) out.push(small(opts.meta));
  for (const d of opts.details ?? []) if (d.trim()) out.push(small(d.trim()));
  for (const u of opts.updates ?? []) out.push(small(`${formatDate(u.at)} · ${u.who}: ${u.text}`, true));
  return out;
}

export async function buildMeetingReport(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  preparedBy: string,
): Promise<Buffer> {
  const [
    { data: groups },
    { data: agendaItems },
    { data: actions },
    { data: maintenance },
    { data: tasks },
    { data: staff },
    { data: events },
  ] = await Promise.all([
    supabase.from("checkin_groups").select("*").eq("active", true).order("sort_order").returns<CheckinGroup[]>(),
    supabase.from("checkin_items").select("*").order("created_at").returns<CheckinItem[]>(),
    supabase.from("action_items").select("*").neq("status", "closed").order("created_at").returns<ActionItem[]>(),
    admin.from("maintenance_requests").select("*").neq("status", "closed").order("created_at").returns<MaintenanceRequest[]>(),
    admin
      .from("tasks")
      .select("*")
      .eq("is_active", true)
      .neq("status", "done")
      .order("due_date", { nullsFirst: false })
      .returns<Task[]>(),
    admin.from("profiles").select("*").eq("active", true).returns<Profile[]>(),
    admin.from("event_suggestions").select("*").eq("status", "pending").order("created_at").returns<EventSuggestion[]>(),
  ]);

  const managerIds = new Set((staff ?? []).filter(isManagerOrAdmin).map((s) => s.id));
  const mgmtTasks = (tasks ?? []).filter((t) => t.assigned_to && managerIds.has(t.assigned_to));

  const actionIds = (actions ?? []).map((a) => a.id);
  const maintIds = (maintenance ?? []).map((m) => m.id);
  const taskIds = mgmtTasks.map((t) => t.id);
  // Status changes are left out of "updates" — the status is shown already.
  const [{ data: actionUpdates }, { data: maintUpdates }, { data: reviews }] = await Promise.all([
    actionIds.length
      ? supabase.from("action_item_updates").select("*").in("action_id", actionIds).neq("kind", "status_changed").returns<ActionItemUpdateEntry[]>()
      : Promise.resolve({ data: [] as ActionItemUpdateEntry[] }),
    maintIds.length
      ? admin.from("maintenance_updates").select("*").in("request_id", maintIds).neq("kind", "status_changed").returns<MaintenanceUpdateEntry[]>()
      : Promise.resolve({ data: [] as MaintenanceUpdateEntry[] }),
    taskIds.length
      ? admin.from("task_reviews").select("*").in("task_id", taskIds).returns<TaskReview[]>()
      : Promise.resolve({ data: [] as TaskReview[] }),
  ]);

  const toUpdate = (u: { created_at: string; author_name: string; note: string }): Update => ({
    at: u.created_at,
    who: u.author_name,
    text: u.note,
  });

  const now = new Date();
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: "The Butterleigh Inn — Management meeting", font: FONT, bold: true, size: 40 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })} · prepared by ${preparedBy} at ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" })}`,
          font: FONT,
          size: SMALL,
          color: GREY,
        }),
      ],
    }),
  ];

  // 1. Agenda -------------------------------------------------------------
  children.push(heading1("Agenda"));
  const agenda = partitionAgenda(groups ?? [], agendaItems ?? []);
  let anyAgenda = false;
  for (const g of agenda) {
    const items = [...g.open, ...g.carried];
    if (items.length === 0) continue;
    anyAgenda = true;
    children.push(heading2(g.name, items.length));
    for (const i of items) {
      children.push(
        ...itemBlock({
          title: i.title,
          meta: `Added by ${i.created_by_name} on ${formatDate(i.created_at)}${
            i.carried_count > 0 ? ` · carried over ${i.carried_count} ${i.carried_count === 1 ? "time" : "times"}` : ""
          }`,
          details: i.notes ? [i.notes] : [],
        }),
      );
    }
  }
  if (!anyAgenda) children.push(emptyLine("Nothing on the agenda."));

  // 2. Actions --------------------------------------------------------------
  children.push(heading1("Actions"));
  if ((actions ?? []).length === 0) children.push(emptyLine("No open actions."));
  for (const [person, rows] of byPerson(actions ?? [], (a) => a.assigned_to_name)) {
    children.push(heading2(person, rows.length));
    for (const a of rows) {
      children.push(
        ...itemBlock({
          title: a.title,
          status: a.status === "in_progress" ? "In progress" : "Not started",
          meta: `Raised by ${a.submitted_by_name} on ${formatDate(a.created_at)}`,
          updates: lastTwo((actionUpdates ?? []).filter((u) => u.action_id === a.id)).map(toUpdate),
        }),
      );
    }
  }

  // 3. Maintenance ------------------------------------------------------------
  children.push(heading1("Maintenance"));
  if ((maintenance ?? []).length === 0) children.push(emptyLine("No open maintenance."));
  for (const [person, rows] of byPerson(maintenance ?? [], (m) => m.assigned_to_name)) {
    children.push(heading2(person, rows.length));
    for (const m of rows) {
      children.push(
        ...itemBlock({
          title: m.title,
          status: m.status === "in_progress" ? "In progress" : "Not started",
          meta: `Reported by ${m.submitted_by_name} on ${formatDate(m.created_at)}`,
          updates: lastTwo((maintUpdates ?? []).filter((u) => u.request_id === m.id)).map(toUpdate),
        }),
      );
    }
  }

  // 4. Tasks (management team) --------------------------------------------------
  children.push(heading1("Tasks (management team)"));
  if (mgmtTasks.length === 0) children.push(emptyLine("No open management tasks."));
  for (const [person, rows] of byPerson(mgmtTasks, (t) => t.assigned_to_name)) {
    children.push(heading2(person, rows.length));
    for (const t of rows) {
      const taskReviews = (reviews ?? [])
        .filter((r) => r.task_id === t.id)
        .map((r) => ({ ...r, created_at: r.reviewed_at }));
      children.push(
        ...itemBlock({
          title: t.title,
          status: t.status === "awaiting_review" ? "Awaiting review" : undefined,
          meta: [
            `Raised by ${t.created_by_name}`,
            t.due_date ? `due ${formatDateOnly(t.due_date)}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          details: t.description ? [t.description] : [],
          updates: lastTwo(taskReviews).map((r) => ({
            at: r.reviewed_at,
            who: r.reviewed_by_name,
            text: `${r.outcome === "sent_back" ? "sent back" : "confirmed done"}${r.note ? ` — ${r.note}` : ""}`,
          })),
        }),
      );
    }
  }

  // 5. Event ideas ----------------------------------------------------------------
  children.push(heading1("Event ideas awaiting a decision"));
  if ((events ?? []).length === 0) children.push(emptyLine("No new ideas."));
  for (const e of events ?? []) {
    children.push(
      ...itemBlock({
        title: e.title,
        meta: `Suggested by ${e.submitted_by_name} on ${formatDate(e.created_at)}`,
        details: e.description ? [e.description] : [],
      }),
    );
  }

  const doc = new Document({
    creator: preparedBy,
    title: "Management meeting",
    styles: { default: { document: { run: { font: FONT, size: BODY } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [
          ...children,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480 },
            children: [new TextRun({ text: "From the Butterleigh Inn staff portal", font: FONT, size: SMALL, color: GREY })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
