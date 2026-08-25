// "alana walsh" should be "Alana Walsh". The trap is that naive title case
// also rewrites McDonald as Mcdonald and O'Brien as O'brien, which is worse
// than the problem — these are people's legal names on a payroll record.
//
// So it works word by word, and a word that already carries a capital
// somewhere inside it is left completely alone. Someone who typed McDonald,
// MacLeod or van der Berg meant it; only a word that's entirely lower case,
// or entirely upper case, gets rewritten.

function capitaliseParts(word: string): string {
  // Split on hyphens and apostrophes but keep them, so Anne-Marie and
  // O'Brien both come out right.
  return word
    .split(/([-'’])/)
    .map((part) =>
      /[-'’]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}

function fixMcPrefix(word: string): string {
  // Mc is essentially always followed by a capital. Mac deliberately isn't
  // touched — Macey and Mackenzie are as common as MacDonald, and there's no
  // way to tell them apart.
  return word.replace(/^(Mc)([a-z])/, (_m, mc: string, next: string) => mc + next.toUpperCase());
}

function titleCaseWord(word: string): string {
  if (!word) return word;

  const hasUpper = /[A-Z]/.test(word);
  const hasLower = /[a-z]/.test(word);

  // Mixed case already — deliberate. Leave it exactly as written.
  if (hasUpper && hasLower) return word;

  return fixMcPrefix(capitaliseParts(word));
}

export function formatName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map(titleCaseWord)
    .join(" ");
}
