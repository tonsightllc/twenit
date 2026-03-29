import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { createEmailRoute } from "@/lib/cloudflare-email";

const INBOUND_DOMAIN = "mail.twenit.com";

function generateInboundAddress(slug: string): string {
  return `${slug}@${INBOUND_DOMAIN}`;
}

export async function GET() {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("email_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If no inbound_address yet, generate one from org slug
  if (data && !data.inbound_address) {
    const { data: org } = await serviceClient
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .single();

    if (org?.slug) {
      const inbound = generateInboundAddress(org.slug);
      await serviceClient
        .from("email_configs")
        .update({ inbound_address: inbound })
        .eq("org_id", orgId);
      data.inbound_address = inbound;
    }
  }

  // If no config exists yet, return a generated inbound_address for the UI
  if (!data) {
    const { data: org } = await serviceClient
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .single();

    return NextResponse.json({
      config: null,
      generatedInboundAddress: org?.slug ? generateInboundAddress(org.slug) : null,
    });
  }

  return NextResponse.json({ config: data });
}

export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    provider,
    email_address,
    credentials,
    connection_method,
    resend_domain,
    sender_name,
    reply_to_email,
    signature,
    logo_url,
    accent_color,
    show_footer,
    footer_text,
    custom_css,
    auto_classify,
    auto_respond,
    ai_model,
    ai_categories,
  } = body;

  const serviceClient = await createServiceClient();

  const { data: existing } = await serviceClient
    .from("email_configs")
    .select("id, inbound_address")
    .eq("org_id", orgId)
    .maybeSingle();

  // Generate inbound_address if not set
  let inboundAddress = existing?.inbound_address ?? null;
  if (!inboundAddress) {
    const { data: org } = await serviceClient
      .from("organizations")
      .select("slug")
      .eq("id", orgId)
      .single();
    if (org?.slug) {
      inboundAddress = generateInboundAddress(org.slug);
    }
  }

  const configData: Record<string, unknown> = {
    org_id: orgId,
    provider: provider ?? "none",
    email_address: email_address ?? "",
    credentials: credentials ?? {},
    connection_method: connection_method ?? "none",
    inbound_address: inboundAddress,
    resend_domain: resend_domain ?? null,
    sender_name: sender_name ?? null,
    reply_to_email: reply_to_email ?? null,
    signature: signature ?? null,
    logo_url: logo_url ?? null,
    accent_color: accent_color ?? "#fbbf24",
    show_footer: show_footer ?? true,
    footer_text: footer_text ?? null,
    custom_css: custom_css ?? null,
    auto_classify: auto_classify ?? false,
    auto_respond: auto_respond ?? false,
    ai_model: ai_model ?? "gpt-4o-mini",
    ai_categories: ai_categories ?? ["Soporte", "Facturación", "Ventas", "Cancelación", "Otro"],
  };

  // If switching to forwarding, register the address in Cloudflare Email Routing
  if (connection_method === "forwarding" && inboundAddress) {
    const existingMethod = existing
      ? (await serviceClient.from("email_configs").select("connection_method").eq("org_id", orgId).single()).data?.connection_method
      : null;

    if (existingMethod !== "forwarding") {
      try {
        const cfResult = await createEmailRoute(inboundAddress);
        if (!cfResult.success) {
          console.error("Cloudflare email route creation failed:", cfResult.error);
        }
      } catch (err) {
        console.error("Error creating Cloudflare email route:", err);
      }
    }
  }

  let result;
  if (existing) {
    result = await serviceClient
      .from("email_configs")
      .update(configData)
      .eq("org_id", orgId)
      .select()
      .single();
  } else {
    result = await serviceClient
      .from("email_configs")
      .insert(configData)
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ config: result.data });
}
