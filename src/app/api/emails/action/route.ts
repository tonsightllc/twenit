import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

type ActionType = "unsubscribe" | "refund" | "pause" | "view_stripe";

// POST /api/emails/action — execute quick Stripe actions from inbox
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, action, customerId } = await request.json() as {
    emailId: string;
    action: ActionType;
    customerId?: string;
  };

  if (!emailId || !action) {
    return NextResponse.json({ error: "emailId and action are required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Fetch email to get the associated customer
  const { data: email } = await serviceClient
    .from("inbound_emails")
    .select("*, customers(id, stripe_customer_id, name, email)")
    .eq("id", emailId)
    .eq("org_id", orgId)
    .single();

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const customer = email.customers as {
    id: string;
    stripe_customer_id: string;
    name: string;
    email: string;
  } | null;

  if (!customer && action !== "view_stripe") {
    // Try to auto-link customer by email
    const { data: matchedCustomer } = await serviceClient
      .from("customers")
      .select("id, stripe_customer_id, name, email")
      .eq("org_id", orgId)
      .eq("email", email.from_email.replace(/.*<(.+)>/, "$1").trim())
      .maybeSingle();

    if (matchedCustomer) {
      // Link customer to email
      await serviceClient
        .from("inbound_emails")
        .update({ customer_id: matchedCustomer.id })
        .eq("id", emailId);
    }

    if (!matchedCustomer) {
      return NextResponse.json({ error: "No se encontró cliente vinculado" }, { status: 404 });
    }
  }

  const stripeCustomerId = customer?.stripe_customer_id ?? customerId;

  switch (action) {
    case "view_stripe": {
      const stripeId = customer?.stripe_customer_id ?? customerId;
      return NextResponse.json({
        success: true,
        action: "view_stripe",
        url: `https://dashboard.stripe.com/customers/${stripeId}`,
      });
    }

    case "unsubscribe": {
      // Forward to existing desuscripcion logic via internal fetch
      // For now, mark in DB and return link to manual action
      await serviceClient
        .from("inbound_emails")
        .update({
          labels: [...(email.labels ?? []), "cancelación_pendiente"],
          status: "processed",
        })
        .eq("id", emailId);

      return NextResponse.json({
        success: true,
        action: "unsubscribe",
        message: `Marcado para cancelación. Cliente: ${customer?.name ?? stripeCustomerId}`,
        stripeCustomerId,
        url: `/desuscripcion?customer=${stripeCustomerId}`,
      });
    }

    case "refund": {
      await serviceClient
        .from("inbound_emails")
        .update({
          labels: [...(email.labels ?? []), "reembolso_pendiente"],
          status: "processed",
        })
        .eq("id", emailId);

      return NextResponse.json({
        success: true,
        action: "refund",
        message: `Marcado para reembolso. Cliente: ${customer?.name ?? stripeCustomerId}`,
        stripeCustomerId,
      });
    }

    case "pause": {
      await serviceClient
        .from("inbound_emails")
        .update({
          labels: [...(email.labels ?? []), "pausa_pendiente"],
          status: "processed",
        })
        .eq("id", emailId);

      return NextResponse.json({
        success: true,
        action: "pause",
        message: `Marcado para pausar suscripción. Cliente: ${customer?.name ?? stripeCustomerId}`,
        stripeCustomerId,
      });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
