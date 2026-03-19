// Organization (Tenant)
export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

// User
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  org_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

// Stripe Connection
export interface StripeConnection {
  id: string;
  org_id: string;
  stripe_account_id: string;
  access_token: string;
  refresh_token: string | null;
  livemode: boolean;
  scope: string;
  connected_at: string;
}

// Customer (synced from Stripe)
export interface Customer {
  id: string;
  org_id: string;
  stripe_customer_id: string;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
  activation_status: "pending" | "activated" | "inactive";
  activation_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

// Subscription
export interface Subscription {
  id: string;
  org_id: string;
  customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: "active" | "canceled" | "past_due" | "trialing" | "unpaid";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

// Email Template
export interface EmailTemplate {
  id: string;
  org_id: string;
  type: EmailTemplateType;
  name: string;
  subject: string;
  html_content: string;
  react_template: string | null;
  variables: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type EmailTemplateType =
  | "new_sale"
  | "new_subscription"
  | "activation_reminder"
  | "unsubscribe_confirmation"
  | "refund_confirmation"
  | "offer"
  | "custom";

// Automation Rule
export interface AutomationRule {
  id: string;
  org_id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  conditions: AutomationCondition[];
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  enabled: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type AutomationTriggerType =
  | "new_sale"
  | "new_subscription"
  | "subscription_canceled"
  | "dispute_created"
  | "efw_created"
  | "email_received"
  | "activation_pending";

export type AutomationActionType =
  | "send_email"
  | "create_ticket"
  | "apply_discount"
  | "pause_subscription"
  | "refund"
  | "call_webhook"
  | "tag_customer";

export interface AutomationCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than";
  value: string | number | boolean;
}

// Wiki Article
export interface WikiArticle {
  id: string;
  org_id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  order: number;
  published: boolean;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

// Bot Configuration
export interface BotConfig {
  id: string;
  org_id: string;
  name: string;
  tree_config: BotNode;
  styles: BotStyles;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BotNode {
  id: string;
  type: "message" | "question" | "api_call" | "stripe_action" | "end";
  content?: string;
  options?: BotOption[];
  api_config?: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  stripe_action?: {
    type: "cancel_subscription" | "pause_subscription" | "refund";
    params?: Record<string, unknown>;
  };
  next?: string;
}

export interface BotOption {
  id: string;
  label: string;
  next: string;
}

export interface BotStyles {
  primary_color: string;
  secondary_color: string;
  text_color: string;
  background_color: string;
  logo_url?: string;
  position: "bottom-right" | "bottom-left";
  welcome_message: string;
}

// Support Ticket
export interface SupportTicket {
  id: string;
  org_id: string;
  customer_id: string | null;
  source: "email" | "bot" | "nps" | "manual";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  category: string | null;
  subject: string;
  messages: TicketMessage[];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  sender_type: "customer" | "agent" | "bot";
  sender_id: string | null;
  content: string;
  attachments?: string[];
  created_at: string;
}

// Dispute Evidence Endpoint
export interface DisputeEvidenceEndpoint {
  id: string;
  org_id: string;
  evidence_type: DisputeEvidenceType;
  endpoint_url: string;
  auth_config: {
    type: "none" | "api_key" | "bearer" | "basic";
    credentials?: Record<string, string>;
  };
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type DisputeEvidenceType =
  | "customer_communication"
  | "refund_policy"
  | "receipt"
  | "shipping_documentation"
  | "service_documentation"
  | "access_activity_log"
  | "duplicate_charge_documentation";

// Unsubscription Rules
export interface UnsubscriptionRules {
  id: string;
  org_id: string;
  immediate_cancel: boolean;
  offer_benefit_first: boolean;
  benefit_type?: "discount" | "pause" | "downgrade" | "custom";
  benefit_config?: Record<string, unknown>;
  refund_rules: RefundRules;
  efw_rules: EfwRules;
  dispute_rules: DisputeRules;
  created_at: string;
  updated_at: string;
}

export interface RefundRules {
  auto_refund_below: number | null;
  require_approval_above: number | null;
  max_refund_days: number;
}

export interface EfwRules {
  action: "refund_always" | "review" | "ignore";
  mark_fraudulent: boolean;
}

export interface DisputeRules {
  action: "always_dispute" | "never_dispute" | "smart" | "review";
  min_amount_to_dispute: number;
}

// Email Config
export interface EmailConfig {
  id: string;
  org_id: string;
  provider: "imap" | "gmail" | "outlook";
  email_address: string;
  credentials: Record<string, string>;
  enabled: boolean;
  auto_classify: boolean;
  auto_respond: boolean;
  created_at: string;
  updated_at: string;
}

// NPS Response
export interface NpsResponse {
  id: string;
  org_id: string;
  customer_id: string | null;
  score: number;
  feedback: string | null;
  page_url: string;
  created_at: string;
}
