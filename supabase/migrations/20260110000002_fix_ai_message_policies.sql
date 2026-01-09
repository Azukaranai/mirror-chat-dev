-- Ensure security functions exist
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

-- Fix ai_messages policies
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner and members can view AI messages" ON ai_messages;
DROP POLICY IF EXISTS "ai_messages_view_policy" ON ai_messages;

CREATE POLICY "ai_messages_view_policy" ON ai_messages
  FOR SELECT
  USING (
    is_thread_owner_secure(thread_id)
    OR
    is_thread_member_secure(thread_id)
  );

-- Fix insert policy
DROP POLICY IF EXISTS "Authorized users can insert AI messages" ON ai_messages;
DROP POLICY IF EXISTS "ai_messages_insert_policy" ON ai_messages;

CREATE POLICY "ai_messages_insert_policy" ON ai_messages
  FOR INSERT
  WITH CHECK (
    is_thread_owner_secure(thread_id)
    OR
    EXISTS (
      SELECT 1 FROM ai_thread_members
      WHERE thread_id = ai_messages.thread_id
      AND user_id = auth.uid()
      AND permission = 'INTERVENE'
    )
  );
