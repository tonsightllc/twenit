import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processInboundEmail } from "@/lib/emails/process-inbound";

/**
 * Generic inbound email webhook.
 * Receives emails from Cloudflare Email Worker (or any external forwarder).
 * Resolves the org by matching the `to` address against email_configs.inbound_address.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get("x-inbound-secret");
      if (provided !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { from, to, subject, text, html, messageId, inReplyTo, replyTo } = await req.json();

    if (!from || !to) {
      return NextResponse.json({ error: "from and to are required" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const toEmail = to?.match(/<([^>]+)>/)?.[1] || to;

    const { data: config } = await supabase
      .from("email_configs")
      .select("org_id")
      .eq("inbound_address", toEmail)
      .eq("enabled", true)
      .maybeSingle();

    if (!config) {
      console.log(`No organization found for inbound address: ${toEmail}`);
      return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
    }

    await processInboundEmail(supabase, {
      orgId: config.org_id,
      from,
      to: toEmail,
      subject: subject || "(Sin asunto)",
      text,
      html,
      messageId: messageId || `inbound-${Date.now()}`,
      inReplyTo,
      replyTo,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing inbound webhook:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
