-- Pin SOPs/FAQs to the top of the list. Set when pinned (so pinned ones keep
-- the order they were pinned in), null when not. Managers already have update
-- rights on sop_entries (sop_entries_update / can_manage_sops()), so pinning
-- needs no new policy.

alter table sop_entries add column pinned_at timestamptz;
