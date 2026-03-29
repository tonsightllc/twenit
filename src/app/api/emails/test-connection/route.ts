import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

/**
 * POST /api/emails/test-connection
 * Tests IMAP and/or SMTP connection with provided credentials.
 */
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imap, smtp } = await request.json();
  const results: { imap?: { ok: boolean; error?: string }; smtp?: { ok: boolean; error?: string } } = {};

  if (imap?.host && imap?.user && imap?.pass) {
    try {
      const client = new ImapFlow({
        host: imap.host,
        port: imap.port ?? 993,
        secure: true,
        auth: { user: imap.user, pass: imap.pass },
        logger: false,
      });
      await client.connect();
      await client.logout();
      results.imap = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de conexión";
      results.imap = { ok: false, error: message };
    }
  }

  if (smtp?.host && smtp?.user && smtp?.pass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: parseInt(smtp.port ?? "587"),
        secure: parseInt(smtp.port ?? "587") === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });
      await transporter.verify();
      results.smtp = { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error de conexión";
      results.smtp = { ok: false, error: message };
    }
  }

  return NextResponse.json(results);
}
