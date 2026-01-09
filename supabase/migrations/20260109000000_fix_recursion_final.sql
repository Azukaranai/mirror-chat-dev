-- Fix recursion for ai_threads and ai_thread_members
-- Drop all possible existing policies to ensure a clean slate

ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_thread_members ENABLE ROW LEVEL SECURITY;

-- 1. DROP POLICIES ON ai_threads
DROP POLICY IF EXISTS "Owner and members can view threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can view own threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can view shared threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can create threads" ON ai_threads;
DROP POLICY IF EXISTS "Owner can update threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can update own threads" ON ai_threads;
DROP POLICY IF EXISTS "Owner can delete threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can delete own threads" ON ai_threads;

-- 2. DROP POLICIES ON ai_thread_members
DROP POLICY IF EXISTS "Owner and members can view thread members" ON ai_thread_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON ai_thread_members;
DROP POLICY IF EXISTS "Thread owners can view memberships" ON ai_thread_members;
DROP POLICY IF EXISTS "Owner can add thread members" ON ai_thread_members;
DROP POLICY IF EXISTS "Owner can update thread members" ON ai_thread_members;
DROP POLICY IF EXISTS "Owner can update member permissions" ON ai_thread_members;
DROP POLICY IF EXISTS "Owner can remove thread members" ON ai_thread_members;

-- 3. Create helper functions ensuring SECURITY DEFINER with plpgsql to prevent inlining
CREATE OR REPLACE FUNCTION is_thread_owner_secure(_thread_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ai_threads
    WHERE id = _thread_id
    AND owner_user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_thread_member_secure(_thread_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM ai_thread_members
    WHERE thread_id = _thread_id
    AND user_id = auth.uid()
  );
END;
$$;

-- 4. Re-create Policies for ai_threads

-- View: Owner OR Member
CREATE POLICY "ai_threads_view_policy" ON ai_threads
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM ai_thread_members
      WHERE thread_id = id
      AND user_id = auth.uid()
    )
  );

-- Insert: Owner only (creation)
CREATE POLICY "ai_threads_insert_policy" ON ai_threads
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- Update: Owner only
CREATE POLICY "ai_threads_update_policy" ON ai_threads
  FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Delete: Owner only
CREATE POLICY "ai_threads_delete_policy" ON ai_threads
  FOR DELETE
  USING (owner_user_id = auth.uid());


-- 5. Re-create Policies for ai_thread_members

-- View: My Membership OR I am Thread Owner
-- Logic: I can see a membership row if:
--   1. It is MY membership (user_id = auth.uid())
--   2. OR I own the thread (is_thread_owner_secure(thread_id))
CREATE POLICY "ai_thread_members_view_policy" ON ai_thread_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    is_thread_owner_secure(thread_id)
  );

-- Insert: Only Thread Owner can add members
CREATE POLICY "ai_thread_members_insert_policy" ON ai_thread_members
  FOR INSERT
  WITH CHECK (is_thread_owner_secure(thread_id));

-- Update: Only Thread Owner
CREATE POLICY "ai_thread_members_update_policy" ON ai_thread_members
  FOR UPDATE
  USING (is_thread_owner_secure(thread_id));

-- Delete: Only Thread Owner (or self leave? currently implementing Owner control)
-- Let's allow users to leave too? (user_id = auth.uid())
-- But mostly owner manages. Let's stick to Owner mostly or Self.
CREATE POLICY "ai_thread_members_delete_policy" ON ai_thread_members
  FOR DELETE
  USING (
    is_thread_owner_secure(thread_id)
    OR
    user_id = auth.uid()
  );
