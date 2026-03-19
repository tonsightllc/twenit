import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { Header } from "@/components/dashboard/header";
import { OrgProvider } from "@/components/providers/org-provider";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Always use service client to bypass RLS (avoids infinite recursion in users table policies)
  const serviceClient = await createServiceClient();

  let { data: userProfile } = await serviceClient
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  // Auto-setup: if user exists in auth but has no profile, create org + profile
  if (!userProfile || !userProfile.org_id) {
    console.log("[AUTO-SETUP] Missing profile/org for:", authUser.id, authUser.email);
    try {
      const metadata = authUser.user_metadata || {};
      const fullName = (metadata.full_name as string) || authUser.email?.split("@")[0] || "";
      const orgName = (metadata.org_name as string) || fullName || "Mi Organización";
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "org";

      if (userProfile && !userProfile.org_id) {
        // User exists but has no org - create one and assign
        const { data: org, error: orgError } = await serviceClient
          .from("organizations")
          .insert({ name: orgName, slug: `${slug}-${Date.now()}` })
          .select()
          .single();

        console.log("[AUTO-SETUP] Created org for existing user:", org?.id, orgError?.message);

        if (org) {
          await serviceClient
            .from("users")
            .update({ org_id: org.id, role: "owner" })
            .eq("id", authUser.id);

          await serviceClient.from("unsubscription_rules").insert({
            org_id: org.id,
            immediate_cancel: true,
            offer_benefit_first: false,
          });

          const { data: updated } = await serviceClient
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single();
          userProfile = updated;
        }
      } else if (!userProfile) {
        // No user at all - create org + user
        const { data: org, error: orgError } = await serviceClient
          .from("organizations")
          .insert({ name: orgName, slug: `${slug}-${Date.now()}` })
          .select()
          .single();

        console.log("[AUTO-SETUP] Created org + user:", org?.id, orgError?.message);

        if (org) {
          await serviceClient.from("users").insert({
            id: authUser.id,
            email: authUser.email || "",
            full_name: fullName,
            org_id: org.id,
            role: "owner",
          });

          await serviceClient.from("unsubscription_rules").insert({
            org_id: org.id,
            immediate_cancel: true,
            offer_benefit_first: false,
          });

          const { data: newProfile } = await serviceClient
            .from("users")
            .select("*")
            .eq("id", authUser.id)
            .single();

          userProfile = newProfile;
          console.log("[AUTO-SETUP] Profile created:", newProfile?.id, newProfile?.org_id);
        }
      }
    } catch (err) {
      console.error("[AUTO-SETUP] Error:", err);
    }
  }

  return (
    <OrgProvider orgId={userProfile?.org_id ?? null} userRole={userProfile?.role ?? null}>
      <SidebarProvider>
        <AppSidebar
          user={
            userProfile
              ? { email: userProfile.email, full_name: userProfile.full_name }
              : { email: authUser.email ?? "", full_name: null }
          }
        />
        <SidebarInset>
          <Header />
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </OrgProvider>
  );
}
