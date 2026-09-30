// Shown the instant a link is tapped while the next page loads — a page-shaped
// placeholder rather than a blank screen, so navigation feels immediate.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-label="Loading">
      <div className="mb-6 h-8 w-48 rounded-md bg-border/60" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-lg bg-border/40" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-12 rounded-md bg-border/40" />
        ))}
      </div>
    </div>
  );
}
