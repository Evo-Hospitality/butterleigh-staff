export type TimeEntryTotal = {
  rawName: string; // exactly as the file spells it, e.g. "Hancock, Tia"
  displayName: string; // flipped to how a staff record reads, "Tia Hancock"
  hours: number;
  shifts: number;
};

export type ParsedTimeEntries = {
  totals: TimeEntryTotal[];
  periodStart: string | null; // ISO yyyy-mm-dd
  periodEnd: string | null;
  entryCount: number;
};

// Minimal RFC-4180 field splitter — the export quotes any field containing a
// comma, and every employee name does ("Hancock, Tia"), so naive splitting
// would shear every row in half.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// "Jun 30, 2026" -> "2026-06-30". Returns null on anything unexpected rather
// than guessing, so a format change surfaces as a missing period rather than
// silently wrong dates.
function parseEntryDate(value: string): string | null {
  const parsed = new Date(`${value.trim()} 00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The file lists people surname-first; staff records read first-name-first.
export function flipName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes(",")) return trimmed.replace(/\s+/g, " ");
  const [surname, ...rest] = trimmed.split(",");
  const forename = rest.join(",").trim();
  if (!forename) return surname.trim();
  return `${forename} ${surname.trim()}`.replace(/\s+/g, " ");
}

export function normaliseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Sums "Payable Hours" — the column that already has unpaid breaks deducted,
// so it's what the person is actually paid for. One employee appears many
// times (a split shift is two rows), hence the aggregation.
export function parseTimeEntries(csv: string): ParsedTimeEntries {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("That file has no time entries in it.");
  }

  const header = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ""));
  const idxEmployee = header.findIndex((h) => h.toLowerCase() === "employee");
  const idxDate = header.findIndex((h) => h.toLowerCase() === "date");
  const idxPayable = header.findIndex((h) => h.toLowerCase() === "payable hours");

  if (idxEmployee === -1 || idxPayable === -1) {
    throw new Error(
      "That doesn't look like a TimeEntries export — it needs Employee and Payable Hours columns.",
    );
  }

  const byName = new Map<string, TimeEntryTotal>();
  const dates: string[] = [];
  let entryCount = 0;

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const rawName = (fields[idxEmployee] ?? "").trim();
    if (!rawName) continue;

    const hours = Number((fields[idxPayable] ?? "").trim());
    if (!Number.isFinite(hours)) continue;

    entryCount++;
    if (idxDate !== -1) {
      const d = parseEntryDate(fields[idxDate] ?? "");
      if (d) dates.push(d);
    }

    const key = normaliseName(rawName);
    const existing = byName.get(key);
    if (existing) {
      existing.hours += hours;
      existing.shifts++;
    } else {
      byName.set(key, { rawName, displayName: flipName(rawName), hours, shifts: 1 });
    }
  }

  dates.sort();
  const totals = [...byName.values()]
    // Rounded here, not at display time, so what's stored is what was shown.
    .map((t) => ({ ...t, hours: Math.round(t.hours * 100) / 100 }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    totals,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
    entryCount,
  };
}
