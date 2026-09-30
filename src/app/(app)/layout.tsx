import { AppShell } from "./app-shell";

// No server work here: the proxy has already checked the visitor is signed in,
// and the shell draws itself in the browser from cached data (the password
// and onboarding gates live there now). Keeping this layout free of
// cookies/database reads lets pages be served ready-made.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
