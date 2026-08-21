import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

// Reading these fields out of a form, in one place, so the onboarding form
// and the later "my details" edits can't drift apart on trimming or which
// blank means null.
export type DetailFields = {
  full_name: string;
  start_date: string;
  ni_number: string;
  date_of_birth: string;
  home_address: string;
  mobile_phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_email: string;
};

const TEXT_FIELDS: (keyof DetailFields)[] = [
  "full_name",
  "start_date",
  "ni_number",
  "date_of_birth",
  "home_address",
  "mobile_phone",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_email",
];

export function readDetailFields(formData: FormData): DetailFields {
  const out = {} as DetailFields;
  for (const key of TEXT_FIELDS) {
    out[key] = String(formData.get(key) ?? "").trim();
  }
  return out;
}

// The form says "complete ALL the following fields", so everything is
// required — ClickUp only starred three, but a missing NI number or bank
// account stops payroll just as dead.
export function missingFields(fields: DetailFields, bank: BankFields): string[] {
  const labels: Record<string, string> = {
    full_name: "Full name",
    start_date: "Start date",
    ni_number: "National Insurance number",
    date_of_birth: "Date of birth",
    home_address: "Home address",
    mobile_phone: "Mobile phone number",
    emergency_contact_name: "Emergency contact name",
    emergency_contact_phone: "Emergency contact phone number",
    emergency_contact_email: "Emergency contact email",
    bank_name: "Bank name",
    bank_sort_code: "Sort code",
    bank_account_number: "Account number",
  };

  const all = { ...fields, ...bank } as Record<string, string>;
  return Object.entries(labels)
    .filter(([key]) => !all[key])
    .map(([, label]) => label);
}

export type BankFields = {
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
};

export function readBankFields(formData: FormData): BankFields {
  return {
    bank_name: String(formData.get("bank_name") ?? "").trim(),
    bank_sort_code: String(formData.get("bank_sort_code") ?? "").trim(),
    bank_account_number: String(formData.get("bank_account_number") ?? "").trim(),
  };
}

// Digits only, so "12-34-56" and "123456" compare equal — otherwise a
// reformatted sort code would look like a bank change and trigger a phone
// call for nothing.
export function normaliseBank(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

type NullableBankFields = {
  bank_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
};

export function bankDetailsChanged(a: BankFields, b: NullableBankFields | null | undefined): boolean {
  if (!b) return true;
  return (
    (a.bank_name ?? "").trim().toLowerCase() !== (b.bank_name ?? "").trim().toLowerCase() ||
    normaliseBank(a.bank_sort_code) !== normaliseBank(b.bank_sort_code) ||
    normaliseBank(a.bank_account_number) !== normaliseBank(b.bank_account_number)
  );
}

// The bucket is private, so there's no public URL — an admin viewing a
// checklist gets a short-lived signed one, minted per view.
export async function signedDocumentUrl(path: string, seconds = 300): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from("employee-documents").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

// Uploads go to <uid>/<random>.<ext>, which is what the storage policy
// checks — the folder name must be the uploader's own id.
export async function uploadEmployeeDocument(
  supabase: SupabaseClient,
  staffId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${staffId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("employee-documents")
    .upload(path, file, { contentType: file.type });
  if (error) {
    throw new Error(error.message);
  }
  return path;
}
