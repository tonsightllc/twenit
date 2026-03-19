import { createClient, createServiceClient } from "./server";

/**
 * Gets the authenticated user and their org_id.
 * Uses the service client for the users table query to bypass RLS
 * (avoids infinite recursion in get_user_org_id() policy).
 * Returns the regular supabase client for subsequent org-scoped queries.
 */
export async function getUserOrg() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, orgId: null };
  }

  // Use service client to bypass RLS on users table
  const serviceClient = await createServiceClient();
  const { data: profile } = await serviceClient
    .from("users")
    .select("org_id, role, full_name, email")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    orgId: profile?.org_id ?? null,
    role: profile?.role ?? null,
    profile,
  };
}
