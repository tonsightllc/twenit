-- Enable Row Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE wiki_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_evidence_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE unsubscription_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Users can view their organization"
    ON organizations FOR SELECT
    USING (id = get_user_org_id());

CREATE POLICY "Owners can update their organization"
    ON organizations FOR UPDATE
    USING (id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

-- Users policies
CREATE POLICY "Users can view members of their organization"
    ON users FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Owners and admins can manage users"
    ON users FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Stripe Connections policies
CREATE POLICY "Users can view their org stripe connections"
    ON stripe_connections FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Owners and admins can manage stripe connections"
    ON stripe_connections FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Customers policies
CREATE POLICY "Users can view their org customers"
    ON customers FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users can manage their org customers"
    ON customers FOR ALL
    USING (org_id = get_user_org_id());

-- Subscriptions policies
CREATE POLICY "Users can view their org subscriptions"
    ON subscriptions FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users can manage their org subscriptions"
    ON subscriptions FOR ALL
    USING (org_id = get_user_org_id());

-- Email Templates policies
CREATE POLICY "Users can view their org email templates"
    ON email_templates FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage email templates"
    ON email_templates FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Automation Rules policies
CREATE POLICY "Users can view their org automation rules"
    ON automation_rules FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage automation rules"
    ON automation_rules FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Wiki Articles policies
CREATE POLICY "Users can view their org wiki articles"
    ON wiki_articles FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users can manage their org wiki articles"
    ON wiki_articles FOR ALL
    USING (org_id = get_user_org_id());

-- Bot Configs policies
CREATE POLICY "Users can view their org bot configs"
    ON bot_configs FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage bot configs"
    ON bot_configs FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Support Tickets policies
CREATE POLICY "Users can view their org support tickets"
    ON support_tickets FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Users can manage their org support tickets"
    ON support_tickets FOR ALL
    USING (org_id = get_user_org_id());

-- Dispute Evidence Endpoints policies
CREATE POLICY "Users can view their org dispute endpoints"
    ON dispute_evidence_endpoints FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage dispute endpoints"
    ON dispute_evidence_endpoints FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Unsubscription Rules policies
CREATE POLICY "Users can view their org unsubscription rules"
    ON unsubscription_rules FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage unsubscription rules"
    ON unsubscription_rules FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- Email Configs policies
CREATE POLICY "Users can view their org email configs"
    ON email_configs FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Admins can manage email configs"
    ON email_configs FOR ALL
    USING (org_id = get_user_org_id() AND EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
    ));

-- NPS Responses policies
CREATE POLICY "Users can view their org nps responses"
    ON nps_responses FOR SELECT
    USING (org_id = get_user_org_id());

CREATE POLICY "Anyone can insert nps responses"
    ON nps_responses FOR INSERT
    WITH CHECK (true);

-- Stripe Events policies
CREATE POLICY "Users can view their org stripe events"
    ON stripe_events FOR SELECT
    USING (org_id = get_user_org_id());

-- Public access for bot configs (for embedded widget)
CREATE POLICY "Public can view enabled bot configs"
    ON bot_configs FOR SELECT
    USING (enabled = true);

-- Public access for published wiki articles (for embedded widget)
CREATE POLICY "Public can view published wiki articles"
    ON wiki_articles FOR SELECT
    USING (published = true);
