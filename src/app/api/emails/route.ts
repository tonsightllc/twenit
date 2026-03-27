import { NextRequest, NextResponse } from "next/server";
import { getUserOrg } from "@/lib/supabase/get-user-org";
import { createServiceClient } from "@/lib/supabase/server";

// PATCH /api/emails — update email fields (is_read, starred, status, labels)
export async function PATCH(request: NextRequest) {
  const { user, orgId } = await getUserOrg();
  if (!user || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, ...updates } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Email ID required" }, { status: 400 });
  }

  // Whitelist allowed fields
  const allowed = ["is_read", "starred", "status", "labels", "classification", "intent"];
  const sanitized = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowed.includes(key))
  );

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("inbound_emails")
    .update(sanitized)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ email: data });
}
