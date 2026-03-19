import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  // Use service client to bypass RLS when fetching user profile
  const serviceClient = await createServiceClient();
  const { data: userProfile } = await serviceClient
    .from("users")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!userProfile?.org_id) {
    // Auto-create org if user exists in auth but has no profile/org
    const metadata = user.user_metadata || {};
    const fullName = (metadata.full_name as string) || user.email?.split("@")[0] || "";
    const orgName = (metadata.org_name as string) || fullName || "Mi Organización";
    const slug = (orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) || "org";

    const { data: org } = await serviceClient
      .from("organizations")
      .insert({ name: orgName, slug: `${slug}-${Date.now()}` })
      .select()
      .single();

    if (!org) {
      console.error("[STRIPE CONNECT] Failed to create org for user:", user.id);
      return NextResponse.redirect(new URL("/settings/stripe?error=no_org", process.env.NEXT_PUBLIC_APP_URL));
    }

    if (userProfile) {
      // User exists but no org - update
      await serviceClient.from("users").update({ org_id: org.id, role: "owner" }).eq("id", user.id);
    } else {
      // User doesn't exist - create
      await serviceClient.from("users").insert({
        id: user.id,
        email: user.email || "",
        full_name: fullName,
        org_id: org.id,
        role: "owner",
      });
    }

    // Create default unsubscription rules
    await serviceClient.from("unsubscription_rules").insert({
      org_id: org.id,
      immediate_cancel: true,
      offer_benefit_first: false,
    });

    // Now proceed with the org_id
    const stripeOAuthUrl = new URL("https://connect.stripe.com/oauth/authorize");
    stripeOAuthUrl.searchParams.set("response_type", "code");
    stripeOAuthUrl.searchParams.set("client_id", process.env.STRIPE_CLIENT_ID || "");
    stripeOAuthUrl.searchParams.set("scope", "read_write");
    stripeOAuthUrl.searchParams.set("state", org.id);
    stripeOAuthUrl.searchParams.set(
      "redirect_uri",
      `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/callback`
    );

    return NextResponse.redirect(stripeOAuthUrl.toString());
  }

  // Normal flow - user has org
  const stripeOAuthUrl = new URL("https://connect.stripe.com/oauth/authorize");
  stripeOAuthUrl.searchParams.set("response_type", "code");
  stripeOAuthUrl.searchParams.set("client_id", process.env.STRIPE_CLIENT_ID || "");
  stripeOAuthUrl.searchParams.set("scope", "read_write");
  stripeOAuthUrl.searchParams.set("state", userProfile.org_id);
  stripeOAuthUrl.searchParams.set(
    "redirect_uri",
    `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/callback`
  );

  return NextResponse.redirect(stripeOAuthUrl.toString());
}
