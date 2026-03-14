CREATE TABLE IF NOT EXISTS system_incident_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title varchar(120) NOT NULL,
  message text NOT NULL,
  severity varchar(20) NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_banners_active
  ON system_incident_banners (is_active, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_banners_org
  ON system_incident_banners (organization_id, created_at DESC);
