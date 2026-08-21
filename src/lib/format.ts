// Bare toLocaleDateString() follows whatever locale the server or browser
// happens to be in — which on Vercel meant US-style m/d/yyyy. Everything here
// is for a pub in Devon, so dates are pinned to UK format at the one place
// that formats them.

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };

// dd/mm/yyyy
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", DATE_OPTS);
}

// dd/mm/yyyy, HH:mm — 24-hour, since a pub rota talks in 23:00 not 11 PM.
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", DATE_OPTS)}, ${d.toLocaleTimeString("en-GB", TIME_OPTS)}`;
}

// The instant of the next midnight in UK local time. Used to park an agenda
// item for the rest of the meeting: "hidden until midnight tonight" has to
// mean midnight in Devon, not on the UTC server, or it resurfaces an hour
// early or late depending on the time of year.
export function nextUkMidnight(from: Date = new Date()): Date {
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const partsOf = (d: Date) =>
    dateFmt.formatToParts(d).reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {});

  // Step forward a day from midday UTC — safely inside the UK day whatever
  // the offset — to get tomorrow's UK calendar date.
  const today = partsOf(from);
  const noon = new Date(`${today.year}-${today.month}-${today.day}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + 1);
  const tomorrow = partsOf(noon);
  const target = `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`;

  // 00:00 UK is either 00:00Z (GMT) or 23:00Z the day before (BST). Try both
  // and keep whichever actually reads as midnight in London.
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  for (const shiftHours of [0, -1]) {
    const candidate = new Date(`${target}T00:00:00Z`);
    candidate.setUTCHours(candidate.getUTCHours() + shiftHours);
    if (timeFmt.format(candidate) === "00:00") return candidate;
  }
  return new Date(`${target}T00:00:00Z`);
}

// For date-only columns already stored as yyyy-mm-dd. Parsed as local midnight
// so the day can't slip backwards in a timezone behind UTC.
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return formatDate(new Date(`${value}T00:00:00`));
}
