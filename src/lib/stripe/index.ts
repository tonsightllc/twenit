import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

const STRIPE_API_VERSION = "2026-01-28.clover" as const;

let _stripe: Stripe | null = null;

// Lazy initialization to avoid build-time errors when env vars are not set
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return _stripe;
}

// For backwards compatibility
export const stripe = {
  get oauth() {
    return getStripe().oauth;
  },
  get webhooks() {
    return getStripe().webhooks;
  },
  get customers() {
    return getStripe().customers;
  },
  get subscriptions() {
    return getStripe().subscriptions;
  },
};

// Helper to create Stripe client for connected accounts
export function createStripeClient(accessToken: string) {
  return new Stripe(accessToken, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  });
}

// ─── Org-level Stripe client ──────────────────────────────────────────

/**
 * Get an authenticated Stripe client for a specific organization.
 * Looks up the stripe_connections table and returns a client using the stored access_token.
 */
export async function getStripeClientForOrg(orgId: string): Promise<{
  client: Stripe;
  connection: { id: string; stripe_account_id: string; livemode: boolean };
} | null> {
  const supabase = await createServiceClient();
  const { data: connection } = await supabase
    .from("stripe_connections")
    .select("id, stripe_account_id, access_token, livemode")
    .eq("org_id", orgId)
    .single();

  if (!connection) return null;

  return {
    client: createStripeClient(connection.access_token),
    connection: {
      id: connection.id,
      stripe_account_id: connection.stripe_account_id,
      livemode: connection.livemode,
    },
  };
}

// ─── Subscription helpers ─────────────────────────────────────────────

/**
 * Cancel a subscription. If immediate is false, cancels at the end of the billing period.
 */
export async function cancelSubscription(
  client: Stripe,
  subscriptionId: string,
  immediate: boolean = false
): Promise<Stripe.Subscription> {
  if (immediate) {
    return client.subscriptions.cancel(subscriptionId);
  }
  return client.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Pause a subscription by setting pause_collection to mark_uncollectible.
 */
export async function pauseSubscription(
  client: Stripe,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return client.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: "mark_uncollectible",
    },
  });
}

/**
 * Resume a previously paused subscription.
 */
export async function resumeSubscription(
  client: Stripe,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return client.subscriptions.update(subscriptionId, {
    pause_collection: "",
  });
}

/**
 * Apply a percentage discount to a subscription by creating a coupon on-the-fly.
 */
export async function applyDiscount(
  client: Stripe,
  subscriptionId: string,
  percentOff: number,
  durationInMonths: number = 1
): Promise<Stripe.Subscription> {
  const coupon = await client.coupons.create({
    percent_off: percentOff,
    duration: durationInMonths === 1 ? "once" : "repeating",
    ...(durationInMonths > 1 && { duration_in_months: durationInMonths }),
  });

  return client.subscriptions.update(subscriptionId, {
    discounts: [{ coupon: coupon.id }],
  });
}

// ─── Refund helpers ───────────────────────────────────────────────────

/**
 * Create a refund. Supports both full and partial refunds.
 * Pass either paymentIntentId or chargeId.
 */
export async function createRefund(
  client: Stripe,
  params: {
    paymentIntentId?: string;
    chargeId?: string;
    amount?: number; // in cents, omit for full refund
    reason?: Stripe.RefundCreateParams.Reason;
  }
): Promise<Stripe.Refund> {
  const refundParams: Stripe.RefundCreateParams = {};

  if (params.paymentIntentId) {
    refundParams.payment_intent = params.paymentIntentId;
  } else if (params.chargeId) {
    refundParams.charge = params.chargeId;
  } else {
    throw new Error("Either paymentIntentId or chargeId is required");
  }

  if (params.amount) {
    refundParams.amount = params.amount;
  }
  if (params.reason) {
    refundParams.reason = params.reason;
  }

  return client.refunds.create(refundParams);
}

/**
 * List refunds for a given charge or payment intent.
 */
export async function listRefunds(
  client: Stripe,
  params?: {
    chargeId?: string;
    paymentIntentId?: string;
    limit?: number;
  }
): Promise<Stripe.ApiList<Stripe.Refund>> {
  const listParams: Stripe.RefundListParams = {
    limit: params?.limit || 100,
  };
  if (params?.chargeId) {
    listParams.charge = params.chargeId;
  }
  if (params?.paymentIntentId) {
    listParams.payment_intent = params.paymentIntentId;
  }
  return client.refunds.list(listParams);
}

// ─── Customer helpers ─────────────────────────────────────────────────

/**
 * Get customer details with expanded subscriptions.
 */
export async function getCustomerDetails(
  client: Stripe,
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
  return client.customers.retrieve(customerId, {
    expand: ["subscriptions"],
  });
}

/**
 * Get invoices for a customer.
 */
export async function getCustomerInvoices(
  client: Stripe,
  customerId: string,
  params?: { limit?: number; starting_after?: string }
): Promise<Stripe.ApiList<Stripe.Invoice>> {
  return client.invoices.list({
    customer: customerId,
    limit: params?.limit || 20,
    ...(params?.starting_after && { starting_after: params.starting_after }),
  });
}

/**
 * Get charges for a customer.
 */
export async function getCustomerCharges(
  client: Stripe,
  customerId: string,
  params?: { limit?: number; starting_after?: string }
): Promise<Stripe.ApiList<Stripe.Charge>> {
  return client.charges.list({
    customer: customerId,
    limit: params?.limit || 20,
    ...(params?.starting_after && { starting_after: params.starting_after }),
  });
}

/**
 * Update customer metadata (e.g., mark as fraudulent).
 */
export async function updateCustomerMetadata(
  client: Stripe,
  customerId: string,
  metadata: Record<string, string>
): Promise<Stripe.Customer> {
  return client.customers.update(customerId, { metadata });
}

// ─── Dispute helpers ──────────────────────────────────────────────────

/**
 * Submit evidence for a dispute.
 */
export async function submitDisputeEvidence(
  client: Stripe,
  disputeId: string,
  evidence: Stripe.DisputeUpdateParams.Evidence
): Promise<Stripe.Dispute> {
  return client.disputes.update(disputeId, {
    evidence,
    submit: true,
  });
}

/**
 * Close a dispute (accept it without contesting).
 */
export async function closeDispute(
  client: Stripe,
  disputeId: string
): Promise<Stripe.Dispute> {
  return client.disputes.close(disputeId);
}

// ─── Balance / Stats helpers ──────────────────────────────────────────

/**
 * Get balance transactions for calculating revenue stats.
 */
export async function getBalanceTransactions(
  client: Stripe,
  params?: {
    created?: Stripe.RangeQueryParam;
    limit?: number;
    type?: string;
  }
): Promise<Stripe.ApiList<Stripe.BalanceTransaction>> {
  return client.balanceTransactions.list({
    limit: params?.limit || 100,
    ...(params?.created && { created: params.created }),
    ...(params?.type && { type: params.type }),
  });
}

// ─── Webhook event types ──────────────────────────────────────────────

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.refunded",
  "radar.early_fraud_warning.created",
  "customer.created",
  "customer.updated",
] as const;

export type StripeWebhookEvent = (typeof STRIPE_WEBHOOK_EVENTS)[number];
