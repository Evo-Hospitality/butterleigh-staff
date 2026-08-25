// UK sort codes are always six digits, written in three pairs: 12-34-56.
// People type them every which way — "123456", "12 34 56", "12/34/56" — so
// rather than nagging, everything gets normalised to the one form on the way
// in and on the way out.
//
// Deliberately NOT in lib/onboarding/details.ts, which is server-only: the
// input box formats as you type and needs this in the browser too.

export function sortCodeDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 6);
}

// Formats as far as it can, so a half-typed "1234" shows as "12-34" rather
// than waiting for all six.
export function formatSortCode(value: string | null | undefined): string {
  const digits = sortCodeDigits(value);
  return (digits.match(/.{1,2}/g) ?? []).join("-");
}

export function isCompleteSortCode(value: string | null | undefined): boolean {
  return sortCodeDigits(value).length === 6;
}

// UK account numbers are eight digits and often start with a zero, so they
// are only ever text — never a number. Parsing one would silently turn
// 03666174 into 3666174 and send someone's wages to an account that doesn't
// exist.
export function accountNumberDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 8);
}

export function isCompleteAccountNumber(value: string | null | undefined): boolean {
  return accountNumberDigits(value).length === 8;
}
