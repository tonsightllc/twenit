// Registers (or re-registers) a webhook in the user's Stripe account and stores the signing secret.
// If a webhook already exists at our URL, deletes it first so we can get a fresh secret.

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { decrypt, encrypt, isEncrypted } from "@/lib/encryption";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const serviceClient = await createServiceClient();
  const { data: userProfile } = await serviceClient
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!userProfile?.org_id) {
    return NextResponse.json({ error: "No hay organización" }, { status: 400 });
  }
  if (userProfile.role !== "owner" && userProfile.role !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { data: connection } = await serviceClient
    .from("stripe_connections")
    .select("access_token, connection_type")
    .eq("org_id", userProfile.org_id)
    .single();

  if (!connection?.access_token || connection.connection_type !== "apikey") {
    return NextResponse.json(
      { error: "Solo disponible para conexiones por API Key" },
      { status: 400 }
    );
  }

  // Check if user manually provided a whsec_ secret
  const body = await request.json().catch(() => ({})) as { manualSecret?: string };
  if (body.manualSecret?.startsWith("whsec_")) {
    // Store the manually provided secret (encrypted)
    const { error } = await serviceClient
      .from("stripe_connections")
      .update({ webhook_secret: encrypt(body.manualSecret) })
      .eq("org_id", userProfile.org_id);

    if (error) return NextResponse.json({ error: "Error al guardar el secret" }, { status: 500 });
    return NextResponse.json({ success: true, method: "manual" });
  }

  // Try to auto-register via Stripe API
  const apiKey = isEncrypted(connection.access_token)
    ? decrypt(connection.access_token)
    : connection.access_token;

  const stripeClient = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`;

  try {
    // Delete any existing webhook at our URL to get a fresh secret
    const existing = await stripeClient.webhookEndpoints.list({ limit: 100 });
    for (const wh of existing.data) {
      if (wh.url === webhookUrl) {
        await stripeClient.webhookEndpoints.del(wh.id);
        console.log(`[REGISTER-WEBHOOK] Deleted existing webhook ${wh.id}`);
      }
    }

    // Create fresh webhook
    const webhook = await stripeClient.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
      description: "Twenit CRM — Auto-registered",
    });

    if (!webhook.secret) {
      return NextResponse.json(
        { error: "Stripe no devolvió el secret del webhook", needsManual: true },
        { status: 500 }
      );
    }

    // Store encrypted
    await serviceClient
      .from("stripe_connections")
      .update({ webhook_secret: encrypt(webhook.secret) })
      .eq("org_id", userProfile.org_id);

    console.log(`[REGISTER-WEBHOOK] Registered webhook ${webhook.id}`);
    return NextResponse.json({ success: true, method: "auto", webhookId: webhook.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.warn("[REGISTER-WEBHOOK] Auto-registration failed:", msg);
    return NextResponse.json(
      { error: msg, needsManual: true },
      { status: 422 }
    );
  }
}
