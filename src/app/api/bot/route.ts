import { createServiceClient } from "@/lib/supabase/server";
import {
  getStripeClientForOrg,
  cancelSubscription,
  pauseSubscription,
  createRefund,
} from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orgId = searchParams.get("orgId");
  const botId = searchParams.get("botId");

  if (!orgId) {
    return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  let query = supabase
    .from("bot_configs")
    .select("id, name, tree_config, styles")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (botId) {
    query = query.eq("id", botId);
  }

  const { data, error } = await query.limit(1).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient();
  const body = await request.json();

  const { orgId, action, subscriptionId, chargeId, paymentIntentId, amount } =
    body;

  if (!orgId || !action) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Get Stripe client for this org
  const stripeData = await getStripeClientForOrg(orgId);
  if (!stripeData) {
    return NextResponse.json(
      { error: "No Stripe connection found" },
      { status: 400 }
    );
  }

  const { client } = stripeData;

  try {
    switch (action) {
      case "cancel_subscription": {
        if (!subscriptionId) {
          return NextResponse.json(
            { error: "Missing subscriptionId" },
            { status: 400 }
          );
        }

        const sub = await cancelSubscription(client, subscriptionId, true);

        // Update local DB
        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("org_id", orgId)
          .eq("stripe_subscription_id", subscriptionId);

        return NextResponse.json({
          success: true,
          message: "Suscripción cancelada",
          data: { id: sub.id, status: sub.status },
        });
      }

      case "pause_subscription": {
        if (!subscriptionId) {
          return NextResponse.json(
            { error: "Missing subscriptionId" },
            { status: 400 }
          );
        }

        const sub = await pauseSubscription(client, subscriptionId);
        return NextResponse.json({
          success: true,
          message: "Suscripción pausada",
          data: { id: sub.id, status: sub.status },
        });
      }

      case "refund": {
        if (!chargeId && !paymentIntentId) {
          return NextResponse.json(
            { error: "chargeId o paymentIntentId es requerido" },
            { status: 400 }
          );
        }

        // Check refund rules for this org
        const { data: rules } = await supabase
          .from("unsubscription_rules")
          .select("refund_rules")
          .eq("org_id", orgId)
          .single();

        const refundRules = (rules?.refund_rules as {
          auto_refund_below: number | null;
          require_approval_above: number | null;
          max_refund_days: number;
        }) || {
          auto_refund_below: null,
          require_approval_above: null,
          max_refund_days: 30,
        };

        // If amount is specified and exceeds approval threshold, create ticket instead
        const refundAmountCents = amount ? Math.round(amount) : undefined;
        const refundAmountDollars = refundAmountCents
          ? refundAmountCents / 100
          : undefined;

        if (
          refundRules.require_approval_above &&
          refundAmountDollars &&
          refundAmountDollars > refundRules.require_approval_above
        ) {
          // Create a ticket for manual approval
          await supabase.from("support_tickets").insert({
            org_id: orgId,
            source: "bot",
            status: "open",
            category: "refund_request",
            subject: `Solicitud de refund: $${refundAmountDollars.toFixed(2)} - Requiere aprobación`,
            messages: [
              {
                id: crypto.randomUUID(),
                sender_type: "bot",
                content: `Refund solicitado via bot. Monto: $${refundAmountDollars.toFixed(2)}. Cargo: ${chargeId || paymentIntentId}. Excede el límite de auto-aprobación ($${refundRules.require_approval_above}).`,
                created_at: new Date().toISOString(),
              },
            ],
          });

          return NextResponse.json({
            success: true,
            message:
              "Solicitud de refund enviada para aprobación manual",
            requiresApproval: true,
          });
        }

        // Auto-refund if below threshold or no threshold set
        if (
          refundRules.auto_refund_below === null ||
          !refundAmountDollars ||
          refundAmountDollars <= refundRules.auto_refund_below
        ) {
          const refund = await createRefund(client, {
            chargeId,
            paymentIntentId,
            amount: refundAmountCents,
          });

          return NextResponse.json({
            success: true,
            message: `Refund de $${((refund.amount || 0) / 100).toFixed(2)} procesado`,
            data: {
              id: refund.id,
              amount: refund.amount,
              status: refund.status,
            },
          });
        }

        // If amount is between auto threshold and approval threshold, create ticket
        await supabase.from("support_tickets").insert({
          org_id: orgId,
          source: "bot",
          status: "open",
          category: "refund_request",
          subject: `Solicitud de refund: $${(refundAmountDollars || 0).toFixed(2)}`,
          messages: [
            {
              id: crypto.randomUUID(),
              sender_type: "bot",
              content: `Refund solicitado via bot. Monto: $${(refundAmountDollars || 0).toFixed(2)}. Cargo: ${chargeId || paymentIntentId}.`,
              created_at: new Date().toISOString(),
            },
          ],
        });

        return NextResponse.json({
          success: true,
          message: "Solicitud de refund enviada para revisión",
          requiresApproval: true,
        });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Stripe action error:", error);
    const stripeError = error as { message?: string };
    return NextResponse.json(
      { error: stripeError.message || "Action failed" },
      { status: 500 }
    );
  }
}
