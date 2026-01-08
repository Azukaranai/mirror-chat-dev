-- Add Mirror auto-friend + DM on signup

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    mirror_id UUID;
    new_room_id UUID;
BEGIN
    INSERT INTO profiles (user_id, display_name, handle)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || SUBSTR(NEW.id::TEXT, 1, 8))
    );

    SELECT user_id INTO mirror_id
    FROM profiles
    WHERE handle = 'mirror'
    LIMIT 1;

    IF mirror_id IS NOT NULL AND mirror_id <> NEW.id THEN
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES (mirror_id, NEW.id, 'accepted')
        ON CONFLICT (requester_id, addressee_id) DO NOTHING;

        INSERT INTO rooms (type)
        VALUES ('dm')
        RETURNING id INTO new_room_id;

        INSERT INTO room_members (room_id, user_id)
        VALUES
            (new_room_id, NEW.id),
            (new_room_id, mirror_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
