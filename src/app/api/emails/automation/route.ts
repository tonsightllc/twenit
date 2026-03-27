import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/emails/automation
export async function GET() {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("email_automation_rules")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at");

  // Table may not exist yet if migration 006 hasn't run
  if (error) {
    console.warn("email_automation_rules query error (table may not exist):", error.message);
    return NextResponse.json({ rules: [] });
  }

  return NextResponse.json({ rules: data ?? [] });
}

// POST /api/emails/automation — create rule
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, trigger_condition, action_type, action_config, enabled } = await request.json();

  if (!name || !trigger_condition || !action_type) {
    return NextResponse.json({ error: "name, trigger_condition, action_type are required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("email_automation_rules")
    .insert({
      org_id: orgId,
      name,
      trigger_condition,
      action_type,
      action_config: action_config ?? {},
      enabled: enabled ?? true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}

// PUT /api/emails/automation — update rule
export async function PUT(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, ...updates } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("email_automation_rules")
    .update(updates)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rule: data });
}

// DELETE /api/emails/automation?id=...
export async function DELETE(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("email_automation_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
