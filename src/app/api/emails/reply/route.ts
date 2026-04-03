import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { renderEmailHtml, renderCustomHtml, textToBlocks, extractBranding } from "@/lib/emails/render";

export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, inbound_email_id, body, subject, template_id, customer_id, preview_only } = await request.json();
  const targetEmailId = inbound_email_id || emailId;
  
  if (!targetEmailId || !body) {
    return NextResponse.json({ error: "inbound_email_id and body are required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { data: original, error: fetchError } = await serviceClient
    .from("inbound_emails")
    .select("*")
    .eq("id", targetEmailId)
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

  const creds = emailConfig?.credentials as {
    smtp_host?: string;
    smtp_port?: string;
    smtp_user?: string;
    smtp_pass?: string;
    smtp_from?: string;
    resend_api_key?: string;
    resend_from_email?: string;
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
    fromAddress = creds.resend_from_email ?? emailConfig?.email_address ?? `noreply@${RESEND_FROM_DOMAIN}`;
    replyToAddress = emailConfig?.reply_to_email ?? undefined;
  } else {
    fromAddress = `noreply@${RESEND_FROM_DOMAIN}`;
    replyToAddress = emailConfig?.email_address ?? emailConfig?.reply_to_email ?? undefined;
  }

  const fromEmail = `${senderName} <${fromAddress}>`;

  let customerName = "Cliente";
  let productName = "nuestro producto";
  let amount = "$0.00";
  
  if (customer_id || original.customer_id) {
    const cid = customer_id || original.customer_id;
    const { data: cData } = await serviceClient.from("customers").select("name").eq("id", cid).maybeSingle();
    if (cData && cData.name) customerName = cData.name;
  }

  // Fetch Template if provided
  let templateObj = null;
  if (template_id) {
    const { data: tData } = await serviceClient.from("email_templates").select("*").eq("id", template_id).eq("org_id", orgId).maybeSingle();
    templateObj = tData;
  }

  // Render HTML email with branding
  const globalBranding = extractBranding(emailConfig);
  const branding = { ...globalBranding };

  if (templateObj?.branding) {
    for (const key of Object.keys(templateObj.branding)) {
      const val = templateObj.branding[key];
      if (val !== undefined && val !== null && val !== "") {
        (branding as any)[key] = val;
      }
    }
  }
  let htmlBody: string | undefined;
  let plainText: string = body;

  try {
    if (templateObj) {
      if (templateObj.custom_html) {
        let rawHtml = templateObj.custom_html
          .replace(/\{\{customMessage\}\}/g, body.replace(/\n/g, "<br/>"))
          .replace(/\{\{customerName\}\}/g, customerName)
          .replace(/\{\{companyName\}\}/g, senderName)
          .replace(/\{\{productName\}\}/g, productName)
          .replace(/\{\{amount\}\}/g, amount);
        htmlBody = await renderCustomHtml(rawHtml, branding, `Re: ${original.subject ?? ""}`);
        plainText = body; // Simplified plain text fallback
      } else if (templateObj.blocks && templateObj.blocks.length > 0) {
        // Find existing customMessage or append
        let injectedBlocks = [...templateObj.blocks];
        let hasInjected = false;
        
        injectedBlocks = injectedBlocks.map(b => {
          if (b.content && typeof b.content === "string" && b.content.includes("{{customMessage}}")) {
            hasInjected = true;
            return { ...b, content: b.content.replace(/\{\{customMessage\}\}/g, body.replace(/\n/g, "<br/>")) };
          }
          if (b.content && typeof b.content === "string") {
            return { ...b, content: b.content.replace(/\{\{customerName\}\}/g, customerName).replace(/\{\{companyName\}\}/g, senderName) };
          }
          return b;
        });
        
        if (!hasInjected) {
             injectedBlocks.push({ id: "custom", type: "paragraph", content: body.replace(/\n/g, "<br/>") });
        }
        
        const rendered = await renderEmailHtml(injectedBlocks, branding, `Re: ${original.subject ?? ""}`);
        htmlBody = rendered.html;
        plainText = rendered.text;
      }
    } else {
      const blocks = textToBlocks(body);
      const rendered = await renderEmailHtml(blocks, branding, `Re: ${original.subject ?? ""}`);
      htmlBody = rendered.html;
      plainText = rendered.text;
    }
  } catch (err) {
    console.error("Error rendering email template:", err);
    plainText = emailConfig?.signature ? `${body}\n\n---\n${emailConfig.signature}` : body;
  }

  if (preview_only) {
    return NextResponse.json({ success: true, html: htmlBody || plainText });
  }

  let sentMessageId: string | null = null;
  let sendMethod: "smtp" | "resend_client" | "resend_platform" = "resend_platform";

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
        text: plainText,
        html: htmlBody,
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
        text: plainText,
        html: htmlBody,
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
      text: plainText,
      html: htmlBody,
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
      inbound_email_id: targetEmailId,
      to_email: toEmail,
      subject: replySubject,
      body_text: plainText,
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
    .eq("id", targetEmailId);

  return NextResponse.json({
    success: true,
    reply,
    from: fromEmail,
    sendMethod,
  });
}
