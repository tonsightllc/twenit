/**
 * Cloudflare Email Worker
 *
 * Receives emails via Cloudflare Email Routing (catch-all on mail.twenit.com)
 * and forwards them to the CRM's inbound webhook.
 *
 * Setup:
 * 1. Deploy this worker to Cloudflare Workers
 * 2. In Cloudflare Dashboard > Email Routing > mail.twenit.com:
 *    - Enable Email Routing for the subdomain
 *    - Create a catch-all rule pointing to this worker
 * 3. Set environment variables in the worker:
 *    - WEBHOOK_URL: https://www.twenit.com/api/webhooks/inbound
 *    - INBOUND_SECRET: (same as INBOUND_WEBHOOK_SECRET in the CRM's .env)
 */

import PostalMime from "postal-mime";

export default {
  async email(message, env) {
    try {
      const rawEmail = new Response(message.raw);
      const arrayBuffer = await rawEmail.arrayBuffer();
      const parser = new PostalMime();
      const parsed = await parser.parse(arrayBuffer);

      const originalFrom = parsed.from?.address || message.from;
      const fromName = parsed.from?.name || null;

      const payload = {
        from: originalFrom,
        fromName,
        to: message.to,
        subject: parsed.subject || "(Sin asunto)",
        text: parsed.text || null,
        html: parsed.html || null,
        messageId: parsed.messageId || `cf-${Date.now()}`,
        inReplyTo: parsed.inReplyTo || null,
        replyTo: parsed.replyTo?.[0]?.address || null,
      };

      const response = await fetch(env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-inbound-secret": env.INBOUND_SECRET || "",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Webhook returned ${response.status}: ${await response.text()}`);
        message.setReject(`Webhook error: ${response.status}`);
      }
    } catch (error) {
      console.error("Error processing email:", error);
      message.setReject("Processing error");
    }
  },
};
