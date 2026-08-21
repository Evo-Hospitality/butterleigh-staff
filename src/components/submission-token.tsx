"use client";

import { useState } from "react";

// Client-side twin of the inline `crypto.randomUUID()` hidden field used in
// Server Component forms. Needed wherever the form is a client component:
// the token must survive re-renders (a keystroke re-rendering the form must
// not mint a new one), which useState's lazy initialiser guarantees. One
// token per mount — navigating away and back gives a fresh one, so a
// deliberate second submission still works.
export function SubmissionToken() {
  const [token] = useState(() => crypto.randomUUID());
  return <input type="hidden" name="submission_token" value={token} />;
}
