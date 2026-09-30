import "server-only";

import { requireUser } from "@/lib/auth";
import { documentsWithUrls } from "@/lib/onboarding/details";
import type { BankChangeRequest, EmployeeDetails, EmployeeDocument } from "@/lib/types";
import type { ViewMap } from "./types";

export const views = {
  // /my-details — your own staff record, shared documents and bank-change
  // requests. Document links are signed and short-lived: each fetch mints
  // fresh ones, and the page refetches every time it's opened, so a stale
  // cached link is only ever on screen for a moment.
  details: async () => {
    const { supabase, user } = await requireUser();

    const [{ data: details }, { data: bankRequests }, { data: documents }] = await Promise.all([
      supabase.from("employee_details").select("*").eq("staff_id", user.id).maybeSingle<EmployeeDetails>(),
      supabase
        .from("bank_change_requests")
        .select("*")
        .eq("staff_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(5)
        .returns<BankChangeRequest[]>(),
      // RLS already limits this to documents shared with them — anything filed
      // as internal never reaches the query.
      supabase
        .from("employee_documents")
        .select("*")
        .eq("staff_id", user.id)
        .order("created_at", { ascending: false })
        .returns<EmployeeDocument[]>(),
    ]);

    const myDocuments = await documentsWithUrls(documents ?? []);

    return {
      // Only what the page shows — not the whole onboarding record.
      details: details
        ? {
            full_name: details.full_name,
            start_date: details.start_date,
            date_of_birth: details.date_of_birth,
            ni_number: details.ni_number,
            home_address: details.home_address,
            mobile_phone: details.mobile_phone,
            emergency_contact_name: details.emergency_contact_name,
            emergency_contact_phone: details.emergency_contact_phone,
            emergency_contact_email: details.emergency_contact_email,
            bank_name: details.bank_name,
            bank_sort_code: details.bank_sort_code,
            bank_account_number: details.bank_account_number,
          }
        : null,
      bankRequests: (bankRequests ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        bank_name: r.bank_name,
        bank_sort_code: r.bank_sort_code,
        bank_account_number: r.bank_account_number,
        requested_at: r.requested_at,
        reviewed_at: r.reviewed_at,
        reviewed_by_name: r.reviewed_by_name,
        review_note: r.review_note,
      })),
      documents: myDocuments.map((d) => ({
        id: d.id,
        document_type: d.document_type,
        file_name: d.file_name,
        created_at: d.created_at,
        url: d.url,
      })),
    };
  },
} satisfies ViewMap;
