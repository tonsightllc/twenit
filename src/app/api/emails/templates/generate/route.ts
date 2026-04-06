import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";

const BLOCK_SCHEMA = `
type BlockType = "heading" | "paragraph" | "callout" | "button" | "image" | "separator";

interface EmailBlock {
  id: string;       // unique id like "b1", "b2", etc.
  type: BlockType;
  content?: string;  // HTML inline allowed: <strong>, <em>, <a href="...">, <br/>, <span style="color:...">
  attrs?: {
    level?: 1 | 2 | 3;                        // for heading
    variant?: "info" | "warning" | "success";  // for callout
    href?: string;                             // for button
    label?: string;                            // for button text
  };
}
`;

interface AISettings {
  language?: string;
  tone?: string;
  length?: string;
  customInstructions?: string;
}

function buildSystemPrompt(settings: AISettings): string {
  const lang = settings.language ?? "es_ar";
  const tone = settings.tone ?? "professional";
  const length = settings.length ?? "medium";

  const langMap: Record<string, string> = {
    es_ar: "Escribí en español rioplatense (vos, tu, etc.)",
    es: "Escribe en español neutro",
    en: "Write in English",
    pt: "Escreva em português",
  };

  const toneMap: Record<string, string> = {
    professional: "Tono profesional pero cercano",
    formal: "Tono formal y corporativo. Usá usted en lugar de vos/tú",
    casual: "Tono casual, amigable, relajado",
    friendly: "Tono cálido y empático, como hablando con un amigo",
    urgent: "Tono directo y urgente, que transmita importancia",
  };

  const lengthMap: Record<string, string> = {
    short: "Email muy corto y directo, máximo 4-5 bloques",
    medium: "Email de longitud media, 6-8 bloques",
    long: "Email completo y detallado, 8-12 bloques",
  };

  let prompt = `Sos un experto en copywriting de emails transaccionales y marketing.
Tu tarea es generar el contenido de un email como un array JSON de bloques.

Formato de bloques:
${BLOCK_SCHEMA}

Reglas:
- Devolvé SOLO un array JSON valido, sin markdown, sin texto extra, sin code fences
- ${langMap[lang] ?? langMap.es_ar}
- ${toneMap[tone] ?? toneMap.professional}
- ${lengthMap[length] ?? lengthMap.medium}
- Usa bloques variados: headings, parrafos, callouts, botones, separadores
- No incluyas bloque de tipo "image" a menos que te lo pidan
- El branding (logo, firma, footer, colores) se aplica automaticamente, NO lo incluyas`;

  if (settings.customInstructions?.trim()) {
    prompt += `\n- Instrucciones adicionales del usuario: ${settings.customInstructions.trim()}`;
  }

  return prompt;
}

async function generateWithGroq(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<unknown[]> {
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
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(raw);
  // Groq with json_object may wrap in { "blocks": [...] } or return array directly
  return Array.isArray(parsed) ? parsed : (parsed.blocks ?? parsed.email ?? []);
}

async function generateWithGemini(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
): Promise<unknown[]> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      });

      const text = result.response.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      throw new Error("Gemini no devolvió un array");
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
      { error: "No hay API key de IA configurada. Agregá GROQ_API_KEY o GEMINI_API_KEY en las variables de entorno." },
      { status: 500 },
    );
  }

  const { prompt, variables, aiSettings } = await request.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const settings: AISettings = aiSettings ?? {};
  const systemPrompt = buildSystemPrompt(settings);

  let userMessage = `Generá un email para: ${prompt}`;
  if (variables && typeof variables === "object") {
    const vars = Object.entries(variables)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    userMessage += `\n\nVariables disponibles:\n${vars}`;
  }

  // Try Groq first (free, fast), fallback to Gemini
  const providers: Array<{ name: string; fn: () => Promise<unknown[]> }> = [];

  if (groqKey) {
    providers.push({
      name: "Groq",
      fn: () => generateWithGroq(systemPrompt, userMessage, groqKey),
    });
  }
  if (geminiKey) {
    providers.push({
      name: "Gemini",
      fn: () => generateWithGemini(systemPrompt, userMessage, geminiKey),
    });
  }

  for (const provider of providers) {
    try {
      const blocks = await provider.fn();

      if (!Array.isArray(blocks) || blocks.length === 0) {
        console.warn(`${provider.name} devolvió datos inválidos, trying next...`);
        continue;
      }

      return NextResponse.json({ blocks });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      console.warn(`${provider.name} failed: ${msg}`);

      if (provider === providers[providers.length - 1]) {
        const isRateLimit = msg.includes("429") || msg.includes("quota") || msg.includes("rate");
        if (isRateLimit) {
          return NextResponse.json(
            { error: "Se alcanzó el límite de uso de la IA. Esperá unos segundos e intentá de nuevo." },
            { status: 429 },
          );
        }
        return NextResponse.json({ error: `Error al generar: ${msg}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ error: "No se pudo generar con ningún proveedor de IA" }, { status: 500 });
}
