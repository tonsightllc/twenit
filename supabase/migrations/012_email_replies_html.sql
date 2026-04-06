-- =======================================
-- Migration 012: Add HTML to Email Replies
-- =======================================

ALTER TABLE email_replies 
  ADD COLUMN IF NOT EXISTS body_html TEXT;
