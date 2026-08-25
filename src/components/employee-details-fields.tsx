import type { EmployeeDetails } from "@/lib/types";
import { AccountNumberInput, SortCodeInput } from "./bank-inputs";
import { NiNumberInput } from "./ni-number-input";
import { PhoneInput } from "./phone-input";
import { AddressInput } from "./address-input";
import { NameInput } from "./name-input";

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {!required && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}
      </label>
      {hint && <p className="mb-1 text-xs text-muted-foreground">{hint}</p>}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
    </div>
  );
}

// Shared by the new-starter form and the later "my details" screen, so the
// two can't ask for the same thing in different ways.
export function PersonalFields({ details, email }: { details: EmployeeDetails | null; email: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Full name</label>
        <NameInput name="full_name" defaultValue={details?.full_name} />
      </div>
      <Field label="Start date" name="start_date" type="date" defaultValue={details?.start_date} />
      <Field
        label="Date of birth"
        name="date_of_birth"
        type="date"
        defaultValue={details?.date_of_birth}
        hint="Double-check the year — it's the most common mistake on this form."
      />
      <div>
        <label className="mb-1 block text-sm font-medium">National Insurance number</label>
        <p className="mb-1 text-xs text-muted-foreground">
          On your payslip, P60, or in your HMRC app. Nine characters, no spaces — like QQ123456C
        </p>
        <NiNumberInput defaultValue={details?.ni_number} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Home address</label>
        <AddressInput defaultValue={details?.home_address} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Mobile phone number</label>
        <PhoneInput name="mobile_phone" defaultValue={details?.mobile_phone} />
      </div>
      <Field
        label="Email address"
        name="email"
        type="email"
        defaultValue={email}
        hint="This is also how you sign in — changing it changes your login."
      />
    </div>
  );
}

export function EmergencyFields({ details }: { details: EmployeeDetails | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Emergency contact name</label>
        <NameInput name="emergency_contact_name" defaultValue={details?.emergency_contact_name} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Emergency contact phone number</label>
        <PhoneInput
          name="emergency_contact_phone"
          defaultValue={details?.emergency_contact_phone}
        />
      </div>
      <Field
        label="Emergency contact email"
        name="emergency_contact_email"
        type="email"
        defaultValue={details?.emergency_contact_email}
      />
    </div>
  );
}

export function BankFields({ details }: { details: EmployeeDetails | null }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Bank name" name="bank_name" defaultValue={details?.bank_name} />
      <div>
        <label className="mb-1 block text-sm font-medium">Sort code</label>
        <p className="mb-1 text-xs text-muted-foreground">Six digits, e.g. 12-34-56</p>
        <SortCodeInput defaultValue={details?.bank_sort_code} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Account number</label>
        <p className="mb-1 text-xs text-muted-foreground">
          Eight digits — include the leading zero if yours has one
        </p>
        <AccountNumberInput defaultValue={details?.bank_account_number} />
      </div>
    </div>
  );
}
