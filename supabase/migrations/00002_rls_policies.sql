-- ============================================
-- Mirror Chat - Row Level Security Policies
-- ============================================
-- This migration enables RLS and creates all security policies.
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_stream_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_llm_keys ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Everyone can view profiles (for handle search)
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can insert their own profile (usually handled by trigger)
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FRIENDSHIPS POLICIES
-- ============================================

-- Users can view friendships they are part of
CREATE POLICY "Users can view own friendships"
    ON friendships FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can create friendship requests
CREATE POLICY "Users can create friendship requests"
    ON friendships FOR INSERT
    WITH CHECK (auth.uid() = requester_id);

-- Users can update friendships they are part of
CREATE POLICY "Users can update own friendships"
    ON friendships FOR UPDATE
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Users can delete friendships they are part of
CREATE POLICY "Users can delete own friendships"
    ON friendships FOR DELETE
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================
-- GROUPS POLICIES
-- ============================================

-- Members can view groups they belong to
CREATE POLICY "Members can view their groups"
    ON groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members 
            WHERE group_members.group_id = groups.id 
            AND group_members.user_id = auth.uid()
        )
    );

-- Users can create groups (they become owner)
CREATE POLICY "Users can create groups"
    ON groups FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Only owner can update group
CREATE POLICY "Owner can update group"
    ON groups FOR UPDATE
    USING (auth.uid() = owner_id);

-- Only owner can delete group
CREATE POLICY "Owner can delete group"
    ON groups FOR DELETE
    USING (auth.uid() = owner_id);

-- ============================================
-- GROUP MEMBERS POLICIES
-- ============================================

-- Members can view group members
CREATE POLICY "Members can view group members"
    ON group_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm 
            WHERE gm.group_id = group_members.group_id 
            AND gm.user_id = auth.uid()
        )
    );

-- Owner/Admin can manage group members
CREATE POLICY "Owner/Admin can insert group members"
    ON group_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
        OR
        -- Allow owner to add first member (themselves)
        EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = group_members.group_id
            AND g.owner_id = auth.uid()
        )
    );

-- Owner/Admin can update group members
CREATE POLICY "Owner/Admin can update group members"
    ON group_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

-- Owner/Admin can remove members, members can leave
CREATE POLICY "Owner/Admin can delete or self leave"
    ON group_members FOR DELETE
    USING (
        auth.uid() = user_id -- Can leave self
        OR EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = group_members.group_id
            AND gm.user_id = auth.uid()
            AND gm.role IN ('owner', 'admin')
        )
    );

-- ============================================
-- ROOMS POLICIES
-- ============================================

-- Members can view rooms
CREATE POLICY "Members can view their rooms"
    ON rooms FOR SELECT
    USING (is_room_member(id, auth.uid()));

-- Users can create rooms
CREATE POLICY "Users can create rooms"
    ON rooms FOR INSERT
    WITH CHECK (true); -- Additional validation in application layer

-- ============================================
-- ROOM MEMBERS POLICIES
-- ============================================

-- Members can view room members
CREATE POLICY "Room members can view members"
    ON room_members FOR SELECT
    USING (is_room_member(room_id, auth.uid()));

-- Users can be added to rooms (DM creation, group join)
CREATE POLICY "Users can join rooms"
    ON room_members FOR INSERT
    WITH CHECK (
        auth.uid() = user_id -- Can add self
        OR is_room_member(room_id, auth.uid()) -- Existing member can add others
    );

-- Members can update their own last_read
CREATE POLICY "Members can update own last_read"
    ON room_members FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- MESSAGES POLICIES
-- ============================================

-- Room members can view messages
CREATE POLICY "Room members can view messages"
    ON messages FOR SELECT
    USING (is_room_member(room_id, auth.uid()));

-- Room members can send messages
CREATE POLICY "Room members can send messages"
    ON messages FOR INSERT
    WITH CHECK (
        is_room_member(room_id, auth.uid())
        AND auth.uid() = sender_user_id
    );

-- Sender can update their messages
CREATE POLICY "Sender can update messages"
    ON messages FOR UPDATE
    USING (auth.uid() = sender_user_id);

-- Sender can delete their messages
CREATE POLICY "Sender can delete messages"
    ON messages FOR DELETE
    USING (auth.uid() = sender_user_id);

-- ============================================
-- MESSAGE REACTIONS POLICIES
-- ============================================

-- Room members can view reactions
CREATE POLICY "Room members can view reactions"
    ON message_reactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = message_reactions.message_id
            AND is_room_member(m.room_id, auth.uid())
        )
    );

-- Room members can add reactions
CREATE POLICY "Room members can add reactions"
    ON message_reactions FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = message_reactions.message_id
            AND is_room_member(m.room_id, auth.uid())
        )
    );

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
    ON message_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- MESSAGE ATTACHMENTS POLICIES
-- ============================================

-- Room members can view attachments
CREATE POLICY "Room members can view attachments"
    ON message_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = message_attachments.message_id
            AND is_room_member(m.room_id, auth.uid())
        )
    );

-- Message sender can add attachments
CREATE POLICY "Sender can add attachments"
    ON message_attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages m
            WHERE m.id = message_attachments.message_id
            AND m.sender_user_id = auth.uid()
        )
    );

-- ============================================
-- AI THREADS POLICIES
-- ============================================

-- Owner and members can view threads
CREATE POLICY "Owner and members can view threads"
    ON ai_threads FOR SELECT
    USING (can_access_ai_thread(id, auth.uid()));

-- Users can create threads
CREATE POLICY "Users can create threads"
    ON ai_threads FOR INSERT
    WITH CHECK (auth.uid() = owner_user_id);

-- Only owner can update threads
CREATE POLICY "Owner can update threads"
    ON ai_threads FOR UPDATE
    USING (auth.uid() = owner_user_id);

-- Only owner can delete threads
CREATE POLICY "Owner can delete threads"
    ON ai_threads FOR DELETE
    USING (auth.uid() = owner_user_id);

-- ============================================
-- AI THREAD MEMBERS POLICIES
-- ============================================

-- Owner and members can view thread members
CREATE POLICY "Owner and members can view thread members"
    ON ai_thread_members FOR SELECT
    USING (can_access_ai_thread(thread_id, auth.uid()));

-- Only owner can add members
CREATE POLICY "Owner can add thread members"
    ON ai_thread_members FOR INSERT
    WITH CHECK (is_ai_thread_owner(thread_id, auth.uid()));

-- Only owner can update member permissions
CREATE POLICY "Owner can update thread members"
    ON ai_thread_members FOR UPDATE
    USING (is_ai_thread_owner(thread_id, auth.uid()));

-- Only owner can remove members
CREATE POLICY "Owner can remove thread members"
    ON ai_thread_members FOR DELETE
    USING (is_ai_thread_owner(thread_id, auth.uid()));

-- ============================================
-- AI MESSAGES POLICIES
-- ============================================

-- Owner and members can view AI messages
CREATE POLICY "Owner and members can view AI messages"
    ON ai_messages FOR SELECT
    USING (can_access_ai_thread(thread_id, auth.uid()));

-- Those with INTERVENE can insert messages (handled by Edge Function mostly)
CREATE POLICY "Authorized users can insert AI messages"
    ON ai_messages FOR INSERT
    WITH CHECK (can_intervene_ai_thread(thread_id, auth.uid()));

-- ============================================
-- AI QUEUE ITEMS POLICIES
-- ============================================

-- Owner and members can view queue
CREATE POLICY "Owner and members can view queue"
    ON ai_queue_items FOR SELECT
    USING (can_access_ai_thread(thread_id, auth.uid()));

-- Owner can always add to queue, members need INTERVENE
CREATE POLICY "Authorized users can add to queue"
    ON ai_queue_items FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND can_intervene_ai_thread(thread_id, auth.uid())
    );

-- Only owner can update queue items (discard)
CREATE POLICY "Owner can update queue items"
    ON ai_queue_items FOR UPDATE
    USING (is_ai_thread_owner(thread_id, auth.uid()));

-- ============================================
-- AI RUNS POLICIES
-- ============================================

-- Owner and members can view runs
CREATE POLICY "Owner and members can view runs"
    ON ai_runs FOR SELECT
    USING (can_access_ai_thread(thread_id, auth.uid()));

-- Edge function will handle insert/update with service role
CREATE POLICY "Service role can manage runs"
    ON ai_runs FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- AI STREAM EVENTS POLICIES
-- ============================================

-- Owner and members can view stream events
CREATE POLICY "Owner and members can view stream events"
    ON ai_stream_events FOR SELECT
    USING (can_access_ai_thread(thread_id, auth.uid()));

-- Edge function will insert with service role
CREATE POLICY "Service role can insert stream events"
    ON ai_stream_events FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- USER LLM KEYS POLICIES
-- ============================================

-- Users can only access their own keys
CREATE POLICY "Users can view own keys"
    ON user_llm_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keys"
    ON user_llm_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keys"
    ON user_llm_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keys"
    ON user_llm_keys FOR DELETE
    USING (auth.uid() = user_id);
