-- Add webhook_secret column to stripe_connections
-- Used for API Key connections where we auto-register a webhook in the customer's account.
-- For OAuth/Connect connections, webhook validation uses the platform-level STRIPE_WEBHOOK_SECRET env var.
ALTER TABLE stripe_connections
    ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
    ADD COLUMN IF NOT EXISTS connection_type VARCHAR(20) DEFAULT 'oauth' CHECK (connection_type IN ('oauth', 'apikey'));
