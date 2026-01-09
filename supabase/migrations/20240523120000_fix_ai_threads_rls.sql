-- Enable RLS for ai_threads
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can create threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can update own threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can delete own threads" ON ai_threads;
DROP POLICY IF EXISTS "Users can view shared threads" ON ai_threads;

-- Policy: Users can view their own threads
CREATE POLICY "Users can view own threads" ON ai_threads
  FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Policy: Users can insert their own threads
CREATE POLICY "Users can create threads" ON ai_threads
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Users can update their own threads
CREATE POLICY "Users can update own threads" ON ai_threads
  FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Policy: Users can delete their own threads
CREATE POLICY "Users can delete own threads" ON ai_threads
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- Policy: Users can view threads shared with them
CREATE POLICY "Users can view shared threads" ON ai_threads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ai_thread_members
      WHERE ai_thread_members.thread_id = ai_threads.id
      AND ai_thread_members.user_id = auth.uid()
    )
  );

-- Enable RLS for ai_thread_members (for shared threads logic)
ALTER TABLE ai_thread_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for members
DROP POLICY IF EXISTS "Users can view own memberships" ON ai_thread_members;
DROP POLICY IF EXISTS "Thread owners can view memberships" ON ai_thread_members;

-- Policy: Users can view their own memberships
CREATE POLICY "Users can view own memberships" ON ai_thread_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Function to check thread ownership without triggering recursion
CREATE OR REPLACE FUNCTION is_thread_owner(_thread_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ai_threads
    WHERE id = _thread_id
    AND owner_user_id = auth.uid()
  );
$$;

-- Policy: Thread owners can view members of their threads
CREATE POLICY "Thread owners can view memberships" ON ai_thread_members
  FOR SELECT
  USING (is_thread_owner(thread_id));