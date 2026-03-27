import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/emails/labels
export async function GET() {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("email_labels")
    .select("*")
    .eq("org_id", orgId)
    .order("name");

  // Table may not exist yet if migration 006 hasn't run
  if (error) {
    console.warn("email_labels query error (table may not exist):", error.message);
    return NextResponse.json({ labels: [] });
  }

  return NextResponse.json({ labels: data ?? [] });
}

// POST /api/emails/labels — create label
export async function POST(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, color } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("email_labels")
    .insert({ org_id: orgId, name, color: color ?? "#6366f1" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ label: data });
}

// DELETE /api/emails/labels?id=...
export async function DELETE(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Label ID required" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { error } = await serviceClient
    .from("email_labels")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
