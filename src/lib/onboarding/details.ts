import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EmployeeDocument } from "@/lib/types";
import { accountNumberDigits, formatSortCode } from "@/lib/bank-details";

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
    // Normalised here rather than trusted from the form, so a paste that
    // dodges the input's own formatting still lands as 12-34-56.
    bank_sort_code: formatSortCode(String(formData.get("bank_sort_code") ?? "")),
    // Digits only, and never parsed as a number — a leading zero is common
    // and dropping it would send the wages nowhere.
    bank_account_number: accountNumberDigits(String(formData.get("bank_account_number") ?? "")),
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

// The picker has already put the files in storage by the time the form is
// submitted; all that's left is to record them. Anything malformed is
// dropped rather than throwing — a bad hidden field shouldn't lose the rest
// of a submission.
export type PendingDocument = { path: string; file_name: string };

export function readPendingDocuments(formData: FormData): PendingDocument[] {
  const raw = String(formData.get("documents_json") ?? "");
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (d): d is PendingDocument =>
          !!d &&
          typeof d === "object" &&
          typeof (d as PendingDocument).path === "string" &&
          !!(d as PendingDocument).path,
      )
      .map((d) => ({ path: d.path, file_name: d.file_name || "Document" }));
  } catch {
    return [];
  }
}

export function documentsStillUploading(formData: FormData): boolean {
  return String(formData.get("documents_uploading") ?? "") === "1";
}

export async function saveEmployeeDocuments(
  supabase: SupabaseClient,
  staffId: string,
  documents: PendingDocument[],
  uploadedBy: { id: string; name: string },
  options: { documentType?: string; visibleToStaff?: boolean } = {},
): Promise<void> {
  if (documents.length === 0) return;

  const { error } = await supabase.from("employee_documents").insert(
    documents.map((d) => ({
      staff_id: staffId,
      path: d.path,
      file_name: d.file_name,
      document_type: options.documentType ?? "HMRC Starter Checklist",
      // Defaults to false so an admin filing something has to decide to
      // share it. A starter uploading their own form passes true.
      visible_to_staff: options.visibleToStaff ?? false,
      uploaded_by: uploadedBy.id,
      uploaded_by_name: uploadedBy.name,
    })),
  );
  if (error) {
    throw new Error(error.message);
  }
}

// Admin-filed documents live outside the employee's own storage folder, so
// that an internal one can't be read straight from storage (0036).
export function adminDocumentPrefix(staffId: string): string {
  return `admin/${staffId}`;
}

export async function documentTypeNames(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("employee_document_types")
    .select("name")
    .eq("active", true)
    .order("sort_order")
    .returns<{ name: string }[]>();
  return (data ?? []).map((t) => t.name);
}

// A type typed into the "new type" box is added to the shared list, so the
// next person filing the same thing finds it in the dropdown.
export async function resolveDocumentType(
  supabase: SupabaseClient,
  formData: FormData,
): Promise<string> {
  const created = String(formData.get("new_document_type") ?? "").trim();
  const chosen = String(formData.get("document_type") ?? "").trim();
  if (!created) {
    return chosen || "Other";
  }

  const { data: existing } = await supabase
    .from("employee_document_types")
    .select("name")
    .ilike("name", created)
    .maybeSingle<{ name: string }>();
  if (existing) {
    return existing.name;
  }

  await supabase.from("employee_document_types").insert({ name: created, sort_order: 500 });
  return created;
}

// Each row gets its own short-lived link, minted per page view.
export async function documentsWithUrls(
  documents: EmployeeDocument[],
): Promise<(EmployeeDocument & { url: string | null })[]> {
  return Promise.all(
    documents.map(async (d) => ({ ...d, url: await signedDocumentUrl(d.path) })),
  );
}
