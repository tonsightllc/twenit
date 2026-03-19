import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { triggerAutomation } from "@/lib/automation";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Basic validation of Resend webhook payload
    if (!payload.type && payload.type !== 'inbound') {
      // Resend might send different events, we care about inbound
      // But the payload structure might be creating the email object directly
      // usually it's the 'Email' object directly for the inbound webhook
    }

    // Resend Inbound usually sends the email object:
    // {
    //   "from": "Sender Name <sender@example.com>",
    //   "to": ["recipient@example.com"],
    //   "subject": "Hello",
    //   "text": "World",
    //   "html": "<p>World</p>",
    //   "headers": { ... },
    //   "attachments": []
    // }

    const { from, to, subject, text, html, headers } = payload;
    const messageId = headers?.['message-id'] || `resend-${Date.now()}`;

    // Clean up 'from' to get just email
    const fromEmail = from.match(/<([^>]+)>/)?.[1] || from;

    const supabase = await createServiceClient();

    // 'to' can be an array of strings or objects. Resend usually sends array of strings for inbound.
    const recipients = Array.isArray(to) ? to : [to];

    for (const recipient of recipients) {
      // Clean recipient email
      const toEmail = recipient.match(/<([^>]+)>/)?.[1] || recipient;

      // Find organization that owns this email address
      const { data: config } = await supabase
        .from('email_configs')
        .select('org_id')
        .eq('email_address', toEmail)
        .eq('enabled', true)
        .single();

      if (config) {
        // Found a matching organization
        await supabase.from('inbound_emails').insert({
          org_id: config.org_id,
          message_id: messageId,
          from_email: fromEmail,
          to_email: toEmail,
          subject: subject || '(No Subject)',
          body_text: text,
          body_html: html,
          received_at: new Date().toISOString(),
          status: 'pending'
        });

        // Trigger automation rules
        await triggerAutomation(supabase, config.org_id, "email.received", {
          email: {
            id: messageId,
            from: fromEmail,
            to: toEmail,
            subject: subject || "(No Subject)",
            text_body: text,
            html_body: html,
            received_at: new Date().toISOString(),
          },
        });
      } else {
        console.log(`No organization found for recipient: ${toEmail}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
