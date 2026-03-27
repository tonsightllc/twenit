import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

const SUGGEST_PROMPT = `
Sos un agente de soporte al cliente experto. Tu tarea es redactar una respuesta profesional, empática y concisa al siguiente email.

{{customerContext}}

Email del cliente:
Subject: {{subject}}
Body: {{body}}

Instrucciones:
- Respondé en el mismo idioma del email
- Sé conciso (máximo 150 palabras)
- Sé amigable y profesional
- No incluyas firma (eso se agrega automáticamente)
- Respondé SOLO con el texto del email, sin formato ni metadata

Respuesta sugerida:
`;

// POST /api/emails/suggest-reply
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId } = await request.json();
  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI not configured", available: false },
      { status: 503 }
    );
  }

  const serviceClient = await createServiceClient();

  const { data: email, error: fetchError } = await serviceClient
    .from("inbound_emails")
    .select("*, customers(name, email, stripe_customer_id, activation_status)")
    .eq("id", emailId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Build customer context if available
  let customerContext = "";
  if (email.customers) {
    const c = email.customers as { name?: string; stripe_customer_id?: string; activation_status?: string };
    customerContext = `Contexto del cliente:
- Nombre: ${c.name ?? "Desconocido"}
- Stripe ID: ${c.stripe_customer_id ?? "N/A"}
- Estado de activación: ${c.activation_status ?? "N/A"}
${email.ai_summary ? `- Resumen del email: ${email.ai_summary}` : ""}`;
  }

  const prompt = SUGGEST_PROMPT
    .replace("{{customerContext}}", customerContext)
    .replace("{{subject}}", email.subject ?? "(sin asunto)")
    .replace("{{body}}", (email.body_text ?? email.body_html ?? "").substring(0, 2000));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "OpenAI request failed" }, { status: 500 });
  }

  const aiResponse = await response.json();
  const suggestion = aiResponse.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({ success: true, suggestion: suggestion.trim(), available: true });
}
