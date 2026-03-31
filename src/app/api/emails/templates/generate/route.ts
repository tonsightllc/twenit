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

const SYSTEM_PROMPT = `Sos un experto en copywriting de emails transaccionales y marketing.
Tu tarea es generar el contenido de un email como un array JSON de bloques.

Formato de bloques:
${BLOCK_SCHEMA}

Reglas:
- Devolvé SOLO un array JSON valido, sin markdown, sin texto extra
- Usa español rioplatense (vos, tu, etc.)
- Sé profesional pero cercano
- Usa bloques variados: headings, parrafos, callouts, botones, separadores
- No incluyas bloque de tipo "image" a menos que te lo pidan
- El branding (logo, firma, footer, colores) se aplica automaticamente, NO lo incluyas
- Contenido corto y directo, no mas de 8-10 bloques
`;

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });
  }

  const { prompt, variables } = await request.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

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
        { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userMessage }] },
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
