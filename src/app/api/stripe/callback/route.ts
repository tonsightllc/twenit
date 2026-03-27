import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { encrypt } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // org_id
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/stripe?error=${error}`, process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/stripe?error=missing_params", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  try {
    // Exchange code for access token
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const supabase = await createServiceClient();

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(response.access_token!);
    const encryptedRefreshToken = response.refresh_token
      ? encrypt(response.refresh_token)
      : null;

    const { error: dbError } = await supabase.from("stripe_connections").upsert(
      {
        org_id: state,
        stripe_account_id: response.stripe_user_id!,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        livemode: response.livemode || false,
        scope: response.scope || "",
      },
      {
        onConflict: "org_id,stripe_account_id",
      }
    );

    if (dbError) {
      console.error("Error storing Stripe connection:", dbError);
      return NextResponse.redirect(
        new URL("/settings/stripe?error=db_error", process.env.NEXT_PUBLIC_APP_URL)
      );
    }

    // Trigger initial sync of customers and subscriptions
    await syncStripeData(state, response.access_token!);

    // Redirect to the new Onboarding screen instead of silent success
    return NextResponse.redirect(
      new URL("/settings/stripe/onboarding", process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (error) {
    console.error("Stripe OAuth error:", error);
    return NextResponse.redirect(
      new URL("/settings/stripe?error=oauth_failed", process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}

async function syncStripeData(orgId: string, accessToken: string) {
  const supabase = await createServiceClient();
  const stripeClient = new (await import("stripe")).default(accessToken, {
    apiVersion: "2026-01-28.clover",
  });

  try {
    // Sync customers (auto-paginated up to 10000 to prevent edge function timeouts)
    const customers = await stripeClient.customers.list({ limit: 100 }).autoPagingToArray({ limit: 10000 });
    
    for (const customer of customers) {
      await supabase.from("customers").upsert(
        {
          org_id: orgId,
          stripe_customer_id: customer.id,
          email: customer.email || "",
          name: customer.name || null,
          metadata: customer.metadata || {},
          // activation_status omitted so it defaults to 'pending' on insert
          // and doesn't overwrite existing users' status on update
        },
        {
          onConflict: "org_id,stripe_customer_id",
        }
      );
    }

    // Sync subscriptions
    const subscriptions = await stripeClient.subscriptions.list({ limit: 100 }).autoPagingToArray({ limit: 10000 });
    
    for (const sub of subscriptions) {
      // First get or create the customer
      const { data: dbCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("org_id", orgId)
        .eq("stripe_customer_id", sub.customer as string)
        .single();

      if (dbCustomer) {
        // Get period dates from items or subscription
        const currentPeriodStart = (sub as unknown as { current_period_start?: number }).current_period_start;
        const currentPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        
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
          {
            onConflict: "org_id,stripe_subscription_id",
          }
        );
      }
    }
  } catch (error) {
    console.error("Error syncing Stripe data:", error);
  }
}
