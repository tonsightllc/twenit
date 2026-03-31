import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { renderEmailHtml, extractBranding } from "@/lib/emails/render";
import type { EmailBlock } from "@/emails/components/types";

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blocks, subject } = (await request.json()) as {
    blocks: EmailBlock[];
    subject?: string;
  };

  const supabase = await createServiceClient();
  const { data: emailConfig } = await supabase
    .from("email_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  const branding = extractBranding(emailConfig);

  try {
    const { html } = await renderEmailHtml(blocks, branding, subject);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Error rendering preview:", err);
    return NextResponse.json({ error: "Error al renderizar preview" }, { status: 500 });
  }
}
