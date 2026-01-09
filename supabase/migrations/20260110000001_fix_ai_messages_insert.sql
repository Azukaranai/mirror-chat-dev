-- Allow service_role to insert ai_messages
-- This is needed because Edge Functions insert messages on behalf of users
DROP POLICY IF EXISTS "Service role can insert AI messages" ON ai_messages;
CREATE POLICY "Service role can insert AI messages"
    ON ai_messages FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Also ensure ai_runs can be read by thread members
DROP POLICY IF EXISTS "Owner and members can view runs" ON ai_runs;
CREATE POLICY "Owner and members can view runs"
    ON ai_runs FOR SELECT
    USING (can_access_ai_thread(thread_id, auth.uid()) OR auth.role() = 'service_role');
