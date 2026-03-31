import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { decrypt, isEncrypted } from "@/lib/encryption";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-01-28.clover" as const;

interface CustomerRow {
  org_id: string;
  stripe_customer_id: string;
  email: string;
  name: string | null;
  metadata: Record<string, string>;
}

interface SubscriptionRow {
  stripe_customer_id: string;
  org_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

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

      try {
        // ── Phase 1: Fetch & count all data from Stripe ───────────────────
        send({ phase: "counting", customers: 0, subscriptions: 0, totalCustomers: 0, totalSubscriptions: 0, done: false });

        const allCustomers: CustomerRow[] = [];
        for await (const customer of stripeClient.customers.list({ limit: 100 })) {
          allCustomers.push({
            org_id: orgId,
            stripe_customer_id: customer.id,
            email: customer.email || "",
            name: customer.name || null,
            metadata: customer.metadata || {},
          });

          if (allCustomers.length % 100 === 0) {
            send({ phase: "counting", customers: 0, subscriptions: 0, totalCustomers: allCustomers.length, totalSubscriptions: 0, done: false });
          }
        }

        const totalCustomers = allCustomers.length;
        send({ phase: "counting", customers: 0, subscriptions: 0, totalCustomers, totalSubscriptions: 0, done: false });

        const allSubscriptions: SubscriptionRow[] = [];
        for await (const sub of stripeClient.subscriptions.list({ limit: 100, status: "all" })) {
          const raw = sub as unknown as { current_period_start?: number; current_period_end?: number };
          allSubscriptions.push({
            stripe_customer_id: sub.customer as string,
            org_id: orgId,
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

          if (allSubscriptions.length % 100 === 0) {
            send({ phase: "counting", customers: 0, subscriptions: 0, totalCustomers, totalSubscriptions: allSubscriptions.length, done: false });
          }
        }

        const totalSubscriptions = allSubscriptions.length;
        send({ phase: "counting", customers: 0, subscriptions: 0, totalCustomers, totalSubscriptions, done: false });

        // ── Phase 2: Sync customers (batch upsert) ────────────────────────
        let customersSynced = 0;
        send({ phase: "customers", customers: 0, subscriptions: 0, totalCustomers, totalSubscriptions, done: false });

        for (let i = 0; i < allCustomers.length; i += 100) {
          const batch = allCustomers.slice(i, i + 100);
          await serviceClient.from("customers").upsert(
            batch,
            { onConflict: "org_id,stripe_customer_id" }
          );
          customersSynced += batch.length;
          send({ phase: "customers", customers: customersSynced, subscriptions: 0, totalCustomers, totalSubscriptions, done: false });
        }

        // ── Phase 3: Sync subscriptions (batch upsert) ───────────────────
        const { data: dbCustomers } = await serviceClient
          .from("customers")
          .select("id, stripe_customer_id")
          .eq("org_id", orgId);

        const customerIdMap = new Map(
          (dbCustomers ?? []).map((c) => [c.stripe_customer_id, c.id])
        );

        let subscriptionsSynced = 0;
        send({ phase: "subscriptions", customers: customersSynced, subscriptions: 0, totalCustomers, totalSubscriptions, done: false });

        const subBatch: object[] = [];
        for (const sub of allSubscriptions) {
          const dbCustomerId = customerIdMap.get(sub.stripe_customer_id);
          if (!dbCustomerId) continue;

          subBatch.push({
            org_id: orgId,
            customer_id: dbCustomerId,
            stripe_subscription_id: sub.stripe_subscription_id,
            stripe_price_id: sub.stripe_price_id,
            status: sub.status,
            current_period_start: sub.current_period_start,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at,
          });

          if (subBatch.length >= 100) {
            await serviceClient.from("subscriptions").upsert(
              [...subBatch],
              { onConflict: "org_id,stripe_subscription_id" }
            );
            subscriptionsSynced += subBatch.length;
            subBatch.length = 0;
            send({ phase: "subscriptions", customers: customersSynced, subscriptions: subscriptionsSynced, totalCustomers, totalSubscriptions, done: false });
          }
        }

        if (subBatch.length > 0) {
          await serviceClient.from("subscriptions").upsert(
            [...subBatch],
            { onConflict: "org_id,stripe_subscription_id" }
          );
          subscriptionsSynced += subBatch.length;
        }

        // ── Done ──────────────────────────────────────────────────────────
        send({ phase: "done", customers: customersSynced, subscriptions: subscriptionsSynced, totalCustomers, totalSubscriptions, done: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        send({ phase: "error", error: msg, customers: 0, subscriptions: 0, totalCustomers: 0, totalSubscriptions: 0, done: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
