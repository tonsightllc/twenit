import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { renderEmailHtml, renderCustomHtml, extractBranding } from "@/lib/emails/render";
import type { EmailBlock } from "@/emails/components/types";
import type { BrandingConfig } from "@/emails/components/base-layout";

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { blocks, subject, custom_html, branding: brandingOverrides } = (await request.json()) as {
    blocks?: EmailBlock[];
    subject?: string;
    custom_html?: string;
    branding?: Partial<BrandingConfig> & { showHeader?: boolean; showSignature?: boolean; showFooter?: boolean };
  };

  const supabase = await createServiceClient();
  const { data: emailConfig } = await supabase
    .from("email_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  const globalBranding = extractBranding(emailConfig);
  const mergedBranding: BrandingConfig = { ...globalBranding };

  if (brandingOverrides) {
    if (brandingOverrides.logoUrl !== undefined) mergedBranding.logoUrl = brandingOverrides.logoUrl;
    if (brandingOverrides.senderName !== undefined) mergedBranding.senderName = brandingOverrides.senderName;
    if (brandingOverrides.accentColor !== undefined) mergedBranding.accentColor = brandingOverrides.accentColor;
    if (brandingOverrides.showHeader === false) {
      mergedBranding.logoUrl = undefined;
      mergedBranding.senderName = undefined;
    }
    if (brandingOverrides.signature !== undefined) mergedBranding.signature = brandingOverrides.signature;
    if (brandingOverrides.showSignature === false) {
      mergedBranding.signature = undefined;
    }
    if (brandingOverrides.footerText !== undefined) mergedBranding.footerText = brandingOverrides.footerText;
    if (brandingOverrides.showFooter === false) {
      mergedBranding.showFooter = false;
      mergedBranding.footerText = undefined;
    } else if (brandingOverrides.showFooter === true) {
      mergedBranding.showFooter = true;
    }
  }

  try {
    let html: string;
    if (custom_html) {
      html = await renderCustomHtml(custom_html, mergedBranding, subject);
    } else {
      ({ html } = await renderEmailHtml(blocks ?? [], mergedBranding, subject));
    }
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Error rendering preview:", err);
    return NextResponse.json({ error: "Error al renderizar preview" }, { status: 500 });
  }
}
