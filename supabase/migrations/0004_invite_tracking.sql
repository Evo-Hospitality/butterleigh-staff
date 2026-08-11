-- Decouples "create a staff record" from "send them a login invite" so an
-- admin can set someone up in advance and invite them later, or resend if
-- the first email got lost.
alter table profiles add column invited_at timestamptz;
