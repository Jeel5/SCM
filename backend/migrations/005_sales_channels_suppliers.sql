-- ============================================
-- 005: Sales Channels & Suppliers
-- ============================================
-- Sales Channels: External e-commerce platforms, marketplaces, D2C sites
-- that push orders into SCM via webhooks.
-- Suppliers: Inbound vendors for purchase orders and replenishment.

-- Sales Channels (order sources)
CREATE TABLE IF NOT EXISTS sales_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    -- Platform classification
    platform_type VARCHAR(50) NOT NULL DEFAULT 'marketplace'
        CHECK (platform_type IN ('marketplace', 'd2c', 'b2b', 'wholesale', 'internal')),
    -- Integration
    webhook_token VARCHAR(64) UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    api_endpoint VARCHAR(500),
    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,  -- channel-specific settings
    -- Warehouse mapping
    default_warehouse_id UUID REFERENCES warehouses(id),
    -- Status
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

COMMENT ON TABLE sales_channels IS 'E-commerce platforms and marketplaces that push orders via webhooks';

CREATE TRIGGER set_sales_channels_updated_at
    BEFORE UPDATE ON sales_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Suppliers (inbound vendors)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    -- Contact
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    website VARCHAR(500),
    -- Address
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    postal_code VARCHAR(20),
    -- Supply details
    lead_time_days INTEGER DEFAULT 7,
    payment_terms VARCHAR(100),          -- Net30, COD, Advance, etc.
    -- Performance
    reliability_score DECIMAL(3,2) DEFAULT 0.85
        CHECK (reliability_score >= 0 AND reliability_score <= 1),
    -- Status
    is_active BOOLEAN DEFAULT true,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, code)
);

COMMENT ON TABLE suppliers IS 'Inbound vendors for purchase orders and inventory replenishment';

CREATE TRIGGER set_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sales_channels_org ON sales_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_channels_active ON sales_channels(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(organization_id, is_active);
