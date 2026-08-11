export type ParsedHoursLine = { name: string; hours: number };

// Matches a straight copy-paste out of a spreadsheet: "Name<TAB> 101.60 ".
// Falls back to splitting on the last run of whitespace before a trailing
// number if there's no tab (e.g. pasted as space-aligned plain text).
export function parseHoursPaste(text: string): ParsedHoursLine[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes("\t") ? line.split("\t") : line.split(/\s+(?=[\d.,]+$)/);
      if (parts.length < 2) return null;

      const name = parts[0].trim();
      const hours = Number(parts[parts.length - 1].trim().replace(/,/g, ""));

      if (!name || Number.isNaN(hours)) return null;
      return { name, hours };
    })
    .filter((row): row is ParsedHoursLine => row !== null);
}

// Case/whitespace-insensitive match against a known staff name.
export function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
}
