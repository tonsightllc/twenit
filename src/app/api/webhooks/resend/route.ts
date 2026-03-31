import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processInboundEmail } from "@/lib/emails/process-inbound";

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("svix-signature") ?? req.headers.get("x-resend-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
    }

    const payload = await req.json();

    const eventData = payload.data ?? payload;
    const {
      from, to, subject, text, html, headers,
      email_id: resendEmailId,
    } = eventData;

    const messageId = headers?.["message-id"] || `resend-${Date.now()}`;
    const inReplyTo = headers?.["in-reply-to"] ?? null;
    const replyToHeader = headers?.["reply-to"] ?? null;
    const fromEmail = from?.match(/<([^>]+)>/)?.[1] || from;

    const supabase = await createServiceClient();
    const recipients = Array.isArray(to) ? to : [to];

    for (const recipient of recipients) {
      const toEmail = recipient?.match(/<([^>]+)>/)?.[1] || recipient;
      const toDomain = toEmail?.includes("@") ? toEmail.split("@")[1] : null;

      const { data: configs } = await supabase
        .from("email_configs")
        .select("org_id, credentials")
        .or(
          `email_address.eq.${toEmail},inbound_address.eq.${toEmail}${toDomain ? `,resend_domain.eq.${toDomain}` : ""}`
        )
        .eq("enabled", true);

      const config = configs?.[0];
      if (!config) {
        console.log(`No organization found for recipient: ${toEmail}`);
        continue;
      }

      let emailText = text ?? null;
      let emailHtml = html ?? null;

      if (!emailText && !emailHtml && resendEmailId) {
        const clientKey = (config.credentials as { resend_api_key?: string })?.resend_api_key;
        const apiKey = clientKey || process.env.RESEND_API_KEY;

        if (apiKey) {
          try {
            const res = await fetch(`https://api.resend.com/emails/${resendEmailId}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (res.ok) {
              const full = await res.json();
              emailText = full.text ?? null;
              emailHtml = full.html ?? null;
            }
          } catch (err) {
            console.error("Error fetching email body from Resend API:", err);
          }
        }
      }

      await processInboundEmail(supabase, {
        orgId: config.org_id,
        from: fromEmail,
        to: toEmail,
        subject: subject || "(Sin asunto)",
        text: emailText,
        html: emailHtml,
        messageId,
        inReplyTo,
        replyTo: replyToHeader,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
