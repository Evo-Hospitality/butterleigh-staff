"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { updateStaffEmail } from "@/lib/holiday/staff";
import { bankDetailsChanged, readBankFields } from "@/lib/onboarding/details";
import { isCompleteAccountNumber, isCompleteSortCode } from "@/lib/bank-details";
import { formatUkPhone } from "@/lib/phone";
import { formatAddress } from "@/lib/address";
import { notifyBankChangeRequested } from "@/lib/onboarding/notifications";
import type { EmployeeDetails } from "@/lib/types";

function fail(message: string): never {
  redirect(`/my-details?error=${encodeURIComponent(message)}`);
}

// The contact half of the record — safe to change on the spot. Bank details
// deliberately aren't here.
export async function updateMyContactDetailsAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const home_address = formatAddress(String(formData.get("home_address") ?? ""));
  const mobile_phone = formatUkPhone(String(formData.get("mobile_phone") ?? ""));
  const emergency_contact_name = String(formData.get("emergency_contact_name") ?? "").trim();
  const emergency_contact_phone = formatUkPhone(String(formData.get("emergency_contact_phone") ?? ""));
  const emergency_contact_email = String(formData.get("emergency_contact_email") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!home_address || !mobile_phone || !emergency_contact_name || !emergency_contact_phone) {
    fail("Address, mobile number and emergency contact name and number are all needed.");
  }
  if (!email) {
    fail("An email address is needed — it's how you sign in.");
  }

  const { data: existing } = await supabase
    .from("employee_details")
    .select("id")
    .eq("staff_id", user.id)
    .maybeSingle<{ id: string }>();

  const row = {
    staff_id: user.id,
    home_address,
    mobile_phone,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_email,
    updated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from("employee_details").update(row).eq("staff_id", user.id)
    : await supabase.from("employee_details").insert(row);
  if (error) {
    fail(error.message);
  }

  if (email.toLowerCase() !== profile.email.toLowerCase()) {
    try {
      await updateStaffEmail(user.id, email);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Could not update the email address.");
    }
  }

  revalidatePath("/my-details");
  redirect("/my-details?saved=1");
}

// Never writes to employee_details — it raises a request an admin has to
// approve after ringing the employee. A compromised mailbox alone shouldn't
// be enough to redirect someone's wages.
export async function requestBankChangeAction(formData: FormData) {
  const { supabase, user, profile } = await requireUser();

  const bank = readBankFields(formData);
  if (!bank.bank_name || !bank.bank_sort_code || !bank.bank_account_number) {
    fail("All three bank fields are needed.");
  }
  if (!isCompleteSortCode(bank.bank_sort_code)) {
    fail("A sort code is six digits, like 12-34-56.");
  }
  if (!isCompleteAccountNumber(bank.bank_account_number)) {
    fail("An account number is eight digits — include the leading zero if yours has one.");
  }

  const { data: details } = await supabase
    .from("employee_details")
    .select("*")
    .eq("staff_id", user.id)
    .maybeSingle<EmployeeDetails>();

  if (!bankDetailsChanged(bank, details)) {
    fail("Those are the details we already hold — nothing to change.");
  }

  const { data: pending } = await supabase
    .from("bank_change_requests")
    .select("id")
    .eq("staff_id", user.id)
    .eq("status", "pending")
    .maybeSingle<{ id: string }>();
  if (pending) {
    fail("You've already got a bank change waiting to be approved.");
  }

  const { error } = await supabase.from("bank_change_requests").insert({
    staff_id: user.id,
    staff_name: profile.full_name,
    ...bank,
    previous_bank_name: details?.bank_name ?? null,
    previous_bank_sort_code: details?.bank_sort_code ?? null,
    previous_bank_account_number: details?.bank_account_number ?? null,
    status: "pending",
  });
  if (error) {
    fail(error.message);
  }

  await notifyBankChangeRequested(profile.full_name, details?.mobile_phone ?? null);

  revalidatePath("/my-details");
  redirect("/my-details?bank=1");
}
