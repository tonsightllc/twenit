import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!userProfile?.org_id) {
    return NextResponse.json({ error: "No hay organización" }, { status: 400 });
  }

  if (userProfile.role !== "owner" && userProfile.role !== "admin") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // Delete the Stripe connection
  const { error } = await supabase
    .from("stripe_connections")
    .delete()
    .eq("org_id", userProfile.org_id);

  if (error) {
    return NextResponse.json({ error: "Error al desconectar" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}