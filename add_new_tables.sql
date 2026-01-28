-- Safe Migration: Add new tables without affecting existing data
-- This script only creates tables/indexes that don't exist

-- 1. Dead Letter Queue for Failed Jobs
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  payload JSONB,
  priority INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  moved_to_dlq_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_job_type ON dead_letter_queue(job_type);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_created_at ON dead_letter_queue(created_at);

COMMENT ON TABLE dead_letter_queue IS 'Failed jobs that exceeded max retries';
COMMENT ON COLUMN dead_letter_queue.original_job_id IS 'ID of the original job in background_jobs';
COMMENT ON COLUMN dead_letter_queue.moved_to_dlq_at IS 'When the job was moved to dead letter queue';

-- 2. Alert Rules Table
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  message_template TEXT NOT NULL,
  threshold INTEGER,
  conditions JSONB,
  assigned_users UUID[],
  assigned_roles VARCHAR(50)[],
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_delay_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);

COMMENT ON TABLE alert_rules IS 'Configurable alert rules for system monitoring';
COMMENT ON COLUMN alert_rules.threshold IS 'Numeric threshold for triggering the alert';
COMMENT ON COLUMN alert_rules.conditions IS 'JSON object with additional rule conditions';

-- 3. Alerts Table (Triggered alerts)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id),
  rule_name VARCHAR(255),
  alert_type VARCHAR(100),
  severity VARCHAR(50),
  message TEXT,
  data JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at);

COMMENT ON TABLE alerts IS 'Triggered alerts from alert rules';
COMMENT ON COLUMN alerts.data IS 'Additional context data for the alert';

-- 4. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_preferences JSONB DEFAULT '{}',
  ui_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

COMMENT ON TABLE user_settings IS 'User-specific settings and preferences';

-- Print success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added tables: dead_letter_queue, alert_rules, alerts, user_settings';
END $$;
