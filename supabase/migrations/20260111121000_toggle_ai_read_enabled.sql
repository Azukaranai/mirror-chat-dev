CREATE OR REPLACE FUNCTION toggle_ai_read_enabled(p_room_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE room_members
  SET ai_read_enabled = p_enabled
  WHERE room_id = p_room_id
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_ai_read_enabled(uuid, boolean) TO authenticated;
