-- Migration: Multi-Tenant Organizations Support
-- Description: Creates organizations table and ensures all tables have organization_id FK
--              Also adds performance indexes for multi-tenant queries
-- Date: 2026-07-25

-- ============================================================
-- Step 1: Create organizations table (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
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
    subscription_tier VARCHAR(50) DEFAULT 'standard',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Multi-tenant companies using the platform';

-- ============================================================
-- Step 2: Add organization_id FK to core tables (if missing)
-- ============================================================

-- Users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Warehouses table  
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Inventory table
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Shipments table
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Returns table
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Carriers table (null = system-wide carrier available to all orgs)
ALTER TABLE carriers
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- ============================================================
-- Step 3: Add performance indexes for multi-tenant queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_organization_id ON warehouses(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_organization_id ON inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_organization_id ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_shipments_organization_id ON shipments(organization_id);
CREATE INDEX IF NOT EXISTS idx_returns_organization_id ON returns(organization_id);
CREATE INDEX IF NOT EXISTS idx_carriers_organization_id ON carriers(organization_id);

-- ============================================================
-- Step 4: Update users role constraint to include superadmin
-- ============================================================
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('superadmin', 'admin', 'operations_manager', 'warehouse_manager', 'carrier_partner', 'finance', 'customer_support'));

-- ============================================================
-- Step 5: Create default superadmin if not exists
-- ============================================================
INSERT INTO users (email, password_hash, name, role, organization_id, is_active)
SELECT
  'superadmin@twinchain.in',
  '$2b$10$8K1p/a0dclxf8UqnXo0VpOjWb6RGn/v2YJgYTg6UF6rLwm4cMmqAy',  -- Change in production!
  'Super Admin',
  'superadmin',
  NULL,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE role = 'superadmin'
);

-- ============================================================
-- Verification
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    RAISE NOTICE 'SUCCESS: organizations table exists';
  ELSE
    RAISE WARNING 'WARNING: organizations table missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'organization_id'
  ) THEN
    RAISE NOTICE 'SUCCESS: orders.organization_id column exists';
  ELSE
    RAISE WARNING 'WARNING: orders.organization_id column missing';
  END IF;
END$$;
