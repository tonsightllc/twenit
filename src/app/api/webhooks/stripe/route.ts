import { createServiceClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
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

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Get org_id from the connected account
  const accountId = event.account;

  let orgId: string | null = null;

  if (accountId) {
    const { data: connection } = await supabase
      .from("stripe_connections")
      .select("org_id")
      .eq("stripe_account_id", accountId)
      .single();

    orgId = connection?.org_id || null;
  }

  if (!orgId) {
    console.log("No org found for account:", accountId);
    return NextResponse.json({ received: true });
  }

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
        await handleCustomerEvent(
          supabase,
          orgId,
          event.data.object as Stripe.Customer
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(
          supabase,
          orgId,
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          supabase,
          orgId,
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.paid":
        await handleInvoicePaid(
          supabase,
          orgId,
          event.data.object as Stripe.Invoice
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          supabase,
          orgId,
          event.data.object as Stripe.Invoice
        );
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(
          supabase,
          orgId,
          event.data.object as Stripe.Dispute
        );
        break;

      case "charge.dispute.updated":
      case "charge.dispute.closed":
        await handleDisputeUpdated(
          supabase,
          orgId,
          event.data.object as Stripe.Dispute
        );
        break;

      case "radar.early_fraud_warning.created":
        await handleEfwCreated(
          supabase,
          orgId,
          event.data.object as Stripe.Radar.EarlyFraudWarning
        );
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(
          supabase,
          orgId,
          event.data.object as Stripe.Checkout.Session
        );
        break;
    }

    // Mark event as processed
    await supabase
      .from("stripe_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id)
      .eq("org_id", orgId);
  } catch (error) {
    console.error("Error processing webhook:", error);
  }

  return NextResponse.json({ received: true });
}
