// The three employee statements on the HMRC Starter Checklist. Which one
// they tick decides the tax code applied to their first payslip, so payroll
// needs it as a field rather than buried in an uploaded PDF.
//
// Wording follows the checklist itself, trimmed to plain English — someone
// picking one of these on their phone shouldn't have to parse HMRC's prose.

export const HMRC_STATEMENTS = [
  {
    value: "A",
    title: "A — This is my first job since 6 April",
    detail:
      "Since 6 April you've had no other job, and no Jobseeker's Allowance, Employment and Support Allowance or Incapacity Benefit. You don't get a State or Occupational Pension.",
  },
  {
    value: "B",
    title: "B — This is now my only job, but I've had another since 6 April",
    detail:
      "Since 6 April you've had another job, or claimed Jobseeker's Allowance, Employment and Support Allowance or Incapacity Benefit — but that's finished now. You don't get a State or Occupational Pension.",
  },
  {
    value: "C",
    title: "C — I have another job or a pension as well as this one",
    detail:
      "As well as working here you have another job, or you receive a State or Occupational Pension.",
  },
] as const;

export type HmrcStatement = (typeof HMRC_STATEMENTS)[number]["value"];

export function isHmrcStatement(value: string | null | undefined): value is HmrcStatement {
  return value === "A" || value === "B" || value === "C";
}

// For showing it back on an admin screen without repeating the long text.
export function hmrcStatementSummary(value: string | null | undefined): string | null {
  const match = HMRC_STATEMENTS.find((s) => s.value === value);
  return match ? match.title : null;
}
