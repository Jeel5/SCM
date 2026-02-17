-- ================================================================================
-- TwinChain SCM Database Initialization Script
-- ================================================================================
-- Version: 2.0.0
-- Date: 2026-02-16
-- 
-- ARCHITECTURE:
-- - Multi-tenant support via organization_id
-- - Superadmin role for global platform management
-- - Company admins manage their organization
-- - Comprehensive carrier integration system
-- - Background job processing with DLQ
-- - Real-time tracking and SLA monitoring
--
-- TABLES OVERVIEW:
-- 1. Core: organizations, users, user_permissions, user_settings, user_sessions
-- 2. MDM: warehouses, carriers, rate_cards, products, sla_policies
-- 3. Inventory: inventory, stock_movements
-- 4. Orders: orders, order_items, order_splits
-- 5. Shipping: carrier_assignments, shipments, shipment_events, shipping_estimates
-- 6. Carrier API: carrier_quotes, carrier_rejections, carrier_capacity_log, quote_cache
-- 7. Fulfillment: pick_lists, pick_list_items, allocation_rules, allocation_history
-- 8. Returns: returns, return_items
-- 9. Exceptions & SLA: exceptions, sla_violations, eta_predictions
-- 10. Finance: invoices, invoice_line_items
-- 11. Background Jobs: background_jobs, job_execution_logs, cron_schedules, dead_letter_queue
-- 12. Alerts: alert_rules, alerts
-- 13. Audit: audit_logs, notifications
-- 14. Analytics: carrier_performance_metrics + views
-- ================================================================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. CORE: ORGANIZATIONS & USERS
-- ============================================

-- Organizations (Companies/Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    -- Contact Info
    email VARCHAR(255),
    phone VARCHAR(20),
    website VARCHAR(500),
    -- Address
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    -- Settings
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    currency VARCHAR(3) DEFAULT 'INR',
    logo_url VARCHAR(500),
    -- Status
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'standard', -- starter, standard, enterprise
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Multi-tenant companies using TwinChain platform';

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN (
        'superadmin',        -- Platform admin (no org, global access)
        'admin',             -- Company admin (full org access)
        'operations_manager',-- Day-to-day operations
        'warehouse_manager', -- Warehouse & inventory
        'carrier_partner',   -- Carrier integration
        'finance',           -- Billing & finance
        'customer_support'   -- Customer issues
    )),
    organization_id UUID REFERENCES organizations(id), -- NULL for superadmin
    avatar VARCHAR(500),
    phone VARCHAR(20),
    -- Status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    -- Session
    last_login TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE users IS 'All platform users including superadmin and company users';
COMMENT ON COLUMN users.organization_id IS 'NULL for superadmin who manages all organizations';

-- User Permissions (granular permissions beyond role)
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, permission)
);

-- User Settings (preferences)
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_preferences JSONB DEFAULT '{
        "email_enabled": true,
        "push_enabled": true,
        "sms_enabled": false,
        "order_updates": true,
        "shipment_updates": true,
        "sla_alerts": true,
        "exception_alerts": true
    }'::jsonb,
    ui_preferences JSONB DEFAULT '{
        "theme": "system",
        "sidebar_collapsed": false,
        "dashboard_layout": "default",
        "table_rows_per_page": 20
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Sessions (for session management)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500),
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- desktop, mobile, tablet
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE user_sessions IS 'Active user sessions for security and session management';

-- Audit Logs (system-wide activity tracking)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for compliance and security';

-- ============================================
-- 2. MASTER DATA MANAGEMENT (MDM)
-- ============================================

-- Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    -- Location
    address JSONB NOT NULL, -- {street, city, state, postal_code, country}
    coordinates JSONB,      -- {lat, lng}
    -- Capacity
    capacity INTEGER,            -- Total capacity in units
    current_utilization DECIMAL(5,2) DEFAULT 0, -- Percentage
    -- Management
    manager_id UUID REFERENCES users(id),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    -- Status
    is_active BOOLEAN DEFAULT true,
    warehouse_type VARCHAR(50) DEFAULT 'standard', -- standard, cold_storage, hazmat
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

-- Carriers
CREATE TABLE carriers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id), -- NULL for system-wide carriers
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    -- Service Info
    service_type VARCHAR(50), -- express, standard, bulk, same_day
    service_areas JSONB,      -- Array of serviceable regions/pincodes
    -- Contact
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    website VARCHAR(500),
    -- API Integration
    api_endpoint VARCHAR(500),
    api_key_encrypted VARCHAR(500),
    webhook_url VARCHAR(500),
    -- Performance
    reliability_score DECIMAL(3,2) DEFAULT 0.85 CHECK (reliability_score >= 0 AND reliability_score <= 1),
    avg_delivery_days DECIMAL(4,1),
    -- Capacity
    daily_capacity INTEGER,
    current_load INTEGER DEFAULT 0,
    -- Status
    is_active BOOLEAN DEFAULT true,
    availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'offline', 'maintenance')),
    last_status_change TIMESTAMPTZ DEFAULT NOW(),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

-- Rate Cards (carrier pricing)
CREATE TABLE rate_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
    -- Route
    origin_state VARCHAR(100),
    origin_city VARCHAR(100),
    destination_state VARCHAR(100),
    destination_city VARCHAR(100),
    -- Service
    service_type VARCHAR(50),
    -- Rates
    base_rate DECIMAL(10,2) NOT NULL,
    per_kg_rate DECIMAL(10,2) DEFAULT 0,
    per_km_rate DECIMAL(10,4) DEFAULT 0,
    fuel_surcharge_pct DECIMAL(5,2) DEFAULT 0,
    cod_charge DECIMAL(10,2) DEFAULT 0,
    -- Validity
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    -- Physical
    weight DECIMAL(10,3), -- in kg
    dimensions JSONB,     -- {length, width, height} in cm
    -- Pricing
    unit_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'INR',
    -- Attributes
    attributes JSONB,     -- Custom product attributes
    images JSONB,         -- Array of image URLs
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_fragile BOOLEAN DEFAULT false,
    requires_cold_storage BOOLEAN DEFAULT false,
    is_hazmat BOOLEAN DEFAULT false,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

-- SLA Policies
CREATE TABLE sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    -- Scope
    service_type VARCHAR(50),     -- express, standard, bulk
    origin_region VARCHAR(100),
    destination_region VARCHAR(100),
    -- SLA Targets
    delivery_hours INTEGER NOT NULL,         -- Target delivery time
    pickup_hours INTEGER DEFAULT 4,          -- Max time to pickup
    first_attempt_delivery_hours INTEGER,    -- First delivery attempt
    -- Penalties
    penalty_per_hour DECIMAL(10,2) DEFAULT 0,
    max_penalty_amount DECIMAL(10,2),
    penalty_type VARCHAR(50) DEFAULT 'fixed', -- fixed, percentage
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. INVENTORY & STOCK
-- ============================================

-- Inventory
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID REFERENCES products(id),
    -- Product Info (for webhook inventory without product mapping)
    sku VARCHAR(100),
    product_name VARCHAR(255),
    -- Quantities
    quantity INTEGER DEFAULT 0,
    available_quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    damaged_quantity INTEGER DEFAULT 0,
    in_transit_quantity INTEGER DEFAULT 0,
    -- Location
    bin_location VARCHAR(50),
    zone VARCHAR(50),
    -- Thresholds
    reorder_point INTEGER,
    max_stock_level INTEGER,
    -- Status
    last_stock_check TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint for warehouse + SKU (for upserts)
CREATE UNIQUE INDEX idx_inventory_warehouse_sku ON inventory(warehouse_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_inventory_warehouse_product ON inventory(warehouse_id, product_id) WHERE product_id IS NOT NULL;

-- Stock Movements
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    product_id UUID REFERENCES products(id),
    inventory_id UUID REFERENCES inventory(id),
    -- Movement
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'inbound', 'outbound', 'transfer_in', 'transfer_out',
        'adjustment', 'return', 'damaged', 'expired'
    )),
    quantity INTEGER NOT NULL,
    -- Reference
    reference_type VARCHAR(50), -- order, return, adjustment, transfer
    reference_id UUID,
    -- Details
    notes TEXT,
    batch_number VARCHAR(100),
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. ORDERS
-- ============================================

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Order Numbers
    order_number VARCHAR(50),
    external_order_id VARCHAR(100), -- From external platforms
    platform VARCHAR(50),           -- amazon, shopify, website, api
    -- Customer
    customer_id VARCHAR(100),
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    -- Status
    status VARCHAR(50) DEFAULT 'created' CHECK (status IN (
        'created', 'confirmed', 'processing', 'allocated',
        'ready_to_ship', 'shipped', 'in_transit', 'out_for_delivery',
        'delivered', 'returned', 'cancelled', 'on_hold', 'pending_carrier_assignment'
    )),
    -- Priority & Type
    priority VARCHAR(20) DEFAULT 'standard' CHECK (priority IN ('express', 'standard', 'bulk', 'same_day')),
    order_type VARCHAR(50) DEFAULT 'regular', -- regular, replacement, cod
    is_cod BOOLEAN DEFAULT false,
    -- Amounts
    subtotal DECIMAL(10,2),
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    -- Addresses
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    -- Delivery
    estimated_delivery TIMESTAMPTZ,
    actual_delivery TIMESTAMPTZ,
    promised_delivery TIMESTAMPTZ,
    -- Processing
    allocated_warehouse_id UUID REFERENCES warehouses(id),
    shipping_locked_by VARCHAR(255), -- Prevents concurrent processing
    shipping_locked_at TIMESTAMPTZ,
    -- Notes
    notes TEXT,
    special_instructions TEXT,
    tags JSONB, -- Array of tags for filtering
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    -- Product Info
    sku VARCHAR(100),
    product_name VARCHAR(255),
    -- Quantities
    quantity INTEGER NOT NULL,
    fulfilled_quantity INTEGER DEFAULT 0,
    -- Pricing
    unit_price DECIMAL(10,2),
    discount DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2),
    -- Physical
    weight DECIMAL(10,3),
    -- Fulfillment
    warehouse_id UUID REFERENCES warehouses(id),
    bin_location VARCHAR(50),
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    shipped_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Splits (when order ships from multiple warehouses)
CREATE TABLE order_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    child_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id),
    split_reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CARRIER ASSIGNMENTS & SHIPPING
-- ============================================

-- Carrier Assignments (shipping requests to carriers)
CREATE TABLE carrier_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    -- Assignment Details
    service_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'accepted', 'rejected',
        'busy', 'expired', 'cancelled', 'completed'
    )),
    -- Addresses
    pickup_address JSONB NOT NULL,
    delivery_address JSONB NOT NULL,
    -- Scheduling
    estimated_pickup TIMESTAMPTZ,
    estimated_delivery TIMESTAMPTZ,
    actual_pickup TIMESTAMPTZ,
    -- Payload
    special_instructions TEXT,
    request_payload JSONB,    -- Full details sent to carrier
    acceptance_payload JSONB, -- Carrier response
    -- Carrier Reference
    carrier_reference_id VARCHAR(100),
    carrier_tracking_number VARCHAR(100),
    -- Rejection
    rejected_reason TEXT,
    -- Idempotency
    idempotency_key VARCHAR(255) UNIQUE,
    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN carrier_assignments.idempotency_key IS 'Prevents duplicate carrier assignment requests';

-- Shipments
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Identifiers
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    carrier_tracking_number VARCHAR(100),
    awb_number VARCHAR(100),
    -- References
    order_id UUID REFERENCES orders(id),
    carrier_assignment_id UUID REFERENCES carrier_assignments(id),
    carrier_id UUID REFERENCES carriers(id),
    warehouse_id UUID REFERENCES warehouses(id),
    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'manifested', 'picked_up', 'in_transit',
        'at_hub', 'out_for_delivery', 'delivered',
        'failed_delivery', 'rto_initiated', 'returned', 'lost'
    )),
    -- Addresses
    origin_address JSONB,
    destination_address JSONB,
    -- Physical
    weight DECIMAL(10,3),
    volumetric_weight DECIMAL(10,3),
    dimensions JSONB,
    package_count INTEGER DEFAULT 1,
    -- Cost
    shipping_cost DECIMAL(10,2),
    cod_amount DECIMAL(10,2),
    -- Delivery Tracking
    current_location JSONB,     -- {lat, lng, city, state}
    route_geometry JSONB,       -- GeoJSON for map display
    tracking_events JSONB DEFAULT '[]'::jsonb,
    delivery_attempts INTEGER DEFAULT 0,
    -- Scheduling
    pickup_scheduled TIMESTAMPTZ,
    pickup_actual TIMESTAMPTZ,
    delivery_scheduled TIMESTAMPTZ,
    delivery_actual TIMESTAMPTZ,
    -- POD
    pod_image_url VARCHAR(500),
    pod_signature_url VARCHAR(500),
    delivered_to VARCHAR(255),
    delivery_notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipment Events (detailed tracking history)
CREATE TABLE shipment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    -- Event Details
    event_type VARCHAR(50) NOT NULL,
    event_code VARCHAR(50),
    status VARCHAR(50),
    -- Location
    location JSONB,
    city VARCHAR(100),
    -- Description
    description TEXT,
    remarks TEXT,
    -- Source
    source VARCHAR(50), -- carrier_webhook, manual, system
    raw_payload JSONB,
    -- Timing
    event_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shipping Estimates (for cost prediction)
CREATE TABLE shipping_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    carrier_id UUID REFERENCES carriers(id),
    -- Estimate Details
    estimated_cost DECIMAL(10,2),
    estimated_days INTEGER,
    service_type VARCHAR(50),
    -- Confidence
    confidence_score DECIMAL(3,2),
    -- Actual (for accuracy tracking)
    actual_cost DECIMAL(10,2),
    actual_days INTEGER,
    accuracy_percent DECIMAL(5,2),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. CARRIER API INTEGRATION
-- ============================================

-- Carrier Quotes (rate quotes from carriers)
CREATE TABLE carrier_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    -- Quote Details
    quoted_price DECIMAL(10,2),
    estimated_delivery_days INTEGER,
    service_type VARCHAR(50),
    -- API Response
    response_time_ms INTEGER,
    was_retried BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    -- Selection
    was_selected BOOLEAN DEFAULT false,
    selection_reason VARCHAR(255),
    -- Status
    status VARCHAR(50) DEFAULT 'received',
    error_message TEXT,
    -- Raw Data
    request_payload JSONB,
    response_payload JSONB,
    -- Timestamps
    quoted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

COMMENT ON COLUMN carrier_quotes.selection_reason IS 'Why selected: best_price, best_speed, best_balance, reliability, only_option';

-- Carrier Rejections (when carriers reject shipments)
CREATE TABLE carrier_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_assignment_id UUID REFERENCES carrier_assignments(id),
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    order_id UUID REFERENCES orders(id),
    -- Rejection Details
    reason VARCHAR(100) NOT NULL,
    message TEXT,
    error_code VARCHAR(50),
    -- API Response
    response_time_ms INTEGER,
    raw_response JSONB,
    -- Timestamps
    rejected_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN carrier_rejections.reason IS 'at_capacity, weight_exceeded, route_not_serviceable, no_cold_storage, api_error, timeout';

-- Carrier Capacity Log (historical capacity tracking)
CREATE TABLE carrier_capacity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    -- Capacity Snapshot
    daily_capacity INTEGER,
    current_load INTEGER,
    utilization_percentage DECIMAL(5,2),
    availability_status VARCHAR(20),
    -- Timestamps
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quote Idempotency Cache (prevent duplicate quotes)
CREATE TABLE quote_idempotency_cache (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    quote_id UUID REFERENCES carrier_quotes(id),
    response_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE quote_idempotency_cache IS 'Prevents duplicate quote requests. Auto-cleanup: DELETE WHERE expires_at < NOW()';

-- Carrier Performance Metrics (aggregated stats)
CREATE TABLE carrier_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id UUID NOT NULL REFERENCES carriers(id),
    organization_id UUID REFERENCES organizations(id),
    -- Time Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20), -- daily, weekly, monthly
    -- Volume
    total_shipments INTEGER DEFAULT 0,
    delivered_on_time INTEGER DEFAULT 0,
    delivered_late INTEGER DEFAULT 0,
    failed_deliveries INTEGER DEFAULT 0,
    returns_processed INTEGER DEFAULT 0,
    -- Rates
    on_time_rate DECIMAL(5,2),
    delivery_success_rate DECIMAL(5,2),
    damage_rate DECIMAL(5,4),
    -- Performance
    avg_delivery_hours DECIMAL(10,2),
    avg_first_attempt_success_rate DECIMAL(5,2),
    -- Calculated At
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(carrier_id, organization_id, period_start, period_type)
);

-- ============================================
-- 7. WAREHOUSE FULFILLMENT
-- ============================================

-- Allocation Rules
CREATE TABLE allocation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    priority INTEGER DEFAULT 5,
    -- Rule
    strategy VARCHAR(50), -- nearest_warehouse, lowest_stock, highest_stock, round_robin
    conditions JSONB,     -- {product_category, destination_state, priority}
    -- Status
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allocation History
CREATE TABLE allocation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    order_item_id UUID REFERENCES order_items(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    -- Allocation Details
    allocation_strategy VARCHAR(50),
    allocation_score DECIMAL(5,2),
    allocated_quantity INTEGER NOT NULL,
    reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pick Lists
CREATE TABLE pick_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    -- Pick List Details
    pick_list_number VARCHAR(50) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'assigned', 'in_progress', 'completed', 'cancelled'
    )),
    priority INTEGER DEFAULT 5,
    total_items INTEGER DEFAULT 0,
    picked_items INTEGER DEFAULT 0,
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pick List Items
CREATE TABLE pick_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id),
    inventory_id UUID REFERENCES inventory(id),
    -- Item Details
    sku VARCHAR(100),
    product_name VARCHAR(255),
    quantity_to_pick INTEGER NOT NULL,
    quantity_picked INTEGER DEFAULT 0,
    -- Location
    bin_location VARCHAR(50),
    zone VARCHAR(50),
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    picked_at TIMESTAMPTZ,
    picked_by UUID REFERENCES users(id)
);

-- ============================================
-- 8. RETURNS & REVERSE LOGISTICS
-- ============================================

-- Returns
CREATE TABLE returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Return Numbers
    rma_number VARCHAR(50),
    external_return_id VARCHAR(100),
    -- References
    order_id UUID REFERENCES orders(id),
    original_shipment_id UUID REFERENCES shipments(id),
    return_shipment_id UUID REFERENCES shipments(id),
    -- Customer
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    -- Reason
    reason VARCHAR(100),
    reason_detail TEXT,
    -- Status
    status VARCHAR(50) DEFAULT 'requested' CHECK (status IN (
        'requested', 'approved', 'rejected', 'pickup_scheduled',
        'picked_up', 'in_transit', 'received', 'inspecting',
        'inspection_passed', 'inspection_failed', 'refunded', 'restocked'
    )),
    -- Inspection
    quality_check_result VARCHAR(50), -- passed, failed, damaged, defective
    quality_check_notes TEXT,
    inspection_images JSONB,
    -- Financial
    refund_amount DECIMAL(10,2),
    restocking_fee DECIMAL(10,2) DEFAULT 0,
    refund_status VARCHAR(50),
    refund_processed_at TIMESTAMPTZ,
    -- Items (for webhook returns)
    items JSONB,
    -- Addresses
    pickup_address JSONB,
    -- Timing
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_returns_rma_number ON returns(organization_id, rma_number) WHERE rma_number IS NOT NULL;

-- Return Items
CREATE TABLE return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id),
    product_id UUID REFERENCES products(id),
    -- Item Details
    sku VARCHAR(100),
    product_name VARCHAR(255),
    quantity INTEGER NOT NULL,
    -- Reason
    reason VARCHAR(100),
    reason_detail TEXT,
    -- Inspection
    condition VARCHAR(50), -- new, like_new, good, damaged, defective
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. EXCEPTIONS & SLA MANAGEMENT
-- ============================================

-- Exceptions (operational issues)
CREATE TABLE exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Type & Severity
    exception_type VARCHAR(50) NOT NULL CHECK (exception_type IN (
        'delay', 'damage', 'lost_shipment', 'address_issue',
        'carrier_issue', 'inventory_issue', 'sla_breach',
        'delivery_failed', 'customer_not_available', 'other'
    )),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    priority INTEGER DEFAULT 5,
    -- References
    shipment_id UUID REFERENCES shipments(id),
    order_id UUID REFERENCES orders(id),
    carrier_id UUID REFERENCES carriers(id),
    -- Details
    title VARCHAR(255),
    description TEXT,
    root_cause VARCHAR(255),
    -- Status
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
        'open', 'acknowledged', 'investigating', 'pending_resolution',
        'resolved', 'escalated', 'closed'
    )),
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMPTZ,
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,
    -- Resolution
    resolution VARCHAR(50), -- reship, refund, discount, none
    resolution_notes TEXT,
    -- Impact
    sla_impacted BOOLEAN DEFAULT false,
    customer_impacted BOOLEAN DEFAULT false,
    financial_impact DECIMAL(10,2),
    -- Timing
    estimated_resolution_time TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLA Violations
CREATE TABLE sla_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    shipment_id UUID REFERENCES shipments(id),
    sla_policy_id UUID REFERENCES sla_policies(id),
    carrier_id UUID REFERENCES carriers(id),
    -- Violation Details
    violation_type VARCHAR(50), -- late_delivery, late_pickup, sla_breach
    promised_delivery TIMESTAMPTZ,
    actual_delivery TIMESTAMPTZ,
    delay_hours DECIMAL(10,2),
    -- Penalty
    penalty_amount DECIMAL(10,2),
    penalty_status VARCHAR(50) DEFAULT 'pending', -- pending, applied, waived, disputed
    -- Status
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
        'open', 'acknowledged', 'investigating', 'resolved', 'waived', 'disputed'
    )),
    -- Waiver
    waiver_reason TEXT,
    waived_by UUID REFERENCES users(id),
    waived_at TIMESTAMPTZ,
    -- Details
    reason VARCHAR(255),
    notes TEXT,
    -- Timing
    violated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ETA Predictions (AI/ML predictions)
CREATE TABLE eta_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    -- Prediction
    predicted_delivery TIMESTAMPTZ NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    delay_risk_score VARCHAR(20), -- low, medium, high
    -- Factors
    factors JSONB, -- {distance, carrier_reliability, weather, traffic, warehouse_load}
    -- Actual (for accuracy tracking)
    actual_delivery TIMESTAMPTZ,
    prediction_accuracy_hours DECIMAL(10,2),
    -- Model
    model_version VARCHAR(50),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. FINANCE & BILLING
-- ============================================

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    invoice_number VARCHAR(50) NOT NULL,
    -- Carrier Invoice
    carrier_id UUID REFERENCES carriers(id),
    -- Period
    billing_period_start DATE,
    billing_period_end DATE,
    -- Amounts
    total_shipments INTEGER,
    base_amount DECIMAL(10,2),
    penalties DECIMAL(10,2) DEFAULT 0,
    adjustments DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending', 'sent', 'approved', 'paid', 'overdue', 'disputed', 'cancelled'
    )),
    -- Payment
    due_date DATE,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    -- Documents
    invoice_url VARCHAR(500),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, invoice_number)
);

-- Invoice Line Items
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    -- Reference
    shipment_id UUID REFERENCES shipments(id),
    order_id UUID REFERENCES orders(id),
    -- Item Details
    description VARCHAR(255) NOT NULL,
    item_type VARCHAR(50), -- shipping, penalty, adjustment, credit
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    amount DECIMAL(10,2) NOT NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. BACKGROUND JOBS & SCHEDULING
-- ============================================

-- Background Jobs
CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Job Details
    job_type VARCHAR(255) NOT NULL,
    job_name VARCHAR(255),
    -- Priority
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    -- Status
    status VARCHAR(100) DEFAULT 'pending' CHECK (status IN (
        'pending', 'queued', 'running', 'completed', 'failed', 'retrying', 'cancelled'
    )),
    -- Payload
    payload JSONB,
    result JSONB,
    error_message TEXT,
    error_stack TEXT,
    -- Retries
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 60,
    -- Scheduling
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    timeout_seconds INTEGER DEFAULT 300,
    -- Audit
    created_by UUID REFERENCES users(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Execution Logs
CREATE TABLE job_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES background_jobs(id) ON DELETE CASCADE,
    -- Execution Details
    attempt_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    -- Results
    error_message TEXT,
    execution_time_ms INTEGER,
    -- Output
    output_data JSONB,
    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

-- Cron Schedules
CREATE TABLE cron_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Schedule Details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    job_type VARCHAR(100) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    -- Payload
    payload JSONB,
    -- Status
    is_active BOOLEAN DEFAULT true,
    -- Execution
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(50),
    next_run_at TIMESTAMPTZ,
    -- Stats
    total_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dead Letter Queue
CREATE TABLE dead_letter_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_job_id UUID NOT NULL,
    -- Job Details
    job_type VARCHAR(100) NOT NULL,
    payload JSONB,
    priority INTEGER,
    -- Error
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    -- Timestamps
    original_created_at TIMESTAMPTZ NOT NULL,
    moved_to_dlq_at TIMESTAMPTZ DEFAULT NOW(),
    -- Reprocessing
    reprocessed BOOLEAN DEFAULT false,
    reprocessed_at TIMESTAMPTZ,
    reprocessed_job_id UUID
);

COMMENT ON TABLE dead_letter_queue IS 'Failed jobs that exceeded max retries for debugging and reprocessing';

-- ============================================
-- 12. ALERTS & NOTIFICATIONS
-- ============================================

-- Alert Rules
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    -- Rule Details
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL,
    description TEXT,
    -- Thresholds
    severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    threshold INTEGER,
    threshold_comparison VARCHAR(20), -- greater_than, less_than, equals
    conditions JSONB,
    -- Message
    message_template TEXT NOT NULL,
    -- Assignment
    assigned_users UUID[],
    assigned_roles VARCHAR(50)[],
    notification_channels TEXT[], -- email, push, sms, slack
    -- Escalation
    escalation_enabled BOOLEAN DEFAULT false,
    escalation_delay_minutes INTEGER DEFAULT 15,
    escalation_users UUID[],
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5,
    -- Cooldown (prevent alert spam)
    cooldown_minutes INTEGER DEFAULT 5,
    last_triggered_at TIMESTAMPTZ,
    -- Audit
    created_by UUID REFERENCES users(id),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts (triggered alerts)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    rule_id UUID REFERENCES alert_rules(id),
    -- Alert Details
    rule_name VARCHAR(255),
    alert_type VARCHAR(100),
    severity VARCHAR(50),
    message TEXT,
    -- Context
    entity_type VARCHAR(50),
    entity_id UUID,
    data JSONB,
    -- Status
    status VARCHAR(50) DEFAULT 'triggered' CHECK (status IN (
        'triggered', 'acknowledged', 'investigating', 'resolved', 'suppressed'
    )),
    -- Actions
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution TEXT,
    -- Timing
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications (user notifications)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    -- Notification Details
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    -- Reference
    entity_type VARCHAR(50),
    entity_id UUID,
    link VARCHAR(500),
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- NOTE: Indexes on UNIQUE columns (email, code, tracking_number) are NOT created
-- as PostgreSQL automatically creates indexes for UNIQUE constraints.
-- This reduces write overhead while maintaining read performance.

-- Organizations (code already has UNIQUE index)
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = true;

-- Users (email already has UNIQUE index)
CREATE INDEX idx_users_organization ON users(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- User Sessions
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Audit Logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Warehouses (org+code already has UNIQUE index)
CREATE INDEX idx_warehouses_org ON warehouses(organization_id);
CREATE INDEX idx_warehouses_active ON warehouses(is_active) WHERE is_active = true;

-- Carriers
CREATE INDEX idx_carriers_org ON carriers(organization_id);
CREATE INDEX idx_carriers_code ON carriers(code);
CREATE INDEX idx_carriers_active ON carriers(is_active);
CREATE INDEX idx_carriers_status ON carriers(availability_status);

-- Products (org+sku already has UNIQUE index)
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_category ON products(organization_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;

-- Rate Cards (FK lookups)
CREATE INDEX idx_rate_cards_carrier ON rate_cards(carrier_id);
CREATE INDEX idx_rate_cards_active ON rate_cards(carrier_id, is_active) WHERE is_active = true;
CREATE INDEX idx_rate_cards_route ON rate_cards(origin_state, destination_state) WHERE is_active = true;

-- Inventory
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_low_stock ON inventory(warehouse_id) WHERE available_quantity <= COALESCE(reorder_point, 10);

-- Orders
CREATE INDEX idx_orders_org ON orders(organization_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_external ON orders(external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_status_org ON orders(organization_id, status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_customer ON orders(customer_email);
CREATE INDEX idx_orders_platform ON orders(platform) WHERE platform IS NOT NULL;

-- Order Items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_sku ON order_items(sku);

-- Carrier Assignments
CREATE INDEX idx_carrier_assignments_order ON carrier_assignments(order_id);
CREATE INDEX idx_carrier_assignments_carrier ON carrier_assignments(carrier_id);
CREATE INDEX idx_carrier_assignments_status ON carrier_assignments(status);
CREATE INDEX idx_carrier_assignments_expires ON carrier_assignments(expires_at) WHERE status = 'pending';

-- Shipments (tracking_number already has UNIQUE index)
CREATE INDEX idx_shipments_org ON shipments(organization_id);
CREATE INDEX idx_shipments_carrier_tracking ON shipments(carrier_tracking_number) WHERE carrier_tracking_number IS NOT NULL;
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_carrier ON shipments(carrier_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_status_org ON shipments(organization_id, status);
CREATE INDEX idx_shipments_delivery_scheduled ON shipments(delivery_scheduled) WHERE delivery_scheduled IS NOT NULL;
CREATE INDEX idx_shipments_warehouse ON shipments(warehouse_id) WHERE warehouse_id IS NOT NULL;
CREATE INDEX idx_shipments_created ON shipments(created_at);

-- Shipment Events
CREATE INDEX idx_shipment_events_shipment ON shipment_events(shipment_id);
CREATE INDEX idx_shipment_events_type ON shipment_events(event_type);
CREATE INDEX idx_shipment_events_timestamp ON shipment_events(event_timestamp);

-- Carrier Quotes
CREATE INDEX idx_carrier_quotes_order ON carrier_quotes(order_id);
CREATE INDEX idx_carrier_quotes_carrier ON carrier_quotes(carrier_id);
CREATE INDEX idx_carrier_quotes_selected ON carrier_quotes(order_id) WHERE was_selected = true;

-- Carrier Rejections
CREATE INDEX idx_carrier_rejections_carrier ON carrier_rejections(carrier_id);
CREATE INDEX idx_carrier_rejections_reason ON carrier_rejections(reason);
CREATE INDEX idx_carrier_rejections_assignment ON carrier_rejections(carrier_assignment_id) WHERE carrier_assignment_id IS NOT NULL;
CREATE INDEX idx_carrier_rejections_date ON carrier_rejections(rejected_at);

-- Quote Cache
CREATE INDEX idx_quote_cache_expires ON quote_idempotency_cache(expires_at);

-- Shipping Estimates
CREATE INDEX idx_shipping_estimates_order ON shipping_estimates(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_shipping_estimates_carrier ON shipping_estimates(carrier_id);

-- Carrier Capacity Log
CREATE INDEX idx_carrier_capacity_carrier ON carrier_capacity_log(carrier_id);
CREATE INDEX idx_carrier_capacity_logged ON carrier_capacity_log(logged_at);

-- Carrier Performance Metrics (composite UNIQUE already exists)
CREATE INDEX idx_carrier_perf_carrier ON carrier_performance_metrics(carrier_id);
CREATE INDEX idx_carrier_perf_period ON carrier_performance_metrics(period_start, period_type);

-- Pick Lists (pick_list_number already has UNIQUE index)
CREATE INDEX idx_pick_lists_warehouse ON pick_lists(warehouse_id);
CREATE INDEX idx_pick_lists_status ON pick_lists(status);
CREATE INDEX idx_pick_lists_assigned ON pick_lists(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_pick_lists_org ON pick_lists(organization_id);

-- Pick List Items (FK lookup)
CREATE INDEX idx_pick_list_items_list ON pick_list_items(pick_list_id);
CREATE INDEX idx_pick_list_items_status ON pick_list_items(pick_list_id, status);

-- Allocation History
CREATE INDEX idx_allocation_history_order ON allocation_history(order_id);
CREATE INDEX idx_allocation_history_warehouse ON allocation_history(warehouse_id);

-- Allocation Rules
CREATE INDEX idx_allocation_rules_org ON allocation_rules(organization_id);
CREATE INDEX idx_allocation_rules_active ON allocation_rules(organization_id, is_active) WHERE is_active = true;

-- Order Splits
CREATE INDEX idx_order_splits_parent ON order_splits(parent_order_id);
CREATE INDEX idx_order_splits_child ON order_splits(child_order_id);

-- Stock Movements
CREATE INDEX idx_stock_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_stock_movements_inventory ON stock_movements(inventory_id) WHERE inventory_id IS NOT NULL;
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id) WHERE reference_id IS NOT NULL;

-- Returns (rma_number partial unique index already exists)
CREATE INDEX idx_returns_org ON returns(organization_id);
CREATE INDEX idx_returns_external ON returns(external_return_id) WHERE external_return_id IS NOT NULL;
CREATE INDEX idx_returns_order ON returns(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_returns_status ON returns(status);
CREATE INDEX idx_returns_created ON returns(created_at);

-- Return Items (FK lookup)
CREATE INDEX idx_return_items_return ON return_items(return_id);
CREATE INDEX idx_return_items_order_item ON return_items(order_item_id) WHERE order_item_id IS NOT NULL;

-- Exceptions
CREATE INDEX idx_exceptions_org ON exceptions(organization_id);
CREATE INDEX idx_exceptions_shipment ON exceptions(shipment_id);
CREATE INDEX idx_exceptions_order ON exceptions(order_id);
CREATE INDEX idx_exceptions_type ON exceptions(exception_type);
CREATE INDEX idx_exceptions_status ON exceptions(status);
CREATE INDEX idx_exceptions_severity ON exceptions(severity);
CREATE INDEX idx_exceptions_assigned ON exceptions(assigned_to);
CREATE INDEX idx_exceptions_open ON exceptions(organization_id) WHERE status IN ('open', 'investigating');

-- SLA Violations
CREATE INDEX idx_sla_violations_org ON sla_violations(organization_id);
CREATE INDEX idx_sla_violations_shipment ON sla_violations(shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX idx_sla_violations_carrier ON sla_violations(carrier_id) WHERE carrier_id IS NOT NULL;
CREATE INDEX idx_sla_violations_status ON sla_violations(status);
CREATE INDEX idx_sla_violations_violated ON sla_violations(violated_at);
CREATE INDEX idx_sla_violations_open ON sla_violations(organization_id, status) WHERE status IN ('open', 'acknowledged');

-- ETA Predictions
CREATE INDEX idx_eta_predictions_shipment ON eta_predictions(shipment_id);
CREATE INDEX idx_eta_predictions_created ON eta_predictions(created_at);

-- SLA Policies
CREATE INDEX idx_sla_policies_org ON sla_policies(organization_id);
CREATE INDEX idx_sla_policies_active ON sla_policies(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_sla_policies_service ON sla_policies(service_type) WHERE is_active = true;

-- Invoices (org+invoice_number already has UNIQUE index)
CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_carrier ON invoices(carrier_id) WHERE carrier_id IS NOT NULL;
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date) WHERE status IN ('pending', 'sent', 'overdue');
CREATE INDEX idx_invoices_period ON invoices(billing_period_start, billing_period_end);

-- Invoice Line Items (FK lookup)
CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_shipment ON invoice_line_items(shipment_id) WHERE shipment_id IS NOT NULL;

-- Background Jobs
CREATE INDEX idx_jobs_status ON background_jobs(status);
CREATE INDEX idx_jobs_type ON background_jobs(job_type);
CREATE INDEX idx_jobs_scheduled ON background_jobs(scheduled_for) WHERE status IN ('pending', 'queued');
CREATE INDEX idx_jobs_priority ON background_jobs(priority, scheduled_for) WHERE status IN ('pending', 'queued');
CREATE INDEX idx_jobs_org ON background_jobs(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_jobs_created ON background_jobs(created_at);

-- Job Execution Logs (FK lookup)
CREATE INDEX idx_job_execution_logs_job ON job_execution_logs(job_id);
CREATE INDEX idx_job_execution_logs_status ON job_execution_logs(status);

-- Cron Schedules
CREATE INDEX idx_cron_active ON cron_schedules(is_active, next_run_at);
CREATE INDEX idx_cron_org ON cron_schedules(organization_id);

-- Dead Letter Queue
CREATE INDEX idx_dlq_job_type ON dead_letter_queue(job_type);
CREATE INDEX idx_dlq_created ON dead_letter_queue(moved_to_dlq_at);
CREATE INDEX idx_dlq_unprocessed ON dead_letter_queue(reprocessed) WHERE reprocessed = false;

-- Alerts
CREATE INDEX idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type);
CREATE INDEX idx_alert_rules_org ON alert_rules(organization_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_triggered ON alerts(triggered_at);
CREATE INDEX idx_alerts_org ON alerts(organization_id);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATE
-- ============================================

-- Apply updated_at trigger to all tables that have updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'updated_at'
          AND table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I;
            CREATE TRIGGER trigger_update_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- Carrier Performance Summary View
CREATE OR REPLACE VIEW carrier_performance_summary AS
SELECT
    c.id AS carrier_id,
    c.name AS carrier_name,
    c.code AS carrier_code,
    c.reliability_score,
    c.availability_status,
    c.daily_capacity,
    c.current_load,
    CASE WHEN c.daily_capacity > 0 
         THEN ROUND((c.current_load::DECIMAL / c.daily_capacity) * 100, 2)
         ELSE 0 
    END AS utilization_percentage,
    COUNT(DISTINCT s.id) AS total_shipments,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'delivered') AS delivered_count,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status IN ('failed_delivery', 'returned', 'lost')) AS failed_count,
    ROUND(
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'delivered')::DECIMAL / 
        NULLIF(COUNT(DISTINCT s.id), 0) * 100, 2
    ) AS success_rate,
    COUNT(DISTINCT sv.id) AS sla_violations
FROM carriers c
LEFT JOIN shipments s ON s.carrier_id = c.id AND s.created_at > NOW() - INTERVAL '30 days'
LEFT JOIN sla_violations sv ON sv.carrier_id = c.id AND sv.violated_at > NOW() - INTERVAL '30 days'
WHERE c.is_active = true
GROUP BY c.id, c.name, c.code, c.reliability_score, c.availability_status, c.daily_capacity, c.current_load;

-- Carrier Rejection Analysis View
CREATE OR REPLACE VIEW carrier_rejection_analysis AS
SELECT
    cr.carrier_id,
    c.name AS carrier_name,
    c.code AS carrier_code,
    cr.reason,
    COUNT(*) AS rejection_count,
    ROUND(AVG(cr.response_time_ms), 2) AS avg_response_time_ms,
    MIN(cr.rejected_at) AS first_rejection,
    MAX(cr.rejected_at) AS last_rejection
FROM carrier_rejections cr
JOIN carriers c ON c.id = cr.carrier_id
WHERE cr.rejected_at > NOW() - INTERVAL '30 days'
GROUP BY cr.carrier_id, c.name, c.code, cr.reason
ORDER BY rejection_count DESC;

-- Shipping Estimate Accuracy View
CREATE OR REPLACE VIEW estimate_accuracy_analysis AS
SELECT
    c.id AS carrier_id,
    c.name AS carrier_name,
    se.service_type,
    COUNT(*) AS total_estimates,
    ROUND(AVG(se.estimated_cost), 2) AS avg_estimated_cost,
    ROUND(AVG(se.actual_cost), 2) AS avg_actual_cost,
    ROUND(AVG(ABS(se.estimated_cost - se.actual_cost)), 2) AS avg_cost_variance,
    ROUND(AVG(se.accuracy_percent), 2) AS avg_accuracy_percent
FROM shipping_estimates se
JOIN carriers c ON c.id = se.carrier_id
WHERE se.actual_cost IS NOT NULL
GROUP BY c.id, c.name, se.service_type;

-- ============================================
-- SEED DATA
-- ============================================

BEGIN;

-- Create demo organizations
INSERT INTO organizations (name, code, email, phone, city, state, country, postal_code, is_active)
VALUES
    ('TwinChain Demo Company', 'DEMO001', 'contact@twinchain-demo.in', '+91-22-1234-5678', 'Mumbai', 'Maharashtra', 'India', '400001', true),
    ('Acme Corporation', 'ACME001', 'info@acme.in', '+91-11-9876-5432', 'Delhi', 'Delhi', 'India', '110001', true)
ON CONFLICT (code) DO NOTHING;

-- Create users (superadmin + demo users)
INSERT INTO users (email, password_hash, name, role, organization_id, avatar, is_active)
SELECT * FROM (VALUES
    -- Superadmin (no organization)
    ('superadmin@twinchain.in', '$2b$10$demoHashedPassword', 'Super Admin', 'superadmin', NULL, 'https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin', true),
    -- Demo Company Users
    ('admin@twinchain.in', '$2b$10$demoHashedPassword', 'Raj Admin', 'admin', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Raj', true),
    ('ops@twinchain.in', '$2b$10$demoHashedPassword', 'Priya Operations', 'operations_manager', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya', true),
    ('wh1@twinchain.in', '$2b$10$demoHashedPassword', 'Amit Warehouse', 'warehouse_manager', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit', true),
    ('wh2@twinchain.in', '$2b$10$demoHashedPassword', 'Neha Warehouse', 'warehouse_manager', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Neha', true),
    ('carrier@twinchain.in', '$2b$10$demoHashedPassword', 'Delhivery Partner', 'carrier_partner', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carrier', true),
    ('finance@twinchain.in', '$2b$10$demoHashedPassword', 'Ananya Finance', 'finance', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya', true),
    ('support@twinchain.in', '$2b$10$demoHashedPassword', 'Rohan Support', 'customer_support', (SELECT id FROM organizations WHERE code='DEMO001'), 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan', true),
    -- Acme Admin
    ('admin@acme.in', '$2b$10$demoHashedPassword', 'Acme Admin', 'admin', (SELECT id FROM organizations WHERE code='ACME001'), NULL, true)
) AS v(email, password_hash, name, role, organization_id, avatar, is_active)
ON CONFLICT (email) DO NOTHING;

-- Create demo warehouses
INSERT INTO warehouses (organization_id, code, name, address, is_active)
SELECT
    (SELECT id FROM organizations WHERE code='DEMO001'),
    warehouse_code,
    warehouse_name,
    warehouse_address::jsonb,
    true
FROM (VALUES
    ('WH-MUM', 'Mumbai Central Warehouse', '{"street": "123 Industrial Area", "city": "Mumbai", "state": "Maharashtra", "postal_code": "400001", "country": "India"}'),
    ('WH-DEL', 'Delhi Distribution Center', '{"street": "456 Logistics Park", "city": "Delhi", "state": "Delhi", "postal_code": "110001", "country": "India"}'),
    ('WH-BLR', 'Bangalore Fulfillment Hub', '{"street": "789 Tech Park", "city": "Bangalore", "state": "Karnataka", "postal_code": "560001", "country": "India"}')
) AS t(warehouse_code, warehouse_name, warehouse_address)
ON CONFLICT (organization_id, code) DO NOTHING;

-- Create demo carriers (system-wide)
INSERT INTO carriers (code, name, service_type, contact_email, reliability_score, daily_capacity, is_active)
VALUES
    ('DELHIVERY', 'Delhivery', 'standard', 'support@delhivery.com', 0.92, 1000, true),
    ('BLUEDART', 'BlueDart Express', 'express', 'support@bluedart.com', 0.95, 500, true),
    ('DTDC', 'DTDC Courier', 'standard', 'support@dtdc.com', 0.88, 800, true),
    ('ECOM', 'Ecom Express', 'standard', 'support@ecomexpress.in', 0.90, 600, true),
    ('SHADOWFAX', 'Shadowfax', 'same_day', 'support@shadowfax.in', 0.87, 300, true)
ON CONFLICT DO NOTHING;

-- Create demo SLA policies
INSERT INTO sla_policies (organization_id, name, service_type, delivery_hours, penalty_per_hour, is_active)
SELECT
    (SELECT id FROM organizations WHERE code='DEMO001'),
    policy_name,
    service_type,
    delivery_hours,
    penalty_per_hour,
    true
FROM (VALUES
    ('Same Day Delivery SLA', 'same_day', 12, 100.00),
    ('Express Delivery SLA', 'express', 24, 50.00),
    ('Standard Delivery SLA', 'standard', 72, 25.00),
    ('Bulk Delivery SLA', 'bulk', 120, 10.00)
) AS t(policy_name, service_type, delivery_hours, penalty_per_hour)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE schemaname = 'public';
    SELECT COUNT(*) INTO user_count FROM users;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'TwinChain SCM Database Initialization Complete';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tables created: %', table_count;
    RAISE NOTICE 'Indexes created: %', index_count;
    RAISE NOTICE 'Users created: %', user_count;
    RAISE NOTICE '============================================';
END;
$$ LANGUAGE plpgsql;
