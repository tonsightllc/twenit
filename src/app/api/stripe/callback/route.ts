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

    // Redirect to onboarding — sync will be triggered from the settings UI via streaming endpoint
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
