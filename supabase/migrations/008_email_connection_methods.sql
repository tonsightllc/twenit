-- =======================================
-- Migration 008: Email Connection Methods
-- Adds forwarding addresses, IMAP support, and connection_method tracking
-- =======================================

-- 1. Add connection method and inbound address
ALTER TABLE email_configs
  ADD COLUMN IF NOT EXISTS connection_method VARCHAR(50) DEFAULT 'none'
    CHECK (connection_method IN ('forwarding', 'imap', 'smtp_only', 'none')),
  ADD COLUMN IF NOT EXISTS inbound_address VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS imap_last_uid VARCHAR(255);

-- 2. Index for looking up orgs by their inbound forwarding address
CREATE INDEX IF NOT EXISTS idx_email_configs_inbound_address
  ON email_configs(inbound_address) WHERE inbound_address IS NOT NULL;

-- 3. Update provider check to include 'forwarding'
ALTER TABLE email_configs DROP CONSTRAINT IF EXISTS email_configs_provider_check;

ALTER TABLE email_configs
  ADD CONSTRAINT email_configs_provider_check
  CHECK (provider IN ('imap', 'gmail', 'outlook', 'resend_domain', 'smtp', 'forwarding', 'none'));
