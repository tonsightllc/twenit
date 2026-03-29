import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { decrypt, isEncrypted } from "@/lib/encryption";
import Stripe from "stripe";

const STRIPE_API_VERSION = "2026-01-28.clover" as const;
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`;

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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

  // Fetch connection details before deleting
  const { data: connection } = await serviceClient
    .from("stripe_connections")
    .select("access_token, connection_type")
    .eq("org_id", userProfile.org_id)
    .single();

  // If connected via API Key, remove the auto-registered webhook from Stripe
  if (connection?.connection_type === "apikey" && connection?.access_token) {
    try {
      const rawKey = isEncrypted(connection.access_token)
        ? decrypt(connection.access_token)
        : connection.access_token;

      const stripeClient = new Stripe(rawKey, { apiVersion: STRIPE_API_VERSION });
      const webhooks = await stripeClient.webhookEndpoints.list({ limit: 100 });
      const ours = webhooks.data.find((wh) => wh.url === WEBHOOK_URL);

      if (ours) {
        await stripeClient.webhookEndpoints.del(ours.id);
        console.log(`[DISCONNECT] Deleted webhook ${ours.id} from Stripe`);
      }
    } catch (err) {
      // Non-fatal — if the key was revoked or webhook already deleted, proceed anyway
      console.warn("[DISCONNECT] Could not delete webhook from Stripe:", err);
    }
  }

  // Delete the Stripe connection from our DB
  const { error } = await serviceClient
    .from("stripe_connections")
    .delete()
    .eq("org_id", userProfile.org_id);

  if (error) {
    return NextResponse.json({ error: "Error al desconectar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
