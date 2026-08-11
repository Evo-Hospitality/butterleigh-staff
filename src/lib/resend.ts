import "server-only";

import { Resend } from "resend";

export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export const NOTIFICATIONS_FROM_ADDRESS = "Butterleigh Inn Staff Portal <notifications@butterleighinnstaff.co.uk>";
