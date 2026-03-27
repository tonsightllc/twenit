import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";

// POST /api/emails/reply
export async function POST(request: NextRequest) {
  const { user, orgId, profile } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, body, subject } = await request.json();
  if (!emailId || !body) {
    return NextResponse.json({ error: "emailId and body are required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  // Fetch the original email
  const { data: original, error: fetchError } = await serviceClient
    .from("inbound_emails")
    .select("*")
    .eq("id", emailId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Fetch the org's email config to determine sending mode
  const { data: emailConfig } = await serviceClient
    .from("email_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  const senderName = emailConfig?.sender_name ?? "Soporte";
  const replySubject = subject ?? `Re: ${original.subject ?? "(sin asunto)"}`;
  const toEmail = original.reply_to ?? original.from_email;

  let fromEmail: string;
  let sentResendMessageId: string | null = null;

  // Determine from email based on active case
  if (emailConfig?.provider === "resend_domain" && emailConfig?.resend_domain_verified && emailConfig?.resend_domain) {
    // Case B: own domain via Resend
    fromEmail = `${senderName} <soporte@${emailConfig.resend_domain}>`;
  } else if (emailConfig?.provider === "smtp" && emailConfig?.credentials) {
    // Case C: SMTP — for now we still use Resend as transport since nodemailer isn't set up
    // SMTP sending is proxied; the "from" shows org's address using Resend relay
    fromEmail = `${senderName} <${emailConfig.email_address ?? process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev"}>`;
  } else {
    // Case A: generic fallback
    fromEmail = `${senderName} <onboarding@resend.dev>`;
  }

  // Add signature if configured
  const fullBody = emailConfig?.signature
    ? `${body}\n\n---\n${emailConfig.signature}`
    : body;

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: sent, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: replySubject,
      text: fullBody,
      replyTo: emailConfig?.reply_to_email ?? undefined,
      headers: original.thread_id ? { "In-Reply-To": original.thread_id } : undefined,
    });

    if (sendError) {
      console.error("Resend error:", sendError);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    sentResendMessageId = sent?.id ?? null;
  }

  // Save reply to DB
  const { data: reply, error: replyError } = await serviceClient
    .from("email_replies")
    .insert({
      org_id: orgId,
      inbound_email_id: emailId,
      to_email: toEmail,
      subject: replySubject,
      body_text: fullBody,
      sent_by: user.id,
      is_auto_reply: false,
      resend_message_id: sentResendMessageId,
    })
    .select()
    .single();

  if (replyError) {
    console.error("Error saving reply:", replyError);
  }

  // Mark original as read
  await serviceClient
    .from("inbound_emails")
    .update({ is_read: true, status: "processed" })
    .eq("id", emailId);

  return NextResponse.json({
    success: true,
    reply,
    from: fromEmail,
    warning: !process.env.RESEND_API_KEY ? "RESEND_API_KEY not set — email was saved but not sent" : undefined,
  });
}
