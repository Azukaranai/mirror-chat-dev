-- ============================================
-- DB Cleanup: Remove redundant functions and standardize naming
-- ============================================

-- 1. Update policy that still uses is_ai_thread_owner to use is_thread_owner_secure
DROP POLICY IF EXISTS "Owner can update queue items" ON ai_queue_items;
CREATE POLICY "Owner can update queue items" ON ai_queue_items
    FOR UPDATE
    USING (is_thread_owner_secure(thread_id));

-- 2. Clean up any orphaned views that may exist
DROP VIEW IF EXISTS room_summaries CASCADE;

-- 3. Recreate room_summaries view with correct column names that frontend expects
CREATE VIEW room_summaries AS
SELECT 
    r.id as room_id,
    r.type as room_type,
    r.group_id,
    rm.user_id,  -- Add user_id for filtering
    COALESCE(
        g.name,
        (
            SELECT 
                COALESCE(
                    (
                        SELECT 
                            CASE 
                                WHEN f.requester_id = rm.user_id THEN f.requester_nickname
                                ELSE f.addressee_nickname 
                            END
                        FROM friendships f 
                        WHERE (
                            (f.requester_id = rm.user_id AND f.addressee_id = rm2.user_id) OR
                            (f.addressee_id = rm.user_id AND f.requester_id = rm2.user_id)
                        )
                        LIMIT 1
                    ),
                    p.display_name
                )
            FROM room_members rm2
            JOIN profiles p ON p.user_id = rm2.user_id
            WHERE rm2.room_id = r.id 
            AND rm2.user_id != rm.user_id
            LIMIT 1
        )
    ) as room_name,
    COALESCE(
        g.avatar_path,
        (
            SELECT p.avatar_path
            FROM room_members rm2
            JOIN profiles p ON p.user_id = rm2.user_id
            WHERE rm2.room_id = r.id 
            AND rm2.user_id != rm.user_id
            LIMIT 1
        )
    ) as room_avatar_path,
    (
        SELECT p.handle
        FROM room_members rm2
        JOIN profiles p ON p.user_id = rm2.user_id
        WHERE rm2.room_id = r.id 
        AND rm2.user_id != rm.user_id
        LIMIT 1
    ) as room_handle,
    (
        SELECT m.content
        FROM messages m
        WHERE m.room_id = r.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) as last_message_content,
    (
        SELECT m.kind
        FROM messages m
        WHERE m.room_id = r.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) as last_message_kind,
    (
        SELECT m.created_at
        FROM messages m
        WHERE m.room_id = r.id
        ORDER BY m.created_at DESC
        LIMIT 1
    ) as last_message_at,
    (
        SELECT count(*)::int
        FROM messages m
        WHERE m.room_id = r.id
        AND (
            rm.last_read_at IS NULL
            OR m.created_at > rm.last_read_at
        )
        AND m.sender_user_id != rm.user_id
    ) as unread_count,
    rm.show_read_status,
    rm.hidden_at
FROM rooms r
JOIN room_members rm ON rm.room_id = r.id
LEFT JOIN groups g ON r.group_id = g.id
WHERE rm.hidden_at IS NULL;

-- Grant access to the view
GRANT SELECT ON room_summaries TO authenticated;
