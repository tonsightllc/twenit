import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const LANG_MAP: Record<string, string> = {
  es: "Spanish (neutral)",
  en: "English (US)",
  pt: "Portuguese (Brazil)",
};

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY no configurada" }, { status: 500 });
  }

  const { name, subject, blocks, custom_html, target_language } = await request.json();
  if (!target_language) {
    return NextResponse.json({ error: "target_language is required" }, { status: 400 });
  }

  const langName = LANG_MAP[target_language] || target_language;

  const systemPrompt = `You are a professional translator specializing in transactional and marketing emails.
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

  const userMessage = JSON.stringify({
    subject: subject || "",
    custom_html: custom_html || null,
    blocks: blocks && blocks.length > 0 ? blocks : null,
  }, null, 2);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nContent to translate:\n" + userMessage }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const text = result.response.text();
    const translated = JSON.parse(text);

    // Save to database as a new template variation
    const supabase = await createServiceClient();
    
    // Add [LANG] to the name visually just for clarity in the DB if you want, but the UI filters by the metadata now.
    // Let's keep the name the same, the UI will distinguish by branding.language.
    
    const branding = { language: target_language };

    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        org_id: orgId,
        name: name,
        subject: translated.subject || subject || "",
        blocks: translated.blocks || [],
        template_type: "custom",
        custom_html: translated.custom_html || null,
        branding,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template });
  } catch (err) {
    console.error("Error generating translation:", err);
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: `Error al generar: ${msg}` }, { status: 500 });
  }
}
