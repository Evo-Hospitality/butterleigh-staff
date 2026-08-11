import { requireUser } from "@/lib/auth";
import { RequestForm } from "./request-form";

export default async function RequestHolidayPage() {
  const { profile } = await requireUser();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-primary">Request holiday</h1>
      <RequestForm profile={profile} />
    </div>
  );
}
