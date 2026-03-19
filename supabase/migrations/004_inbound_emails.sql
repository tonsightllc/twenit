-- Inbound Emails
CREATE TABLE inbound_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE,
    classification VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'archived', 'deleted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inbound_emails_org_id ON inbound_emails(org_id);
CREATE INDEX idx_inbound_emails_status ON inbound_emails(status);
CREATE INDEX idx_inbound_emails_received_at ON inbound_emails(received_at);

-- Update trigger
CREATE TRIGGER update_inbound_emails_updated_at BEFORE UPDATE ON inbound_emails FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inbound emails for their organization"
    ON inbound_emails FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users can update inbound emails for their organization"
    ON inbound_emails FOR UPDATE
    USING (org_id = get_user_org_id());

-- Webhooks/Service role can insert (usually handled by service_role key, bypassing RLS, but ensuring it's enabled is good)
