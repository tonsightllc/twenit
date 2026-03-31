import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
- Devolvé SOLO un array JSON valido, sin markdown, sin texto extra
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

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });
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

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
    const blocks = JSON.parse(text);

    if (!Array.isArray(blocks)) {
      return NextResponse.json({ error: "La IA no devolvió un array de bloques" }, { status: 500 });
    }

    return NextResponse.json({ blocks });
  } catch (err) {
    console.error("Error generating email blocks:", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `Error al generar: ${msg}` }, { status: 500 });
  }
}
