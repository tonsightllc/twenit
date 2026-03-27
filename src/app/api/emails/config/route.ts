import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/emails/config — fetch org email config
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

  return NextResponse.json({ config: data });
}

// POST /api/emails/config — save org email config
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

  // Check if config exists for this org
  const { data: existing } = await serviceClient
    .from("email_configs")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle();

  const configData = {
    org_id: orgId,
    provider: provider ?? "none",
    email_address: email_address ?? "",
    credentials: credentials ?? {},
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
