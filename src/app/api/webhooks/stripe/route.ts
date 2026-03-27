import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { decrypt, isEncrypted } from "@/lib/encryption";
import {
  handleCustomerEvent,
  handleSubscriptionEvent,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleDisputeCreated,
  handleDisputeUpdated,
  handleEfwCreated,
  handleCheckoutCompleted,
} from "@/lib/stripe/events";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  let event: Stripe.Event;
  let orgId: string | null = null;

  // ── Mode A: Stripe Connect (OAuth) ──────────────────────────────────────────
  // Events from connected accounts have an `account` field.
  // We verify with the shared platform webhook secret.
  const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (platformSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, platformSecret);

      const accountId = event.account;
      if (accountId) {
        const { data: connection, error: dbError } = await supabase
          .from("stripe_connections")
          .select("org_id")
          .eq("stripe_account_id", accountId)
          .single();

        if (dbError) {
          console.error(`[Webhook] DB error for account ${accountId}:`, dbError);
        }
        orgId = connection?.org_id || null;

        if (!orgId) {
          console.warn(`[Webhook] No org found for Connect account: ${accountId}`);
          return NextResponse.json({ received: true });
        }

        console.log(`[Webhook/Connect] Processing ${event.type} for org ${orgId}`);
        await processEvent(supabase, event, orgId);
        return NextResponse.json({ received: true });
      }

      // Platform-level event with no account — ignore
      console.log(`[Webhook] Ignoring platform event (no accountId): ${event.type}`);
      return NextResponse.json({ received: true });
    } catch {
      // Verification failed with platform secret — try API Key mode below
    }
  }

  // ── Mode B: API Key Connection ────────────────────────────────────────────
  // Events come directly from the customer's own Stripe account.
  // We find the org by checking all stored per-org webhook secrets.
  const { data: apiKeyConnections } = await supabase
    .from("stripe_connections")
    .select("org_id, webhook_secret")
    .eq("connection_type", "apikey")
    .not("webhook_secret", "is", null);

  if (apiKeyConnections && apiKeyConnections.length > 0) {
    for (const conn of apiKeyConnections) {
      try {
        const rawSecret = conn.webhook_secret as string;
        const secret = isEncrypted(rawSecret) ? decrypt(rawSecret) : rawSecret;

        event = stripe.webhooks.constructEvent(body, signature, secret);
        orgId = conn.org_id;
        console.log(`[Webhook/ApiKey] Processing ${event.type} for org ${orgId}`);
        await processEvent(supabase, event, orgId);
        return NextResponse.json({ received: true });
      } catch {
        // Not this org's secret, try next
        continue;
      }
    }
  }

  console.error("[Webhook] Could not verify signature against any known secret");
  return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
}

// ── Shared event processing logic ────────────────────────────────────────────
async function processEvent(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  event: Stripe.Event,
  orgId: string
) {
  // Log the event
  await supabase.from("stripe_events").insert({
    org_id: orgId,
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  try {
    switch (event.type) {
      case "customer.created":
      case "customer.updated":
        await handleCustomerEvent(supabase, orgId, event.data.object as Stripe.Customer);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(supabase, orgId, event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(supabase, orgId, event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(supabase, orgId, event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(supabase, orgId, event.data.object as Stripe.Invoice);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(supabase, orgId, event.data.object as Stripe.Dispute);
        break;

      case "charge.dispute.updated":
      case "charge.dispute.closed":
        await handleDisputeUpdated(supabase, orgId, event.data.object as Stripe.Dispute);
        break;

      case "radar.early_fraud_warning.created":
        await handleEfwCreated(supabase, orgId, event.data.object as Stripe.Radar.EarlyFraudWarning);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, orgId, event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        break;
    }

    // Mark event as processed
    const { error: updateError } = await supabase
      .from("stripe_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id)
      .eq("org_id", orgId);

    if (updateError) {
      console.error(`[Webhook] Failed to mark event ${event.id} as processed:`, updateError);
    }
  } catch (error) {
    console.error(`[Webhook] CRITICAL Error processing ${event.type} for org ${orgId}:`, error);
  }
}
