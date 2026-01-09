-- Update room_summaries view to include nicknames
DROP VIEW IF EXISTS room_summaries;

CREATE VIEW room_summaries AS
SELECT
    rm.user_id,
    r.id AS room_id,
    r.type AS room_type,
    r.group_id,
    rm.last_read_message_id,
    rm.hidden_at,
    CASE
        WHEN r.type = 'group' THEN g.name
        WHEN f_req.requester_nickname IS NOT NULL THEN f_req.requester_nickname
        WHEN f_addr.addressee_nickname IS NOT NULL THEN f_addr.addressee_nickname
        ELSE COALESCE(p_other.display_name, p_other.handle, 'Unknown')
    END AS room_name,
    CASE
        WHEN r.type = 'group' THEN g.avatar_path
        ELSE p_other.avatar_path
    END AS room_avatar_path,
    CASE
        WHEN r.type = 'group' THEN NULL
        ELSE p_other.handle
    END AS room_handle,
    last_msg.id AS last_message_id,
    last_msg.created_at AS last_message_at,
    last_msg.kind AS last_message_kind,
    last_msg.content AS last_message_content,
    (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.room_id = r.id
          AND m.sender_user_id <> rm.user_id
          AND m.created_at > COALESCE(last_read.created_at, 'epoch'::timestamptz)
    ) AS unread_count
FROM room_members rm
JOIN rooms r ON r.id = rm.room_id
LEFT JOIN groups g ON g.id = r.group_id
LEFT JOIN room_members rm_other
    ON rm_other.room_id = r.id
   AND rm_other.user_id <> rm.user_id
LEFT JOIN profiles p_other ON p_other.user_id = rm_other.user_id
-- Join for friendship where I am requester
LEFT JOIN friendships f_req
    ON f_req.requester_id = rm.user_id 
   AND f_req.addressee_id = p_other.user_id
-- Join for friendship where I am addressee
LEFT JOIN friendships f_addr
    ON f_addr.addressee_id = rm.user_id
   AND f_addr.requester_id = p_other.user_id
LEFT JOIN LATERAL (
    SELECT id, content, kind, created_at
    FROM messages
    WHERE room_id = r.id
    ORDER BY created_at DESC
    LIMIT 1
) last_msg ON TRUE
LEFT JOIN messages last_read ON last_read.id = rm.last_read_message_id
WHERE rm.hidden_at IS NULL
   OR (last_msg.created_at IS NOT NULL AND last_msg.created_at > rm.hidden_at);
