-- Fix infinite recursion in RLS policies for the 'users' table.
-- 
-- Problem: The SELECT policy on 'users' calls get_user_org_id(), which does
-- SELECT org_id FROM users WHERE id = auth.uid(). This triggers the same 
-- SELECT policy → infinite recursion → 500 error.
--
-- Solution: Replace the SELECT policy with a simple id = auth.uid() check.
-- Break the "FOR ALL" policy into separate INSERT/UPDATE/DELETE policies so
-- that only non-SELECT operations use get_user_org_id() (which now works 
-- because the SELECT policy no longer recurses).

-- Step 1: Drop problematic policies on users table
DROP POLICY IF EXISTS "Users can view members of their organization" ON users;
DROP POLICY IF EXISTS "Owners and admins can manage users" ON users;

-- Step 2: Users can always view their own profile (no function call = no recursion)
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

-- Step 3: Break the "FOR ALL" admin policy into separate operations.
-- These won't cause recursion because they don't apply to SELECT,
-- and get_user_org_id() only does a SELECT (which uses the safe policy above).

CREATE POLICY "Owners and admins can insert users"
    ON users FOR INSERT
    WITH CHECK (
        org_id = get_user_org_id() 
        AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners and admins can update org users"
    ON users FOR UPDATE
    USING (
        org_id = get_user_org_id()
        AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owners and admins can delete org users"
    ON users FOR DELETE
    USING (
        org_id = get_user_org_id()
        AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')
        )
    );
