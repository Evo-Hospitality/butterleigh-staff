// Shown on both the feed and the submit form. Shared rather than duplicated
// so the terms can't drift apart between the two — this is a payment promise,
// and two versions of it would eventually disagree.
export function SocialPhotoIncentive() {
  return (
    <div className="mb-6 max-w-2xl rounded-lg border border-accent bg-accent/5 p-4">
      <p className="mb-1 font-semibold text-primary">
        £1 for every photo of yours we use on socials
      </p>
      <p className="text-sm text-muted-foreground">
        Snap anything that shows the place off — the food, the bar, the garden, a busy night, the
        dog by the fire. Upload as many as you like. Anything we post gets marked here, and
        you&apos;ll see the tick against your photo.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Paid to hourly staff through payroll, in the month the photo is marked as used. Salaried
        staff are very welcome to submit photos, but the £1 doesn&apos;t apply.
      </p>
    </div>
  );
}
