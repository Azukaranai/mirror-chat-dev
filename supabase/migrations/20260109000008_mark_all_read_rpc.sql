-- Function to mark all messages as read for the current user
CREATE OR REPLACE FUNCTION mark_all_messages_as_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id uuid := auth.uid();
BEGIN
    -- Update last_read_message_id for all rooms where the user is a member
    -- Set it to the latest message ID in that room
    UPDATE room_members rm
    SET last_read_message_id = (
        SELECT id 
        FROM messages m
        WHERE m.room_id = rm.room_id 
        ORDER BY m.created_at DESC 
        LIMIT 1
    )
    WHERE rm.user_id = current_user_id;
END;
$$;
