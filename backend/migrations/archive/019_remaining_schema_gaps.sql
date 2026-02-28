-- ============================================================
-- Migration 019: Remaining schema gaps from left.txt Part 5
-- Covers: TASK-R12-011, R13-010, R9-019, R14-008, R16-012,
--         R15-010, R15-012, R15-016, R17-012, R17-014,
--         R15-001, R15-002, R15-007, R8-013, R7-004,
--         R13-013, R13-014, R14-004, R14-002/R14-005
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TASK-R12-011: Webhook events idempotency table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID REFERENCES organizations(id),
  carrier_id        UUID REFERENCES carriers(id),
  external_event_id VARCHAR(255) NOT NULL,
  event_type        VARCHAR(100) NOT NULL,
  payload           JSONB,
  processed_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Unique per org+carrier+external event — prevents double-processing
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_external
  ON webhook_events (organization_id, carrier_id, external_event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_events_carrier_type
  ON webhook_events (carrier_id, event_type, created_at DESC);

COMMENT ON TABLE webhook_events IS
  'Idempotency log for incoming carrier webhooks. Insert before processing; if conflict, skip. (TASK-R12-011)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R13-010: Inventory reservations table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  inventory_id    UUID REFERENCES inventory(id),
  warehouse_id    UUID REFERENCES warehouses(id),
  sku             VARCHAR(100),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved', 'committed', 'released', 'expired')),
  reserved_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,               -- NULL = no expiry
  committed_at    TIMESTAMPTZ,
  released_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order
  ON inventory_reservations (order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_inventory
  ON inventory_reservations (inventory_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires
  ON inventory_reservations (expires_at) WHERE expires_at IS NOT NULL AND status = 'reserved';

COMMENT ON TABLE inventory_reservations IS
  'Tracks per-order inventory reservations: reserve on create, commit on ship, release on cancel. (TASK-R13-010)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R9-019: Finance audit log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  entity_type   VARCHAR(50) NOT NULL,   -- 'invoice' | 'refund' | 'dispute'
  entity_id     UUID NOT NULL,
  action        VARCHAR(100) NOT NULL,  -- 'status_change' | 'refund_processed' | 'dispute_resolved'
  old_values    JSONB,
  new_values    JSONB,
  actor_id      UUID REFERENCES users(id),
  actor_role    VARCHAR(50),
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_entity
  ON finance_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_audit_org
  ON finance_audit_log (organization_id, created_at DESC);

COMMENT ON TABLE finance_audit_log IS
  'Immutable audit trail for all financial mutations (TASK-R9-019)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R14-008: Exception assignment history
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exception_assignment_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id    UUID NOT NULL REFERENCES exceptions(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES users(id),
  assigned_by     UUID REFERENCES users(id),
  unassigned_at   TIMESTAMPTZ,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exception_assignment_history_exception
  ON exception_assignment_history (exception_id, created_at DESC);

COMMENT ON TABLE exception_assignment_history IS
  'Full audit trail for exception assignments (TASK-R14-008)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R16-012: carrier_pickup_notes on returns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS carrier_pickup_notes TEXT;

COMMENT ON COLUMN returns.carrier_pickup_notes IS
  'Notes from the carrier on pickup (TASK-R16-012)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R15-010: Worker heartbeat on background_jobs
-- ─────────────────────────────────────────────────────────────
ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS worker_id       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS heartbeat_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_background_jobs_worker
  ON background_jobs (worker_id, heartbeat_at DESC) WHERE worker_id IS NOT NULL;

COMMENT ON COLUMN background_jobs.worker_id IS
  'ID of the worker process currently executing this job (TASK-R15-010)';
COMMENT ON COLUMN background_jobs.heartbeat_at IS
  'Last heartbeat from the worker; used to detect stalled jobs (TASK-R15-010)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R15-012: organization_id on background_jobs + dead_letter_queue
-- ─────────────────────────────────────────────────────────────
ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

ALTER TABLE dead_letter_queue
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

CREATE INDEX IF NOT EXISTS idx_background_jobs_org
  ON background_jobs (organization_id, status) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dlq_org
  ON dead_letter_queue (organization_id) WHERE organization_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TASK-R15-016: deduplication_key on notifications
-- ─────────────────────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS deduplication_key VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedup_key
  ON notifications (organization_id, deduplication_key)
  WHERE deduplication_key IS NOT NULL;

COMMENT ON COLUMN notifications.deduplication_key IS
  'Caller-supplied key; unique per org to prevent duplicate notification sends (TASK-R15-016)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R17-012: next_sla_check_at on shipments
-- ─────────────────────────────────────────────────────────────
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS next_sla_check_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shipments_next_sla_check
  ON shipments (next_sla_check_at)
  WHERE next_sla_check_at IS NOT NULL AND status NOT IN ('delivered', 'cancelled', 'returned');

COMMENT ON COLUMN shipments.next_sla_check_at IS
  'When the SLA monitor should next evaluate this shipment; filters out idle rows (TASK-R17-012)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R17-014: pick_list_number sequence
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS pick_list_number_seq
  START WITH 1000
  INCREMENT BY 1
  NO CYCLE;

COMMENT ON SEQUENCE pick_list_number_seq IS
  'Atomic pick list number generator — prevents collision on concurrent picks (TASK-R17-014)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R15-001: invoice_number sequence
-- ─────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq
  START WITH 100000
  INCREMENT BY 1
  NO CYCLE;

COMMENT ON SEQUENCE invoice_number_seq IS
  'Atomic invoice number generator — prevents gaps and collisions (TASK-R15-001)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R15-002: UNIQUE on invoices (carrier + billing period)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only add if the columns exist (graceful on older schemas)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices'
      AND column_name = 'billing_period_start'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_carrier_period
      ON invoices (carrier_id, billing_period_start, billing_period_end);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- TASK-R15-007: dispute columns on invoices
-- ─────────────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS dispute_reason   TEXT,
  ADD COLUMN IF NOT EXISTS disputed_by      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS disputed_at      TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────
-- TASK-R8-013: GIN index on warehouse.address JSONB
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_warehouses_address_gin
  ON warehouses USING GIN (address jsonb_path_ops)
  WHERE address IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TASK-R7-004: Trigram indexes on order_number, tracking_number
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_orders_order_number_trgm
  ON orders USING GIN (order_number gin_trgm_ops)
  WHERE order_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number_trgm
  ON shipments USING GIN (tracking_number gin_trgm_ops)
  WHERE tracking_number IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TASK-R13-013 / R13-014: allocation_rules round-robin + weight columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE allocation_rules
  ADD COLUMN IF NOT EXISTS weight               NUMERIC(5,2) DEFAULT 1.0 CHECK (weight > 0),
  ADD COLUMN IF NOT EXISTS last_rr_warehouse_id UUID REFERENCES warehouses(id);

COMMENT ON COLUMN allocation_rules.weight IS
  'Relative weight for weighted-round-robin warehouse selection (TASK-R13-014)';
COMMENT ON COLUMN allocation_rules.last_rr_warehouse_id IS
  'The warehouse chosen last for this rule; used to advance the round-robin cursor (TASK-R13-013)';

-- ─────────────────────────────────────────────────────────────
-- TASK-R14-004 / R14-002 / R14-005: GST rate + zone columns on rate_cards
-- ─────────────────────────────────────────────────────────────
ALTER TABLE rate_cards
  ADD COLUMN IF NOT EXISTS gst_rate   NUMERIC(5,4) DEFAULT 0.18 CHECK (gst_rate >= 0 AND gst_rate <= 1),
  ADD COLUMN IF NOT EXISTS zone       VARCHAR(50);

COMMENT ON COLUMN rate_cards.gst_rate IS
  'GST rate as a decimal fraction (0.18 = 18%). Configurable per rate card (TASK-R14-004)';
COMMENT ON COLUMN rate_cards.zone IS
  'Delivery zone identifier (local/regional/national/international) for zone-based pricing (TASK-R14-002/R14-005)';

CREATE INDEX IF NOT EXISTS idx_rate_cards_zone
  ON rate_cards (carrier_id, zone) WHERE zone IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- TASK-R6-012 (complementary): CHECK constraint on inventory
-- quantity = available + reserved + damaged + in_transit
-- (Also see migration 012_misc_constraints.sql for the index side)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_inventory_quantity_invariant'
      AND table_name = 'inventory'
  ) THEN
    ALTER TABLE inventory
      ADD CONSTRAINT chk_inventory_quantity_invariant
      CHECK (quantity = available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity);
  END IF;
END $$;
