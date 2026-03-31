-- =======================================
-- Migration 009: Add resend_client connection method
-- Allows clients to connect their own Resend account
-- =======================================

-- Update provider check
ALTER TABLE email_configs DROP CONSTRAINT IF EXISTS email_configs_provider_check;
ALTER TABLE email_configs ADD CONSTRAINT email_configs_provider_check
  CHECK (provider IN ('imap', 'gmail', 'outlook', 'resend_domain', 'smtp', 'forwarding', 'resend_client', 'none'));

-- Update connection_method check
ALTER TABLE email_configs DROP CONSTRAINT IF EXISTS email_configs_connection_method_check;
ALTER TABLE email_configs ADD CONSTRAINT email_configs_connection_method_check
  CHECK (connection_method IN ('forwarding', 'imap', 'smtp_only', 'resend_client', 'none'));
