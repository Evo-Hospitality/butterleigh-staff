-- Editing a published SOP replaces its blocks wholesale (delete + reinsert)
-- rather than diffing — needs a delete policy that didn't exist yet.
create policy "sop_blocks_delete"
  on sop_blocks for delete
  to authenticated
  using (can_manage_sops());
