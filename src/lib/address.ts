// Addresses are free text and should stay that way — people write them in
// all sorts of orders and it isn't our business to rearrange them. The one
// part with a correct form is the postcode, which turns up as "ex15 1pn",
// "EX151PN" and "TA12QS" and should read EX15 1PN either way.
//
// Outward code is 1-2 letters, a digit, then optionally another digit or
// letter. Inward code is always a digit followed by two letters. The space
// between them is often missing.
const POSTCODE = /\b([A-Za-z]{1,2}\d[A-Za-z\d]?)\s*(\d[A-Za-z]{2})\b/g;

export function formatPostcodes(value: string | null | undefined): string {
  return (value ?? "").replace(
    POSTCODE,
    (_match, outward: string, inward: string) =>
      `${outward.toUpperCase()} ${inward.toUpperCase()}`,
  );
}

// Tidies trailing spaces per line and drops blank lines from the ends,
// without touching how the address itself is laid out.
export function formatAddress(value: string | null | undefined): string {
  const lines = (value ?? "").split("\n").map((line) => line.trimEnd());
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return formatPostcodes(lines.join("\n"));
}
