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

// For date-only columns already stored as yyyy-mm-dd. Parsed as local midnight
// so the day can't slip backwards in a timezone behind UTC.
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  return formatDate(new Date(`${value}T00:00:00`));
}
