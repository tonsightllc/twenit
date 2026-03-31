import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, body, subject } = await request.json();
  if (!emailId || !body) {
    return NextResponse.json({ error: "emailId and body are required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { data: original, error: fetchError } = await serviceClient
    .from("inbound_emails")
    .select("*")
    .eq("id", emailId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const { data: emailConfig } = await serviceClient
    .from("email_configs")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  const senderName = emailConfig?.sender_name ?? "Soporte";
  const replySubject = subject ?? `Re: ${original.subject ?? "(sin asunto)"}`;
  const toEmail = original.reply_to ?? original.from_email;

  const fullBody = emailConfig?.signature
    ? `${body}\n\n---\n${emailConfig.signature}`
    : body;

  const creds = emailConfig?.credentials as {
    smtp_host?: string;
    smtp_port?: string;
    smtp_user?: string;
    smtp_pass?: string;
    smtp_from?: string;
    resend_api_key?: string;
  } | null;

  const hasSmtp = !!(creds?.smtp_host && creds?.smtp_user && creds?.smtp_pass);
  const hasClientResend = !!creds?.resend_api_key;
  const hasPlatformResend = !!process.env.RESEND_API_KEY;

  const RESEND_FROM_DOMAIN = process.env.RESEND_FROM_DOMAIN ?? "twenit.com";

  let fromAddress: string;
  let replyToAddress: string | undefined;

  if (hasSmtp) {
    fromAddress = creds.smtp_from ?? emailConfig?.email_address ?? creds.smtp_user!;
    replyToAddress = emailConfig?.reply_to_email ?? undefined;
  } else if (hasClientResend) {
    fromAddress = emailConfig?.email_address ?? `noreply@${RESEND_FROM_DOMAIN}`;
    replyToAddress = emailConfig?.reply_to_email ?? undefined;
  } else {
    fromAddress = `noreply@${RESEND_FROM_DOMAIN}`;
    replyToAddress = emailConfig?.email_address ?? emailConfig?.reply_to_email ?? undefined;
  }

  const fromEmail = `${senderName} <${fromAddress}>`;

  let sentMessageId: string | null = null;
  let sendMethod: "smtp" | "resend_client" | "resend_platform" = "resend_platform";

  // Priority: 1) SMTP  2) Client Resend  3) Platform Resend  4) Error
  if (hasSmtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: creds.smtp_host,
        port: parseInt(creds.smtp_port ?? "587"),
        secure: parseInt(creds.smtp_port ?? "587") === 465,
        auth: { user: creds.smtp_user, pass: creds.smtp_pass },
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: replySubject,
        text: fullBody,
        replyTo: replyToAddress,
        inReplyTo: original.thread_id ?? undefined,
        references: original.thread_id ?? undefined,
      });

      sentMessageId = info.messageId ?? null;
      sendMethod = "smtp";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("SMTP send error:", err);
      return NextResponse.json({ error: `Error al enviar por SMTP: ${msg}` }, { status: 500 });
    }
  } else if (hasClientResend) {
    try {
      const resend = new Resend(creds.resend_api_key);
      const { data: sent, error: sendError } = await resend.emails.send({
        from: fromEmail,
        to: [toEmail],
        subject: replySubject,
        text: fullBody,
        replyTo: replyToAddress,
        headers: original.thread_id ? { "In-Reply-To": original.thread_id } : undefined,
      });

      if (sendError) {
        console.error("Client Resend error:", sendError);
        const detail = (sendError as { message?: string })?.message ?? "Error desconocido";
        return NextResponse.json({ error: `No se pudo enviar: ${detail}` }, { status: 500 });
      }
      sentMessageId = sent?.id ?? null;
      sendMethod = "resend_client";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("Client Resend error:", err);
      return NextResponse.json({ error: `Error con Resend: ${msg}` }, { status: 500 });
    }
  } else if (hasPlatformResend) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: sent, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: replySubject,
      text: fullBody,
      replyTo: replyToAddress,
      headers: original.thread_id ? { "In-Reply-To": original.thread_id } : undefined,
    });

    if (sendError) {
      console.error("Platform Resend error:", sendError);
      const detail = (sendError as { message?: string })?.message ?? "Error desconocido";
      return NextResponse.json({ error: `No se pudo enviar el email: ${detail}` }, { status: 500 });
    }
    sentMessageId = sent?.id ?? null;
    sendMethod = "resend_platform";
  } else {
    return NextResponse.json({
      error: "No hay método de envío configurado. Configurá SMTP o Resend.",
    }, { status: 422 });
  }

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
      resend_message_id: sentMessageId,
    })
    .select()
    .single();

  if (replyError) {
    console.error("Error saving reply:", replyError);
  }

  await serviceClient
    .from("inbound_emails")
    .update({ is_read: true, status: "processed" })
    .eq("id", emailId);

  return NextResponse.json({
    success: true,
    reply,
    from: fromEmail,
    sendMethod,
  });
}
