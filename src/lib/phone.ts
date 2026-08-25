// Phone numbers arrive as "07700900123", "+44 7700 900123", "07700 900123"
// — the same number four ways, which makes them awkward to compare and ugly
// on screen. Everything is normalised to +44 7700 900123.
//
// Anything that isn't a recognisable UK number is left exactly as typed.
// Forcing a +44 onto a foreign mobile would quietly turn a working number
// into a broken one, and someone's emergency contact is the last place to
// take that risk.

const UK_NSN_LENGTH = 10;

function nationalNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");

  // Already written in international form. Only the full-length version
  // counts: deleting back through "+44 7700 9001" leaves ten digits, and
  // without this guard the bare-ten-digit rule below would swallow the 44
  // and turn it into +44 4477 009001 as you backspaced.
  if (value.trimStart().startsWith("+")) {
    return digits.startsWith("44") && digits.length === 2 + UK_NSN_LENGTH
      ? digits.slice(2)
      : null;
  }

  // 00 44 7700 900123
  if (digits.startsWith("0044") && digits.length === 4 + UK_NSN_LENGTH) {
    return digits.slice(4);
  }
  // 44 7700 900123, written without the plus
  if (digits.startsWith("44") && digits.length === 2 + UK_NSN_LENGTH) {
    return digits.slice(2);
  }
  // 07700 900123
  if (digits.startsWith("0") && digits.length === 1 + UK_NSN_LENGTH) {
    return digits.slice(1);
  }
  // 7700900123
  if (digits.length === UK_NSN_LENGTH && !digits.startsWith("0")) {
    return digits;
  }
  return null;
}

export function formatUkPhone(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  const national = nationalNumber(raw);
  if (!national) return raw;

  return `+44 ${national.slice(0, 4)} ${national.slice(4)}`;
}
