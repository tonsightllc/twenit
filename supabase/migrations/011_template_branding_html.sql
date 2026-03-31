-- =======================================
-- Migration 011: Add per-template branding overrides and custom HTML support
-- =======================================

ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS custom_html TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}';
