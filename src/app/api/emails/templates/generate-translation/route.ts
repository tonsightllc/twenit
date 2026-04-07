import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

const LANG_MAP: Record<string, string> = {
  es: "Spanish (neutral)",
  en: "English (US)",
  pt: "Portuguese (Brazil)",
};

function buildTranslationPrompt(langName: string): string {
  return `You are a professional translator specializing in transactional and marketing emails.
Translate the provided email content and subject into: ${langName}.

Rules:
1. If "custom_html" is provided, keep the EXACT HTML structure, styles, inline CSS, and attributes. Only translate the human readable text. DO NOT format as markdown, just output the raw HTML string in the JSON.
2. If "blocks" is provided, keep the EXACT JSON structure, only translate the "content" or "label" properties.
3. NEVER translate variables that look like {{variableName}}. Keep them exactly as they are.
4. Output your response ONLY as a valid JSON object with the following schema, and no other text:
{
  "subject": "translated subject here",
  "custom_html": "translated html here, or null if not provided",
  "blocks": [ translated blocks array, or [] if not provided ]
}
`;
}

async function translateWithGroq(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Content to translate:\n" + userMessage },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  return JSON.parse(raw);
}

async function translateWithGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nContent to translate:\n" + userMessage }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      return JSON.parse(result.response.text());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if ((msg.includes("429") || msg.includes("quota")) && modelName !== models[models.length - 1]) {
        continue;
      }
      throw err;
    }
  }

  throw new Error("Todos los modelos de Gemini fallaron");
}

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return NextResponse.json(
      { error: "No hay API key de IA configurada. Agregá GROQ_API_KEY o GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  const { name, subject, blocks, custom_html, target_language } = await request.json();
  if (!target_language) {
    return NextResponse.json({ error: "target_language is required" }, { status: 400 });
  }

  const langName = LANG_MAP[target_language] || target_language;
  const systemPrompt = buildTranslationPrompt(langName);

  const userMessage = JSON.stringify({
    subject: subject || "",
    custom_html: custom_html || null,
    blocks: blocks && blocks.length > 0 ? blocks : null,
  }, null, 2);

  const providers: Array<{ name: string; fn: () => Promise<Record<string, unknown>> }> = [];
  if (groqKey) providers.push({ name: "Groq", fn: () => translateWithGroq(systemPrompt, userMessage, groqKey) });
  if (geminiKey) providers.push({ name: "Gemini", fn: () => translateWithGemini(systemPrompt, userMessage, geminiKey) });

  let translated: Record<string, unknown> | null = null;

  for (const provider of providers) {
    try {
      translated = await provider.fn();
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      console.warn(`${provider.name} translation failed: ${msg}`);

      if (provider === providers[providers.length - 1]) {
        const isRateLimit = msg.includes("429") || msg.includes("quota") || msg.includes("rate");
        if (isRateLimit) {
          return NextResponse.json(
            { error: "Se alcanzó el límite de uso de la IA. Esperá unos segundos e intentá de nuevo." },
            { status: 429 },
          );
        }
        return NextResponse.json({ error: `Error al traducir: ${msg}` }, { status: 500 });
      }
    }
  }

  if (!translated) {
    return NextResponse.json({ error: "No se pudo traducir con ningún proveedor" }, { status: 500 });
  }

  try {
    const supabase = await createServiceClient();
    const branding = { language: target_language };

    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        org_id: orgId,
        name,
        subject: (translated.subject as string) || subject || "",
        blocks: (translated.blocks as unknown[]) || [],
        template_type: "custom",
        custom_html: (translated.custom_html as string) || null,
        branding,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch (err) {
    console.error("Error saving translation:", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `Error al guardar: ${msg}` }, { status: 500 });
  }
}
