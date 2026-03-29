import { SupabaseClient } from "@supabase/supabase-js";
import { triggerAutomation } from "@/lib/automation";

export interface InboundEmailParams {
  orgId: string;
  from: string;
  to: string;
  subject: string;
  text?: string | null;
  html?: string | null;
  messageId: string;
  inReplyTo?: string | null;
  replyTo?: string | null;
}

/**
 * Shared logic for processing an inbound email regardless of source
 * (Resend webhook, Cloudflare Worker, IMAP poller).
 */
export async function processInboundEmail(
  supabase: SupabaseClient,
  params: InboundEmailParams
) {
  const { orgId, from, to, subject, text, html, messageId, inReplyTo, replyTo } = params;

  const senderEmail = from?.match(/<([^>]+)>/)?.[1]?.trim() ?? from?.trim();

  // Deduplicate by message_id
  const { data: existing } = await supabase
    .from("inbound_emails")
    .select("id")
    .eq("org_id", orgId)
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing) return existing;

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", senderEmail)
    .maybeSingle();

  const { data: savedEmail } = await supabase
    .from("inbound_emails")
    .insert({
      org_id: orgId,
      message_id: messageId,
      from_email: from,
      to_email: to,
      subject: subject || "(Sin asunto)",
      body_text: text ?? null,
      body_html: html ?? null,
      reply_to: replyTo ?? null,
      thread_id: inReplyTo ?? null,
      customer_id: customer?.id ?? null,
      received_at: new Date().toISOString(),
      status: "pending",
      is_read: false,
    })
    .select()
    .single();

  if (!savedEmail) return null;

  // Auto-classify if enabled
  const { data: emailConfig } = await supabase
    .from("email_configs")
    .select("auto_classify")
    .eq("org_id", orgId)
    .maybeSingle();

  if (emailConfig?.auto_classify && process.env.OPENAI_API_KEY) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/emails/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: savedEmail.id }),
    }).catch(console.error);
  }

  // Automation rules
  const { data: rules } = await supabase
    .from("email_automation_rules")
    .select("*")
    .eq("org_id", orgId)
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
          org_id: orgId,
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

  await triggerAutomation(supabase, orgId, "email.received", {
    email: {
      id: messageId,
      from: senderEmail,
      to,
      subject: subject || "(Sin asunto)",
      text_body: text,
      html_body: html,
      received_at: new Date().toISOString(),
    },
  });

  return savedEmail;
}
