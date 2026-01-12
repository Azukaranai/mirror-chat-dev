-- Modify create_group_with_owner to accept initial members
CREATE OR REPLACE FUNCTION create_group_with_owner(
  p_name TEXT,
  p_avatar_path TEXT DEFAULT NULL,
  p_initial_members UUID[] DEFAULT '{}'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
  v_room_id UUID;
  v_user_id UUID;
  v_member_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Create the group
  INSERT INTO groups (owner_id, name, avatar_path)
  VALUES (v_user_id, p_name, p_avatar_path)
  RETURNING id INTO v_group_id;
  
  -- Add owner as first member with 'owner' role
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'owner');
  
  -- Create room for this group
  INSERT INTO rooms (type, group_id)
  VALUES ('group', v_group_id)
  RETURNING id INTO v_room_id;
  
  -- Add owner to the room
  INSERT INTO room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id);

  -- Add initial members if provided
  IF p_initial_members IS NOT NULL AND array_length(p_initial_members, 1) > 0 THEN
    FOREACH v_member_id IN ARRAY p_initial_members
    LOOP
      -- Check if member is not owner (owner already added)
      IF v_member_id != v_user_id THEN
         -- Add to group with 'member' role
         INSERT INTO group_members (group_id, user_id, role)
         VALUES (v_group_id, v_member_id, 'member')
         ON CONFLICT DO NOTHING;
         
         -- Add to room
         INSERT INTO room_members (room_id, user_id)
         VALUES (v_room_id, v_member_id)
         ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  
  -- Return both IDs as JSON
  RETURN json_build_object(
    'group_id', v_group_id,
    'room_id', v_room_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_group_with_owner(TEXT, TEXT, UUID[]) TO authenticated;
