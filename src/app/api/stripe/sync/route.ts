import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { decrypt, isEncrypted } from "@/lib/encryption";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-01-28.clover" as const;

export async function POST() {
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
    .select("access_token")
    .eq("org_id", userProfile.org_id)
    .single();

  if (!connection?.access_token) {
    return NextResponse.json({ error: "Stripe no está conectado" }, { status: 400 });
  }

  const apiKey = isEncrypted(connection.access_token)
    ? decrypt(connection.access_token)
    : connection.access_token;

  const orgId = userProfile.org_id;
  const stripeClient = new Stripe(apiKey, { apiVersion: STRIPE_API_VERSION });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        } catch {
          // client disconnected
        }
      }

      let customersSynced = 0;
      let subscriptionsSynced = 0;

      try {
        // ── Phase 1: Customers (batch upsert) ───────────────────────────────────
        send({ phase: "customers", customers: 0, subscriptions: 0, done: false });

        const customerBatch: object[] = [];

        for await (const customer of stripeClient.customers.list({ limit: 100 })) {
          customerBatch.push({
            org_id: orgId,
            stripe_customer_id: customer.id,
            email: customer.email || "",
            name: customer.name || null,
            metadata: customer.metadata || {},
          });

          customersSynced++;

          // Flush batch every 100
          if (customerBatch.length >= 100) {
            await serviceClient.from("customers").upsert(
              [...customerBatch],
              { onConflict: "org_id,stripe_customer_id" }
            );
            customerBatch.length = 0;
            send({ phase: "customers", customers: customersSynced, subscriptions: 0, done: false });
          }
        }

        // Flush remaining customers
        if (customerBatch.length > 0) {
          await serviceClient.from("customers").upsert(
            [...customerBatch],
            { onConflict: "org_id,stripe_customer_id" }
          );
          customerBatch.length = 0;
        }

        send({ phase: "subscriptions", customers: customersSynced, subscriptions: 0, done: false });

        // ── Phase 2: Subscriptions (batch upsert) ────────────────────────────────
        // First build a local map of stripe_customer_id → db customer id
        const { data: dbCustomers } = await serviceClient
          .from("customers")
          .select("id, stripe_customer_id")
          .eq("org_id", orgId);

        const customerIdMap = new Map(
          (dbCustomers ?? []).map((c) => [c.stripe_customer_id, c.id])
        );

        const subBatch: object[] = [];

        for await (const sub of stripeClient.subscriptions.list({ limit: 100 })) {
          const dbCustomerId = customerIdMap.get(sub.customer as string);
          if (!dbCustomerId) continue;

          const raw = sub as unknown as { current_period_start?: number; current_period_end?: number };
          subBatch.push({
            org_id: orgId,
            customer_id: dbCustomerId,
            stripe_subscription_id: sub.id,
            stripe_price_id: sub.items.data[0]?.price.id || null,
            status: sub.status,
            current_period_start: raw.current_period_start
              ? new Date(raw.current_period_start * 1000).toISOString()
              : null,
            current_period_end: raw.current_period_end
              ? new Date(raw.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at
              ? new Date(sub.canceled_at * 1000).toISOString()
              : null,
          });

          subscriptionsSynced++;

          if (subBatch.length >= 100) {
            await serviceClient.from("subscriptions").upsert(
              [...subBatch],
              { onConflict: "org_id,stripe_subscription_id" }
            );
            subBatch.length = 0;
            send({ phase: "subscriptions", customers: customersSynced, subscriptions: subscriptionsSynced, done: false });
          }
        }

        // Flush remaining subscriptions
        if (subBatch.length > 0) {
          await serviceClient.from("subscriptions").upsert(
            [...subBatch],
            { onConflict: "org_id,stripe_subscription_id" }
          );
        }

        // ── Done ─────────────────────────────────────────────────────────────
        send({ phase: "done", customers: customersSynced, subscriptions: subscriptionsSynced, done: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        send({ phase: "error", error: msg, customers: customersSynced, subscriptions: subscriptionsSynced, done: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // disable nginx buffering if behind proxy
    },
  });
}
