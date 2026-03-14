-- =============================================================================
-- Migration 006 — Schema Cleanup & Architecture Alignment
-- Based on: AUDIT.md decisions (Iterations 1-3 + Superadmin Audit)
-- Date: 2026-03-14
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: DROP UNUSED TABLES
-- =============================================================================

-- A1: order_splits — zero backend code, misleading dead weight
DROP TABLE IF EXISTS public.order_splits CASCADE;

-- A2: shipping_estimates — never queried, overlaps with carrier_quotes + SLA
DROP TABLE IF EXISTS public.shipping_estimates CASCADE;

-- A4: user_permissions — RBAC is role-based in config/permissions.js, per-user overrides = audit nightmare
DROP TABLE IF EXISTS public.user_permissions CASCADE;

-- A5: allocation_rules — too early for configurable rules, keeping allocation_history for audit
DROP TABLE IF EXISTS public.allocation_rules CASCADE;

-- A6: carrier_capacity_log — time-series trend logging not current req; carriers.current_load is sufficient
DROP TABLE IF EXISTS public.carrier_capacity_log CASCADE;

-- A10: alert_rules — no UI, no backend reads it; alerts table kept (it IS used)
DROP TABLE IF EXISTS public.alert_rules CASCADE;

-- A11: pick_lists/pick_list_items — useful only with WMS bin tracking; without shelf/location data it's a packing slip restatement
DROP TABLE IF EXISTS public.pick_list_items CASCADE;
DROP TABLE IF EXISTS public.pick_lists CASCADE;


-- =============================================================================
-- SECTION 2: DROP UNUSED COLUMNS
-- =============================================================================

-- B2: orders.supplier_id — outbound orders don't have a supplier; inbound is modeled via restock_orders (see Section 4)
ALTER TABLE public.orders DROP COLUMN IF EXISTS supplier_id;

-- B6: returns.items jsonb — return_items table is the normalized source of truth; jsonb column is redundant
ALTER TABLE public.returns DROP COLUMN IF EXISTS items;


-- =============================================================================
-- SECTION 3: MODIFY EXISTING TABLES
-- =============================================================================

-- ---- organizations: add soft-delete support (required for superadmin tenant suspension) ----
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS suspension_reason text,
    ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organizations.is_deleted IS 'Soft delete flag — tenant permanently removed by superadmin';
COMMENT ON COLUMN public.organizations.suspension_reason IS 'Reason for suspension (non-payment, policy violation, etc.)';
COMMENT ON COLUMN public.organizations.suspended_at IS 'Timestamp when tenant was suspended; NULL means active';

-- ---- warehouses: add CHECK constraint for warehouse_type ----
-- First drop the old default so we can clean up the value
ALTER TABLE public.warehouses ALTER COLUMN warehouse_type SET DEFAULT 'fulfillment';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'warehouses_warehouse_type_check'
            AND conrelid = 'public.warehouses'::regclass
    ) THEN
        ALTER TABLE public.warehouses
            ADD CONSTRAINT warehouses_warehouse_type_check
            CHECK (warehouse_type IN (
                'standard', 'fulfillment', 'distribution',
                'cold_storage', 'hazmat', 'bonded_customs', 'returns_center'
            ));
    END IF;
END $$;

COMMENT ON COLUMN public.warehouses.warehouse_type IS 'standard | fulfillment | distribution | cold_storage | hazmat | bonded_customs | returns_center';

-- ---- orders: simplify order_type CHECK constraint ----
-- Drop old CHECK constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;

-- Add new simplified CHECK (outbound = customer sale; transfer = warehouse-to-warehouse; inbound_restock = supplier inbound)
ALTER TABLE public.orders
    ADD CONSTRAINT orders_order_type_check
    CHECK (order_type IN ('outbound', 'transfer', 'inbound_restock'));

-- Update existing values from deprecated names
UPDATE public.orders SET order_type = 'outbound' WHERE order_type IN ('regular', 'cod');
UPDATE public.orders SET order_type = 'inbound_restock' WHERE order_type = 'replacement';

ALTER TABLE public.orders ALTER COLUMN order_type SET DEFAULT 'outbound';

-- Update the comment to reflect new values
COMMENT ON COLUMN public.orders.order_type IS 'outbound = customer sale; transfer = warehouse-to-warehouse stock movement; inbound_restock = supplier PO inbound';

-- ---- orders: also update priority CHECK — keep column for transfer/inbound, default standard for all ----
-- No constraint change needed; same_day is fine to keep as an allowed value for future use.
-- Just update the comment.
COMMENT ON COLUMN public.orders.priority IS 'Used for transfer and inbound_restock urgency. Outbound defaults to standard (not shown in customer UI).';

-- ---- returns: remove restocked status from CHECK — restocking is an inventory event, not a return status ----
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns
    ADD CONSTRAINT returns_status_check
    CHECK (status IN (
        'requested', 'approved', 'rejected',
        'pickup_scheduled', 'picked_up',
        'in_transit', 'received',
        'inspecting', 'inspection_passed', 'inspection_failed',
        'refunded'
    ));

COMMENT ON COLUMN public.returns.status IS 'requested→approved/rejected→pickup_scheduled→picked_up→in_transit→received→inspecting→inspection_passed/failed→refunded. Restocking is triggered by inspection_passed as inventory event, not a status here.';

-- ---- exceptions: add ticket_number for customer-facing communication ----
CREATE SEQUENCE IF NOT EXISTS public.exception_ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE public.exceptions
    ADD COLUMN IF NOT EXISTS ticket_number varchar(30) UNIQUE;

-- Generate ticket numbers for existing rows (format: EX-YYYYMMDD-NNNN)
UPDATE public.exceptions
SET ticket_number = 'EX-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || LPAD(nextval('public.exception_ticket_seq')::text, 4, '0')
WHERE ticket_number IS NULL;

-- Create function for auto-generating ticket numbers on INSERT
CREATE OR REPLACE FUNCTION public.generate_exception_ticket() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := 'EX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                             LPAD(nextval('public.exception_ticket_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exception_ticket ON public.exceptions;
CREATE TRIGGER trg_exception_ticket
    BEFORE INSERT ON public.exceptions
    FOR EACH ROW EXECUTE FUNCTION public.generate_exception_ticket();

COMMENT ON COLUMN public.exceptions.ticket_number IS 'Customer-facing ticket ID, e.g. EX-20260314-0001. Auto-generated on INSERT.';

-- ---- Update transfer_orders VIEW to use new order_type value ----
-- View already references order_type = 'transfer' which is still valid — no change needed.

-- ---- carrier_quotes: we are KEEPING this table (bidding window flow) ----
-- Add bidding_window columns if not present (the table already has expires_at which serves as window end)
-- Add organization_id for multi-tenant scoping
ALTER TABLE public.carrier_quotes
    ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

COMMENT ON TABLE public.carrier_quotes IS 'Carrier bid responses during the assignment bidding window. When window closes (expires_at), best quote by (SLA risk + price + reliability) is selected and shipment is created.';
COMMENT ON COLUMN public.carrier_quotes.was_selected IS 'TRUE for the winning bid; FALSE for all others in the window.';
COMMENT ON COLUMN public.carrier_quotes.selection_reason IS 'Why selected: best_price, best_speed, best_balance, reliability, only_option';


-- =============================================================================
-- SECTION 4: ADD NEW TABLES
-- =============================================================================

-- ---- restock_orders: dedicated inbound supplier order flow (replaces orders.supplier_id) ----
CREATE TABLE IF NOT EXISTS public.restock_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    restock_number varchar(50) UNIQUE,
    supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    destination_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
    status varchar(50) NOT NULL DEFAULT 'draft',
    is_auto_generated boolean DEFAULT false,
    trigger_reason varchar(100), -- 'low_stock_alert', 'manual', 'scheduled'
    priority varchar(20) DEFAULT 'standard',
    -- Financial
    total_items integer DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    currency varchar(3) DEFAULT 'INR',
    -- Dates
    requested_at timestamp with time zone DEFAULT now(),
    confirmed_at timestamp with time zone,
    expected_arrival timestamp with time zone,
    received_at timestamp with time zone,
    -- Tracking
    supplier_po_number varchar(100), -- Supplier's own PO reference
    tracking_number varchar(100),    -- Carrier tracking from supplier side
    notes text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT restock_orders_status_check CHECK (status IN (
        'draft', 'submitted', 'confirmed', 'in_transit', 'received', 'cancelled'
    )),
    CONSTRAINT restock_orders_priority_check CHECK (priority IN (
        'standard', 'express', 'urgent'
    ))
);

CREATE TABLE IF NOT EXISTS public.restock_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restock_order_id uuid NOT NULL REFERENCES public.restock_orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id),
    sku varchar(100) NOT NULL,
    product_name varchar(255),
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0,
    unit_cost numeric(10,2),
    total_cost numeric(12,2),
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE SEQUENCE IF NOT EXISTS public.restock_order_number_seq
    START WITH 10000 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.generate_restock_number() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.restock_number IS NULL THEN
        NEW.restock_number := 'RST-' || TO_CHAR(NOW(), 'YY') || '-' ||
                              LPAD(nextval('public.restock_order_number_seq')::text, 5, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restock_number ON public.restock_orders;
CREATE TRIGGER trg_restock_number
    BEFORE INSERT ON public.restock_orders
    FOR EACH ROW EXECUTE FUNCTION public.generate_restock_number();

COMMENT ON TABLE public.restock_orders IS 'Inbound supplier purchase orders. Separate from outbound customer orders. Status managed by supplier; SCM tracks expected arrival and receipt confirmation.';

-- Indexes for restock_orders
CREATE INDEX IF NOT EXISTS idx_restock_org ON public.restock_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_restock_supplier ON public.restock_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_restock_warehouse ON public.restock_orders(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_restock_status ON public.restock_orders(status);
CREATE INDEX IF NOT EXISTS idx_restock_items_order ON public.restock_order_items(restock_order_id);


-- ---- organization_audit_logs: superadmin action audit trail ----
CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    action varchar(100) NOT NULL,  -- 'created', 'updated', 'suspended', 'reactivated', 'deleted', 'tier_changed', 'impersonated'
    performed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    performed_by_role varchar(50),  -- snapshot of role at time of action (superadmin users may change)
    ip_address inet,
    user_agent text,
    before_state jsonb,    -- full snapshot of org row before change
    after_state jsonb,     -- full snapshot of org row after change
    metadata jsonb,        -- additional context (e.g., suspension reason, impersonation target user)
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_org_audit_org ON public.organization_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_action ON public.organization_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_org_audit_performed_by ON public.organization_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_org_audit_created ON public.organization_audit_logs(created_at);

COMMENT ON TABLE public.organization_audit_logs IS 'Immutable audit log of all superadmin actions on tenant organizations. Required for compliance and incident investigation.';


-- =============================================================================
-- SECTION 5: ADD MISSING ORG_CODE_SEQ (if applied before migration 005)
-- =============================================================================
-- Migration 005 may have already created this. This is idempotent.
CREATE SEQUENCE IF NOT EXISTS public.org_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- =============================================================================
-- SECTION 6: CLEANUP INDEXES for dropped tables (CASCADE handles most, but be explicit)
-- =============================================================================
-- Note: DROP TABLE ... CASCADE above already drops associated indexes and FKs.
-- No additional cleanup needed.


-- =============================================================================
-- SECTION 7: ADD MISSING INDEXES for kept/new tables
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_webhook_logs_carrier ON public.webhook_logs(carrier_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON public.webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_valid ON public.webhook_logs(signature_valid);

CREATE INDEX IF NOT EXISTS idx_exceptions_ticket ON public.exceptions(ticket_number);
CREATE INDEX IF NOT EXISTS idx_exceptions_org ON public.exceptions(organization_id) WHERE ticket_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carrier_quotes_org ON public.carrier_quotes(organization_id);
CREATE INDEX IF NOT EXISTS idx_carrier_quotes_order ON public.carrier_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_carrier_quotes_window ON public.carrier_quotes(order_id, expires_at) WHERE was_selected IS FALSE;

CREATE INDEX IF NOT EXISTS idx_org_is_deleted ON public.organizations(is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_org_suspended ON public.organizations(suspended_at) WHERE suspended_at IS NOT NULL;

COMMIT;
