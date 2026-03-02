-- Migration 034: Link shipments to matched SLA policy
-- Every shipment now records which SLA policy was matched at creation time.
-- delivery_scheduled is set from policy.delivery_hours; NULL means no policy matched (system fallback used).

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS sla_policy_id UUID
    REFERENCES sla_policies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_sla_policy
  ON shipments(sla_policy_id) WHERE sla_policy_id IS NOT NULL;

COMMENT ON COLUMN shipments.sla_policy_id IS
  'The SLA policy that was matched and applied when this shipment was created. NULL = system fallback (72h) was used.';
