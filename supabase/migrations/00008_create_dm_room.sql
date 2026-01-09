-- Create DM room + memberships in a single transaction to avoid RLS issues
CREATE OR REPLACE FUNCTION create_dm_room(friend_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_room_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF friend_id IS NULL OR friend_id = v_user_id THEN
        RAISE EXCEPTION 'Invalid friend id';
    END IF;

    SELECT rm.room_id
    INTO v_room_id
    FROM room_members rm
    JOIN room_members rm2 ON rm2.room_id = rm.room_id
    JOIN rooms r ON r.id = rm.room_id
    WHERE rm.user_id = v_user_id
      AND rm2.user_id = friend_id
      AND r.type = 'dm'
    LIMIT 1;

    IF v_room_id IS NOT NULL THEN
        RETURN v_room_id;
    END IF;

    INSERT INTO rooms (type)
    VALUES ('dm')
    RETURNING id INTO v_room_id;

    INSERT INTO room_members (room_id, user_id)
    VALUES (v_room_id, v_user_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO room_members (room_id, user_id)
    VALUES (v_room_id, friend_id)
    ON CONFLICT DO NOTHING;

    RETURN v_room_id;
END;
$$;
