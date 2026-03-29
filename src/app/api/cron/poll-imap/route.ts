import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { processInboundEmail } from "@/lib/emails/process-inbound";
import { ImapFlow } from "imapflow";

/**
 * Cron endpoint that polls IMAP mailboxes for all orgs using connection_method='imap'.
 * Intended to be called by Vercel Cron every 2-5 minutes.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createServiceClient();

  const { data: configs, error } = await supabase
    .from("email_configs")
    .select("org_id, credentials, imap_last_uid, email_address")
    .eq("connection_method", "imap")
    .eq("enabled", true);

  if (error || !configs?.length) {
    return NextResponse.json({ polled: 0, message: error?.message ?? "No IMAP configs found" });
  }

  let totalNew = 0;

  for (const config of configs) {
    const creds = config.credentials as {
      imap_host?: string;
      imap_port?: number;
      imap_user?: string;
      imap_pass?: string;
    };

    if (!creds?.imap_host || !creds?.imap_user || !creds?.imap_pass) continue;

    let client: ImapFlow | null = null;
    try {
      client = new ImapFlow({
        host: creds.imap_host,
        port: creds.imap_port ?? 993,
        secure: true,
        auth: {
          user: creds.imap_user,
          pass: creds.imap_pass,
        },
        logger: false,
      });

      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const searchCriteria = config.imap_last_uid
          ? { uid: `${config.imap_last_uid}:*` }
          : { seen: false };

        let highestUid = config.imap_last_uid ?? "0";

        for await (const msg of client.fetch(searchCriteria, {
          envelope: true,
          source: true,
          uid: true,
        })) {
          const uid = String(msg.uid);
          if (uid === config.imap_last_uid) continue;

          const envelope = msg.envelope;
          if (!envelope) continue;

          const fromAddr = envelope.from?.[0];
          const fromStr = fromAddr
            ? fromAddr.name
              ? `${fromAddr.name} <${fromAddr.address}>`
              : fromAddr.address ?? ""
            : "";

          const toAddr = envelope.to?.[0];
          const toStr = toAddr?.address ?? config.email_address ?? "";

          await processInboundEmail(supabase, {
            orgId: config.org_id,
            from: fromStr,
            to: toStr,
            subject: envelope.subject ?? "(Sin asunto)",
            text: msg.source?.toString() ?? null,
            messageId: envelope.messageId ?? `imap-${uid}-${Date.now()}`,
            inReplyTo: envelope.inReplyTo ?? null,
          });

          if (parseInt(uid) > parseInt(highestUid)) {
            highestUid = uid;
          }
          totalNew++;
        }

        if (highestUid !== (config.imap_last_uid ?? "0")) {
          await supabase
            .from("email_configs")
            .update({ imap_last_uid: highestUid })
            .eq("org_id", config.org_id);
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err) {
      console.error(`IMAP poll error for org ${config.org_id}:`, err);
      if (client) {
        try { await client.logout(); } catch { /* ignore */ }
      }
    }
  }

  return NextResponse.json({ polled: configs.length, newEmails: totalNew });
}
