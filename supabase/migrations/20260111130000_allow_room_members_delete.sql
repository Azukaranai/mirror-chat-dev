-- Allow users to leave rooms by deleting their own membership
DROP POLICY IF EXISTS "Members can delete their own room membership" ON room_members;
CREATE POLICY "Members can delete their own room membership"
    ON room_members FOR DELETE
    USING (auth.uid() = user_id);
