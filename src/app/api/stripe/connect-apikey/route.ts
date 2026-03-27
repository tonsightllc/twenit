// This is a permanent alternative to OAuth Connect for connecting Stripe via a Restricted API Key.
// This approach avoids the need for Stripe Connect KYC platform verification on our end.

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encrypt } from "@/lib/encryption";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-01-28.clover" as const;
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "customer.created",
  "customer.updated",
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
  "checkout.session.completed",
];

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Get orgId
  const serviceClient = await createServiceClient();
  const { data: userProfile } = await serviceClient
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!userProfile?.org_id) {
    return NextResponse.json(
      { error: "Usuario sin organización" },
      { status: 400 }
    );
  }

  // Parse body
  const body = await request.json();
  const apiKey: string = body.apiKey?.trim();

  if (!apiKey || (!apiKey.startsWith("sk_live_") && !apiKey.startsWith("sk_test_") && !apiKey.startsWith("rk_live_") && !apiKey.startsWith("rk_test_"))) {
    return NextResponse.json(
      { error: "API key inválida. Debe empezar con sk_live_, sk_test_, rk_live_ o rk_test_" },
      { status: 400 }
    );
  }

  // Validate key by calling Stripe
  let account: Stripe.Account;
  const stripeClient = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });
  try {
    account = await stripeClient.accounts.retrieve();
  } catch {
    return NextResponse.json(
      { error: "API key inválida o sin permisos. Verificá que la key sea correcta y tenga permisos de lectura en tu cuenta." },
      { status: 400 }
    );
  }

  const isLive = apiKey.startsWith("sk_live_") || apiKey.startsWith("rk_live_");

  // Auto-register webhook in the user's Stripe account
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`;
  let webhookSecret: string | null = null;

  try {
    // Check if webhook already exists to avoid duplicates
    const existingWebhooks = await stripeClient.webhookEndpoints.list({ limit: 100 });
    const existing = existingWebhooks.data.find((wh) => wh.url === webhookUrl);

    if (existing) {
      // Can't retrieve existing secret — user needs to re-create or we store a placeholder
      console.log("[CONNECT-APIKEY] Webhook already registered:", existing.id);
      webhookSecret = null; // Will rely on stored secret if previously saved
    } else {
      const webhook = await stripeClient.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: WEBHOOK_EVENTS,
        description: "Twenit CRM — Auto-registered",
      });
      webhookSecret = webhook.secret || null;
      console.log("[CONNECT-APIKEY] Webhook registered:", webhook.id);
    }
  } catch (err) {
    // Non-fatal: webhook registration failed (e.g. restricted key lacks webhook permissions)
    // The user can still register it manually
    console.warn("[CONNECT-APIKEY] Could not auto-register webhook:", err);
  }

  // Encrypt and store
  const encryptedKey = encrypt(apiKey);
  const encryptedWebhookSecret = webhookSecret ? encrypt(webhookSecret) : null;

  const { error: dbError } = await serviceClient
    .from("stripe_connections")
    .upsert(
      {
        org_id: userProfile.org_id,
        stripe_account_id: account.id,
        access_token: encryptedKey,
        refresh_token: null,
        livemode: isLive,
        scope: "apikey",
        connection_type: "apikey",
        webhook_secret: encryptedWebhookSecret,
      },
      {
        onConflict: "org_id,stripe_account_id",
      }
    );

  if (dbError) {
    console.error("[CONNECT-APIKEY] DB error:", dbError);
    return NextResponse.json(
      { error: "Error al guardar la conexión" },
      { status: 500 }
    );
  }

  // Sync data in background (don't await to avoid timeout on large accounts)
  syncStripeData(userProfile.org_id, apiKey).catch((err) =>
    console.error("[CONNECT-APIKEY] Sync error:", err)
  );

  return NextResponse.json({
    success: true,
    accountId: account.id,
    livemode: isLive,
    webhookRegistered: webhookSecret !== null,
  });
}

async function syncStripeData(orgId: string, apiKey: string) {
  const supabase = await createServiceClient();
  const stripeClient = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });

  try {
    // Sync customers
    const customers = await stripeClient.customers
      .list({ limit: 100 })
      .autoPagingToArray({ limit: 10000 });

    for (const customer of customers) {
      await supabase.from("customers").upsert(
        {
          org_id: orgId,
          stripe_customer_id: customer.id,
          email: customer.email || "",
          name: customer.name || null,
          metadata: customer.metadata || {},
        },
        { onConflict: "org_id,stripe_customer_id" }
      );
    }

    // Sync subscriptions
    const subscriptions = await stripeClient.subscriptions
      .list({ limit: 100 })
      .autoPagingToArray({ limit: 10000 });

    for (const sub of subscriptions) {
      const { data: dbCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("org_id", orgId)
        .eq("stripe_customer_id", sub.customer as string)
        .single();

      if (dbCustomer) {
        const currentPeriodStart = (
          sub as unknown as { current_period_start?: number }
        ).current_period_start;
        const currentPeriodEnd = (
          sub as unknown as { current_period_end?: number }
        ).current_period_end;

        await supabase.from("subscriptions").upsert(
          {
            org_id: orgId,
            customer_id: dbCustomer.id,
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0]?.price.id || null,
            status: sub.status,
            current_period_start: currentPeriodStart
              ? new Date(currentPeriodStart * 1000).toISOString()
              : null,
            current_period_end: currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000).toISOString()
              : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at
              ? new Date(sub.canceled_at * 1000).toISOString()
              : null,
          },
          { onConflict: "org_id,stripe_subscription_id" }
        );
      }
    }
  } catch (err) {
    console.error("[CONNECT-APIKEY] Sync error:", err);
  }
}
