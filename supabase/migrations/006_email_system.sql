-- =======================================
-- Migration 006: Email Management System
-- =======================================

-- 1. Extend inbound_emails table
ALTER TABLE inbound_emails
  ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reply_to VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS intent VARCHAR(100);

-- Index for thread grouping
CREATE INDEX IF NOT EXISTS idx_inbound_emails_thread_id ON inbound_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_customer_id ON inbound_emails(customer_id);

-- 2. Custom email labels per organization
CREATE TABLE IF NOT EXISTS email_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_email_labels_org_id ON email_labels(org_id);

ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage email labels for their organization"
  ON email_labels FOR ALL
  USING (org_id = get_user_org_id());

-- 3. Email automation rules (specific to inbound email triggers)
CREATE TABLE IF NOT EXISTS email_automation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  -- e.g.: { "classification": "billing", "intent": "cancel" }
  action_type VARCHAR(50) NOT NULL CHECK (
    action_type IN ('auto_reply', 'apply_label', 'unsubscribe', 'refund', 'create_ticket', 'forward')
  ),
  action_config JSONB NOT NULL DEFAULT '{}',
  -- auto_reply: { template_id, body }
  -- apply_label: { label }
  -- unsubscribe: {}
  -- refund: { max_amount }
  -- create_ticket: { category, priority }
  -- forward: { to_email }
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_automation_rules_org_id ON email_automation_rules(org_id);

ALTER TABLE email_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage email automation rules for their organization"
  ON email_automation_rules FOR ALL
  USING (org_id = get_user_org_id());

CREATE TRIGGER update_email_automation_rules_updated_at
  BEFORE UPDATE ON email_automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Email replies history
CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inbound_email_id UUID NOT NULL REFERENCES inbound_emails(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body_text TEXT NOT NULL,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_auto_reply BOOLEAN DEFAULT FALSE,
  resend_message_id VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_replies_org_id ON email_replies(org_id);
CREATE INDEX IF NOT EXISTS idx_email_replies_inbound_email_id ON email_replies(inbound_email_id);

ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email replies for their organization"
  ON email_replies FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "Users can insert email replies for their organization"
  ON email_replies FOR INSERT
  WITH CHECK (org_id = get_user_org_id());

-- 5. Expand email_configs to support all 3 connection cases
-- Drop old check constraint and re-add with expanded options
ALTER TABLE email_configs DROP CONSTRAINT IF EXISTS email_configs_provider_check;

ALTER TABLE email_configs
  ADD CONSTRAINT email_configs_provider_check
  CHECK (provider IN ('imap', 'gmail', 'outlook', 'resend_domain', 'smtp', 'none'));

-- Add new columns for Resend domain and enhanced config
ALTER TABLE email_configs
  ADD COLUMN IF NOT EXISTS resend_domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resend_domain_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resend_domain_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reply_to_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#fbbf24',
  ADD COLUMN IF NOT EXISTS show_footer BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS footer_text TEXT,
  ADD COLUMN IF NOT EXISTS custom_css TEXT,
  ADD COLUMN IF NOT EXISTS ai_model VARCHAR(50) DEFAULT 'gpt-4o-mini',
  ADD COLUMN IF NOT EXISTS ai_categories TEXT[] DEFAULT '{"Soporte","Facturación","Ventas","Cancelación","Otro"}';

-- Seed default labels (will only apply when inserted manually per org)
-- (Labels are org-specific, no global seed needed)
