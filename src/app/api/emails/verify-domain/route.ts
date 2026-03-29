import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";

// POST /api/emails/verify-domain — verify DNS records for a Resend domain
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domain } = await request.json();
  if (!domain) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    // Check if domain already exists in Resend
    const { data: allDomains, error: listError } = await resend.domains.list();
    if (listError) throw listError;

    let domainData: Record<string, unknown> | undefined = allDomains?.data?.find((d) => d.name === domain);

    if (!domainData) {
      const { data: created, error: createError } = await resend.domains.create({
        name: domain,
      });
      if (createError) throw createError;
      domainData = created as Record<string, unknown> | undefined;
    } else {
      await resend.domains.verify(domainData.id as string);
      const { data: refreshed } = await resend.domains.get(domainData.id as string);
      domainData = refreshed as Record<string, unknown> | undefined;
    }

    const serviceClient = await createServiceClient();
    await serviceClient
      .from("email_configs")
      .upsert({
        org_id: orgId,
        provider: "resend_domain",
        email_address: `noreply@${domain}`,
        credentials: {},
        resend_domain: domain,
        resend_domain_id: (domainData?.id as string) ?? null,
        resend_domain_verified: domainData?.status === "verified",
      }, { onConflict: "org_id" });

    return NextResponse.json({
      domain: domainData,
      verified: domainData?.status === "verified",
      records: (domainData?.records as unknown[]) ?? [
        { type: "MX", name: "@", value: "inbound.resend.com", priority: 10, status: "pending" },
        { type: "TXT", name: "@", value: "v=spf1 include:resend.com ~all", status: "pending" },
      ],
    });
  } catch (err) {
    console.error("Domain verification error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
