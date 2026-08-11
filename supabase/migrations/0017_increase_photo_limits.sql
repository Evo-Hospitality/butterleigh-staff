-- Modern phone camera photos routinely exceed 5MB — raise the cap to 15MB
-- across all three photo buckets to match the app-side validation change
-- (lib/maintenance/storage.ts, components/sop-block-editor.tsx,
-- components/event-photo-picker.tsx). Without this, Storage itself would
-- still reject anything over 5MB regardless of what the client allows.
update storage.buckets
set file_size_limit = 15728640
where id in ('maintenance-photos', 'sop-photos', 'event-photos');
