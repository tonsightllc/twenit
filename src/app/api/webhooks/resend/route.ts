import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { triggerAutomation } from "@/lib/automation";

export async function POST(req: NextRequest) {
  try {
    // Validate optional webhook secret
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("svix-signature") ?? req.headers.get("x-resend-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }
    }

    const payload = await req.json();

    const { from, to, subject, text, html, headers } = payload;
    const messageId = headers?.["message-id"] || `resend-${Date.now()}`;
    const inReplyTo = headers?.["in-reply-to"] ?? null;
    const replyToHeader = headers?.["reply-to"] ?? null;

    // Extract plain email from "Name <email>" format
    const fromEmail = from?.match(/<([^>]+)>/)?.[1] || from;

    const supabase = await createServiceClient();
    const recipients = Array.isArray(to) ? to : [to];

    for (const recipient of recipients) {
      const toEmail = recipient?.match(/<([^>]+)>/)?.[1] || recipient;
      const toDomain = toEmail?.includes("@") ? toEmail.split("@")[1] : null;

      // Find org by exact email OR by domain (Resend inbound domain)
      const { data: configs } = await supabase
        .from("email_configs")
        .select("org_id")
        .or(
          `email_address.eq.${toEmail}${toDomain ? `,resend_domain.eq.${toDomain}` : ""}`
        )
        .eq("enabled", true);

      const config = configs?.[0];

      if (!config) {
        console.log(`No organization found for recipient: ${toEmail}`);
        continue;
      }

      // Auto-link customer by sender email
      const senderEmail = fromEmail?.replace(/.*<(.+)>/, "$1").trim() ?? fromEmail;
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("org_id", config.org_id)
        .eq("email", senderEmail)
        .maybeSingle();

      const { data: savedEmail } = await supabase
        .from("inbound_emails")
        .insert({
          org_id: config.org_id,
          message_id: messageId,
          from_email: from,
          to_email: toEmail,
          subject: subject || "(Sin asunto)",
          body_text: text ?? null,
          body_html: html ?? null,
          reply_to: replyToHeader ?? null,
          thread_id: inReplyTo ?? null,
          customer_id: customer?.id ?? null,
          received_at: new Date().toISOString(),
          status: "pending",
          is_read: false,
        })
        .select()
        .single();

      // Auto-classify if enabled
      const { data: emailConfig } = await supabase
        .from("email_configs")
        .select("auto_classify")
        .eq("org_id", config.org_id)
        .maybeSingle();

      if (emailConfig?.auto_classify && process.env.OPENAI_API_KEY && savedEmail) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emails/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId: savedEmail.id }),
        }).catch(console.error);
      }

      // Run simple automation rules (before AI classification)
      if (savedEmail) {
        const { data: rules } = await supabase
          .from("email_automation_rules")
          .select("*")
          .eq("org_id", config.org_id)
          .eq("enabled", true);

        for (const rule of rules ?? []) {
          const condition = rule.trigger_condition as {
            from_contains?: string;
            subject_contains?: string;
          };

          let matches = true;
          if (condition.from_contains && !from.includes(condition.from_contains)) matches = false;
          if (condition.subject_contains && !(subject ?? "").includes(condition.subject_contains)) matches = false;

          if (matches) {
            if (rule.action_type === "apply_label") {
              const cfg = rule.action_config as { label?: string };
              if (cfg.label) {
                await supabase
                  .from("inbound_emails")
                  .update({ labels: [cfg.label] })
                  .eq("id", savedEmail.id);
              }
            }

            if (rule.action_type === "create_ticket") {
              const cfg = rule.action_config as { category?: string };
              await supabase.from("support_tickets").insert({
                org_id: config.org_id,
                customer_id: customer?.id ?? null,
                source: "email",
                status: "open",
                subject: subject ?? "(Sin asunto)",
                category: cfg.category ?? "soporte",
                messages: [
                  { role: "customer", content: text ?? html ?? "", timestamp: new Date().toISOString() },
                ],
              });
            }
          }
        }
      }

      // Trigger existing automation system
      await triggerAutomation(supabase, config.org_id, "email.received", {
        email: {
          id: messageId,
          from: fromEmail,
          to: toEmail,
          subject: subject || "(Sin asunto)",
          text_body: text,
          html_body: html,
          received_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
