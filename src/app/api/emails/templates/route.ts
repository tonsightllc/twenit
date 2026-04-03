import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";
import { PREDEFINED_TEMPLATES } from "@/lib/emails/predefined-templates";

export async function GET() {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createServiceClient();
  const { data: templates, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!templates || templates.length === 0) {
    const seeds = PREDEFINED_TEMPLATES.map((t) => ({
      org_id: orgId,
      name: t.name,
      type: "custom",
      template_type: t.template_type,
      subject: t.subject,
      blocks: t.blocks,
      custom_html: t.custom_html ?? null,
      html_content: t.custom_html ?? "",
      is_predefined: true,
    }));

    const { data: created } = await supabase
      .from("email_templates")
      .insert(seeds)
      .select();

    return NextResponse.json({ templates: created ?? [] });
  }

  // Backfill any ruined templates from the previous seeding bug
  let backfilled = false;
  for (const t of templates) {
    if (t.is_predefined && !t.custom_html) {
      const predefined = PREDEFINED_TEMPLATES.find((p) => p.template_type === t.template_type);
      if (predefined && predefined.custom_html) {
        t.custom_html = predefined.custom_html;
        backfilled = true;
        // Fire and forget update so next load is fast
        supabase.from("email_templates").update({ custom_html: predefined.custom_html, html_content: predefined.custom_html }).eq("id", t.id).then();
      }
    }
  }

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, subject, blocks, template_type, custom_html, branding } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data: template, error } = await supabase
    .from("email_templates")
    .insert({
      org_id: orgId,
      name,
      type: "custom",
      subject: subject ?? "",
      blocks: blocks ?? [],
      template_type: template_type ?? "custom",
      custom_html: custom_html ?? null,
      html_content: custom_html ?? "",
      branding: branding ?? {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template });
}

export async function PUT(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, subject, blocks, enabled, custom_html, branding } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) update.name = name;
  if (subject !== undefined) update.subject = subject;
  if (blocks !== undefined) update.blocks = blocks;
  if (enabled !== undefined) update.enabled = enabled;
  if (custom_html !== undefined) update.custom_html = custom_html;
  if (branding !== undefined) update.branding = branding;

  const { data: template, error } = await supabase
    .from("email_templates")
    .update(update)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template });
}

export async function DELETE(request: NextRequest) {
  const { orgId } = await getUserOrg();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from("email_templates")
    .select("is_predefined")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (existing?.is_predefined) {
    return NextResponse.json({ error: "No se pueden eliminar templates predefinidos" }, { status: 403 });
  }

  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
