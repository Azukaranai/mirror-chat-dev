-- ============================================
-- Mirror Chat - Storage Buckets
-- ============================================
-- This migration creates storage buckets and their policies.
-- ============================================

-- ============================================
-- CREATE BUCKETS
-- ============================================

-- Avatars bucket (profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true, -- Public for easy access
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
);

-- Chat attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    false, -- Private, require auth
    26214400, -- 25MB limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ]
);

-- AI attachments bucket (for future AI file handling)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ai-attachments',
    'ai-attachments',
    false,
    26214400, -- 25MB limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv'
    ]
);

-- ============================================
-- AVATARS BUCKET POLICIES
-- ============================================

-- Anyone can view avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- CHAT ATTACHMENTS BUCKET POLICIES
-- ============================================

-- Room members can view attachments
-- Path format: {room_id}/{message_id}/{filename}
CREATE POLICY "Room members can view chat attachments"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'chat-attachments'
        AND is_room_member((storage.foldername(name))[1]::uuid, auth.uid())
    );

-- Room members can upload attachments
CREATE POLICY "Room members can upload chat attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'chat-attachments'
        AND is_room_member((storage.foldername(name))[1]::uuid, auth.uid())
    );

-- Message sender can delete attachments (via cascade mostly)
CREATE POLICY "Authenticated users can delete own chat attachments"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'chat-attachments'
        AND auth.uid() IS NOT NULL
    );

-- ============================================
-- AI ATTACHMENTS BUCKET POLICIES
-- ============================================

-- Thread members can view AI attachments
-- Path format: {thread_id}/{message_id}/{filename}
CREATE POLICY "Thread members can view AI attachments"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'ai-attachments'
        AND can_access_ai_thread((storage.foldername(name))[1]::uuid, auth.uid())
    );

-- Those with INTERVENE can upload AI attachments
CREATE POLICY "Authorized users can upload AI attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'ai-attachments'
        AND can_intervene_ai_thread((storage.foldername(name))[1]::uuid, auth.uid())
    );

-- Thread owner can delete AI attachments
CREATE POLICY "Thread owner can delete AI attachments"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'ai-attachments'
        AND is_ai_thread_owner((storage.foldername(name))[1]::uuid, auth.uid())
    );
