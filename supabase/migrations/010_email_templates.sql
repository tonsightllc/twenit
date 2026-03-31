-- =======================================
-- Migration 010: Extend email_templates for block-based content
-- The table already exists from 001 with columns: type, name, subject, html_content, react_template, variables, enabled
-- We add: template_type, blocks, is_predefined and keep backward compatibility
-- =======================================

-- Add new columns
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS template_type TEXT;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_predefined BOOLEAN NOT NULL DEFAULT false;

-- Backfill template_type from existing 'type' column
UPDATE email_templates SET template_type = type WHERE template_type IS NULL;

-- Set default for template_type
ALTER TABLE email_templates ALTER COLUMN template_type SET DEFAULT 'custom';

-- Index for the new column
CREATE INDEX IF NOT EXISTS idx_email_templates_template_type ON email_templates(org_id, template_type);
