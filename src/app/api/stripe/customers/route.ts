import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  getStripeClientForOrg,
  getCustomerDetails,
  getCustomerInvoices,
  getCustomerCharges,
  listRefunds,
} from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(request: NextRequest) {
  // Authenticate user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const { data: userProfile } = await serviceClient
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!userProfile?.org_id) {
    return NextResponse.json(
      { error: "No hay organización" },
      { status: 400 }
    );
  }

  // Get Stripe client for the org
  const stripeData = await getStripeClientForOrg(userProfile.org_id);
  if (!stripeData) {
    return NextResponse.json(
      { error: "Stripe no está conectado" },
      { status: 400 }
    );
  }

  const { client } = stripeData;
  const searchParams = request.nextUrl.searchParams;
  const stripeCustomerId = searchParams.get("customerId");
  const includeInvoices = searchParams.get("invoices") === "true";
  const includeCharges = searchParams.get("charges") === "true";
  const includeRefunds = searchParams.get("refunds") === "true";
  const startingAfter = searchParams.get("starting_after") || undefined;
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "customerId es requerido" },
      { status: 400 }
    );
  }

  try {
    // If only requesting specific sub-resources
    if (includeInvoices) {
      const invoices = await getCustomerInvoices(client, stripeCustomerId, {
        limit,
        starting_after: startingAfter,
      });
      return NextResponse.json({ invoices: invoices.data, has_more: invoices.has_more });
    }

    if (includeCharges) {
      const charges = await getCustomerCharges(client, stripeCustomerId, {
        limit,
        starting_after: startingAfter,
      });
      return NextResponse.json({ charges: charges.data, has_more: charges.has_more });
    }

    if (includeRefunds) {
      const refunds = await listRefunds(client, { limit });
      // Filter by customer's charges - we get recent charges first
      const charges = await getCustomerCharges(client, stripeCustomerId, { limit: 100 });
      const chargeIds = new Set(charges.data.map((c) => c.id));
      const customerRefunds = refunds.data.filter(
        (r) => r.charge && chargeIds.has(typeof r.charge === "string" ? r.charge : r.charge.id)
      );
      return NextResponse.json({ refunds: customerRefunds });
    }

    // Default: return full customer details with subscriptions, recent invoices, and charges
    const [customer, invoices, charges] = await Promise.all([
      getCustomerDetails(client, stripeCustomerId),
      getCustomerInvoices(client, stripeCustomerId, { limit: 10 }),
      getCustomerCharges(client, stripeCustomerId, { limit: 10 }),
    ]);

    if ((customer as Stripe.DeletedCustomer).deleted) {
      return NextResponse.json(
        { error: "Cliente eliminado en Stripe" },
        { status: 404 }
      );
    }

    const cust = customer as Stripe.Customer;

    return NextResponse.json({
      customer: {
        id: cust.id,
        email: cust.email,
        name: cust.name,
        phone: cust.phone,
        metadata: cust.metadata,
        created: cust.created,
        currency: cust.currency,
        balance: cust.balance,
        delinquent: cust.delinquent,
        default_source: cust.default_source,
      },
      subscriptions: cust.subscriptions?.data || [],
      invoices: invoices.data,
      charges: charges.data,
      has_more_invoices: invoices.has_more,
      has_more_charges: charges.has_more,
    });
  } catch (error) {
    console.error("Error fetching customer data:", error);
    const stripeError = error as { message?: string };
    return NextResponse.json(
      { error: stripeError.message || "Error al obtener datos del cliente" },
      { status: 500 }
    );
  }
}
