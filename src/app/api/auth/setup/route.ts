import { createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, email, fullName, orgName } = await request.json();

    if (!userId || !email || !orgName) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    const serviceClient = await createServiceClient();

    // Create slug from org name
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Create organization
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert({
        name: orgName,
        slug: `${slug}-${Date.now()}`,
      })
      .select()
      .single();

    if (orgError) {
      console.error("Error creating organization:", orgError);
      return NextResponse.json(
        { error: "Error al crear la organización" },
        { status: 500 }
      );
    }

    // Create user profile
    const { error: userError } = await serviceClient.from("users").insert({
      id: userId,
      email,
      full_name: fullName,
      org_id: org.id,
      role: "owner",
    });

    if (userError) {
      console.error("Error creating user profile:", userError);
      // Rollback org creation
      await serviceClient.from("organizations").delete().eq("id", org.id);
      return NextResponse.json(
        { error: "Error al crear el perfil de usuario" },
        { status: 500 }
      );
    }

    // Create default unsubscription rules
    await serviceClient.from("unsubscription_rules").insert({
      org_id: org.id,
      immediate_cancel: true,
      offer_benefit_first: false,
    });

    return NextResponse.json({ success: true, orgId: org.id });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
