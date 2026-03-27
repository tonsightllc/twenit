import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

const CLASSIFY_PROMPT = `
Sos un asistente de clasificación de emails de soporte. Analizá el email y respondé SOLO con JSON válido con esta estructura:
{
  "classification": "soporte" | "ventas" | "facturación" | "cancelación" | "otro",
  "intent": "problema_acceso" | "cancelar_suscripcion" | "solicitar_refund" | "upgrade" | "pregunta_general" | "queja" | "otro",
  "summary": "Resumen del email en 1 oración en español",
  "priority": "low" | "medium" | "high"
}

Email a clasificar:
Subject: {{subject}}
Body: {{body}}
`;

// POST /api/emails/classify
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId } = await request.json();
  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();

  const { data: email, error: fetchError } = await serviceClient
    .from("inbound_emails")
    .select("*")
    .eq("id", emailId)
    .eq("org_id", orgId)
    .single();

  if (fetchError || !email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI not configured", classified: false },
      { status: 503 }
    );
  }

  const prompt = CLASSIFY_PROMPT
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
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "OpenAI request failed" }, { status: 500 });
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  let result: {
    classification: string;
    intent: string;
    summary: string;
    priority: string;
  };

  try {
    result = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
  }

  // Save classification to DB
  const { data: updated, error: updateError } = await serviceClient
    .from("inbound_emails")
    .update({
      classification: result.classification,
      intent: result.intent,
      ai_summary: result.summary,
    })
    .eq("id", emailId)
    .select()
    .single();

  if (updateError) {
    console.error("Error saving classification:", updateError);
  }

  return NextResponse.json({ success: true, classification: result, email: updated });
}
