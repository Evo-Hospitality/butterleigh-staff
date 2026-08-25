import { HMRC_STATEMENTS } from "@/lib/hmrc-statement";

// Three radios rather than an A/B/C dropdown: nobody remembers which letter
// they ticked, but everyone recognises their own situation when they read it
// back. Getting this wrong means the wrong tax code on the first payslip.
export function HmrcStatementPicker({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <fieldset className="flex flex-col gap-2">
      {HMRC_STATEMENTS.map((s) => (
        <label
          key={s.value}
          className="flex items-start gap-3 rounded-md border border-border p-3 text-sm hover:border-accent"
        >
          <input
            type="radio"
            name="hmrc_statement"
            value={s.value}
            defaultChecked={defaultValue === s.value}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{s.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{s.detail}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
