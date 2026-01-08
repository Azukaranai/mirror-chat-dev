-- ============================================
-- Mirror Chat - Initial Database Schema
-- ============================================
-- This migration creates all tables, indexes, and RLS policies
-- for the Mirror Chat application.
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

-- Friendship status enum
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

-- Group member role enum
CREATE TYPE group_role AS ENUM ('owner', 'admin', 'member');

-- Room type enum
CREATE TYPE room_type AS ENUM ('dm', 'group');

-- Message kind enum
CREATE TYPE message_kind AS ENUM ('text', 'attachment', 'shared_ai_thread', 'system');

-- AI message role enum
CREATE TYPE ai_role AS ENUM ('user', 'assistant', 'system');

-- AI sender kind enum
CREATE TYPE ai_sender_kind AS ENUM ('owner', 'collaborator', 'assistant', 'system');

-- AI thread permission enum
CREATE TYPE ai_permission AS ENUM ('VIEW', 'INTERVENE');

-- AI queue kind enum
CREATE TYPE ai_queue_kind AS ENUM ('owner', 'collaborator');

-- AI queue status enum
CREATE TYPE ai_queue_status AS ENUM ('pending', 'consumed', 'discarded');

-- AI run status enum
CREATE TYPE ai_run_status AS ENUM ('running', 'completed', 'failed');

-- ============================================
-- CORE TABLES: Users & Profiles
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    avatar_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for handle search
CREATE INDEX idx_profiles_handle ON profiles(handle);
CREATE INDEX idx_profiles_display_name ON profiles(display_name);

-- ============================================
-- FRIENDSHIPS
-- ============================================

CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status friendship_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);

-- ============================================
-- GROUPS
-- ============================================

CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_owner ON groups(owner_id);

CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role group_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members(user_id);

-- ============================================
-- ROOMS (DM / Group unified)
-- ============================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type room_type NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (type = 'dm' AND group_id IS NULL) OR
        (type = 'group' AND group_id IS NOT NULL)
    )
);

CREATE INDEX idx_rooms_group ON rooms(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_rooms_type ON rooms(type);

CREATE TABLE room_members (
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_message_id UUID,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

CREATE INDEX idx_room_members_user ON room_members(user_id);

-- ============================================
-- MESSAGES
-- ============================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind message_kind NOT NULL DEFAULT 'text',
    content TEXT,
    reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_room ON messages(room_id);
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_user_id);
CREATE INDEX idx_messages_reply ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

-- Add foreign key for last_read_message_id after messages table exists
ALTER TABLE room_members
    ADD CONSTRAINT fk_room_members_last_read
    FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- ============================================
-- MESSAGE REACTIONS
-- ============================================

CREATE TABLE message_reactions (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, reaction_type)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- ============================================
-- MESSAGE ATTACHMENTS
-- ============================================

CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL,
    object_path TEXT NOT NULL,
    mime TEXT NOT NULL,
    size BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_message ON message_attachments(message_id);

-- ============================================
-- AI THREADS
-- ============================================

CREATE TABLE ai_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    system_prompt TEXT,
    model TEXT NOT NULL DEFAULT 'gpt-4o',
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_threads_owner ON ai_threads(owner_user_id);
CREATE INDEX idx_ai_threads_archived ON ai_threads(archived_at) WHERE archived_at IS NOT NULL;

-- ============================================
-- AI THREAD MEMBERS (Sharing)
-- ============================================

CREATE TABLE ai_thread_members (
    thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission ai_permission NOT NULL DEFAULT 'VIEW',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX idx_ai_thread_members_user ON ai_thread_members(user_id);
CREATE INDEX idx_ai_thread_members_permission ON ai_thread_members(thread_id, permission);

-- ============================================
-- AI MESSAGES
-- ============================================

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
    role ai_role NOT NULL,
    sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_kind ai_sender_kind NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_messages_thread ON ai_messages(thread_id);
CREATE INDEX idx_ai_messages_thread_created ON ai_messages(thread_id, created_at ASC);

-- ============================================
-- AI QUEUE ITEMS (Intervention queue)
-- ============================================

CREATE TABLE ai_queue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind ai_queue_kind NOT NULL,
    content TEXT NOT NULL,
    status ai_queue_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    discarded_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_queue_thread ON ai_queue_items(thread_id);
CREATE INDEX idx_ai_queue_pending ON ai_queue_items(thread_id, status, created_at) 
    WHERE status = 'pending';

-- ============================================
-- AI RUNS (Execution control)
-- ============================================

CREATE TABLE ai_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
    status ai_run_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    error TEXT
);

CREATE INDEX idx_ai_runs_thread ON ai_runs(thread_id);

-- CRITICAL: Only one running run per thread at a time
CREATE UNIQUE INDEX idx_ai_runs_single_running 
    ON ai_runs(thread_id) 
    WHERE status = 'running';

-- ============================================
-- AI STREAM EVENTS (Realtime streaming)
-- ============================================

CREATE TABLE ai_stream_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES ai_threads(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    delta TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_stream_thread_run ON ai_stream_events(thread_id, run_id, seq);

-- ============================================
-- USER LLM KEYS (Encrypted API Keys)
-- ============================================

CREATE TABLE user_llm_keys (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    key_last4 TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'openai',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user is member of a room
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM room_members 
        WHERE room_id = p_room_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access AI thread
CREATE OR REPLACE FUNCTION can_access_ai_thread(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM ai_threads WHERE id = p_thread_id AND owner_user_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM ai_thread_members WHERE thread_id = p_thread_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is AI thread owner
CREATE OR REPLACE FUNCTION is_ai_thread_owner(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM ai_threads WHERE id = p_thread_id AND owner_user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has INTERVENE permission
CREATE OR REPLACE FUNCTION can_intervene_ai_thread(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM ai_threads WHERE id = p_thread_id AND owner_user_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM ai_thread_members 
        WHERE thread_id = p_thread_id AND user_id = p_user_id AND permission = 'INTERVENE'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at for profiles
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for groups
CREATE TRIGGER trigger_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for ai_threads
CREATE TRIGGER trigger_ai_threads_updated_at
    BEFORE UPDATE ON ai_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Auto-update updated_at for user_llm_keys
CREATE TRIGGER trigger_user_llm_keys_updated_at
    BEFORE UPDATE ON user_llm_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id, display_name, handle)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || SUBSTR(NEW.id::TEXT, 1, 8))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
