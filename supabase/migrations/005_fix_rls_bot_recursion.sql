-- Fix infinite recursion in RLS policies for the 'users' table specific to Bot Builder flow
-- Using plpgsql to prevent inlining and ensure SECURITY DEFINER works correctly

-- 1. Redefine get_user_org_id as plpgsql
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT org_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop potential conflicting policies
DROP POLICY IF EXISTS "Users can view members of their organization" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Owners and admins can manage users" ON users;
DROP POLICY IF EXISTS "Owners and admins can insert users" ON users;
DROP POLICY IF EXISTS "Owners and admins can update org users" ON users;
DROP POLICY IF EXISTS "Owners and admins can delete org users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- 3. Re-apply safe policies

-- A. SELECT: Users can view their own profile. 
-- IMPORTANT: We DO NOT allow viewing other org members here to prevent recursion during the check.
-- If listing other members is needed, a separate secure function or view should be used.
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

-- B. INSERT: Only owners/admins can insert (e.g. inviting users)
CREATE POLICY "Owners and admins can insert users"
    ON users FOR INSERT
    WITH CHECK (
        -- We can use get_user_org_id() here because it's an INSERT, not a SELECT on users table
        org_id = get_user_org_id()
        AND EXISTS (
             -- This subquery is safe because the SELECT policy (A) allows reading own profile
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- C. UPDATE: Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- D. UPDATE: Owners/Admins can update other users in their org
CREATE POLICY "Owners and admins can update org users"
    ON users FOR UPDATE
    USING (
        org_id = get_user_org_id()
        AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- E. DELETE: Owners/Admins can delete users
CREATE POLICY "Owners and admins can delete org users"
    ON users FOR DELETE
    USING (
        org_id = get_user_org_id()
        AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );
