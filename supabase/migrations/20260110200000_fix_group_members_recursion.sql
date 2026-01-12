-- ============================================
-- Fix infinite recursion in group_members RLS policies
-- BUG-002: グループ作成不可（infinite recursion含む）
-- ============================================

-- 1. Create helper functions with SECURITY DEFINER to prevent recursion
-- These functions bypass RLS when checking membership

CREATE OR REPLACE FUNCTION is_group_member_secure(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = _group_id
    AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_group_admin_or_owner_secure(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = _group_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_group_owner_by_group_table(_group_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM groups
    WHERE id = _group_id
    AND owner_id = auth.uid()
  );
END;
$$;

-- 2. Drop existing problematic policies on group_members
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
DROP POLICY IF EXISTS "Owner/Admin can insert group members" ON group_members;
DROP POLICY IF EXISTS "Owner/Admin can update group members" ON group_members;
DROP POLICY IF EXISTS "Owner/Admin can delete or self leave" ON group_members;

-- 3. Drop existing policies on groups that might cause issues
DROP POLICY IF EXISTS "Members can view their groups" ON groups;

-- 4. Recreate groups SELECT policy using secure function
CREATE POLICY "groups_select_policy" ON groups
  FOR SELECT
  USING (
    owner_id = auth.uid()
    OR
    is_group_member_secure(id)
  );

-- 5. Recreate group_members policies WITHOUT self-referential recursion

-- SELECT: Can view if I am a member (checked via secure function) OR I am the group owner
CREATE POLICY "group_members_select_policy" ON group_members
  FOR SELECT
  USING (
    user_id = auth.uid()  -- Always can see own membership
    OR
    is_group_member_secure(group_id)  -- Or if I'm a member (secure check)
  );

-- INSERT: 
--   1. Group owner (from groups table) can always add members
--   2. Existing admin/owner can add members
CREATE POLICY "group_members_insert_policy" ON group_members
  FOR INSERT
  WITH CHECK (
    is_group_owner_by_group_table(group_id)  -- Owner from groups table
    OR
    is_group_admin_or_owner_secure(group_id)  -- Existing admin/owner in group_members
  );

-- UPDATE: Only admin/owner can update (change roles)
CREATE POLICY "group_members_update_policy" ON group_members
  FOR UPDATE
  USING (
    is_group_admin_or_owner_secure(group_id)
  );

-- DELETE: 
--   1. Self can leave (user_id = auth.uid())
--   2. Admin/owner can remove others
CREATE POLICY "group_members_delete_policy" ON group_members
  FOR DELETE
  USING (
    user_id = auth.uid()  -- Can leave self
    OR
    is_group_admin_or_owner_secure(group_id)  -- Admin/owner can remove
  );

-- ============================================
-- 6. Create a function for safe group creation with owner as first member
-- This ensures atomic creation of group + first member
-- ============================================

CREATE OR REPLACE FUNCTION create_group_with_owner(
  p_name TEXT,
  p_avatar_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Create the group
  INSERT INTO groups (owner_id, name, avatar_path)
  VALUES (v_user_id, p_name, p_avatar_path)
  RETURNING id INTO v_group_id;
  
  -- Add owner as first member with 'owner' role
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'owner');
  
  RETURN v_group_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_group_with_owner(TEXT, TEXT) TO authenticated;
