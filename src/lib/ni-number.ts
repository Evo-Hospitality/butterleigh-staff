// A National Insurance number is nine characters — two letters, six digits,
// one letter — and HMRC treats it as case-insensitive, but payroll and any
// export downstream is much happier with one consistent form. So it's stored
// compact and uppercase: QQ123456C, never "qq 12 34 56 c".
//
// Deliberately not enforcing the full HMRC pattern (which prefixes are legal,
// which suffix letters). Nine characters catches real typos; the stricter
// rule risks rejecting something HMRC would actually accept.

export function formatNiNumber(value: string | null | undefined): string {
  return (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 9);
}

export function isCompleteNiNumber(value: string | null | undefined): boolean {
  return formatNiNumber(value).length === 9;
}
