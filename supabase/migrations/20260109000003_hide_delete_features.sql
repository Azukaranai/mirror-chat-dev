-- Add hidden_at column to room_members for "hide chat" functionality
-- When a user hides a chat, we set hidden_at to the current timestamp
-- The chat will reappear when a new message arrives (we compare message created_at with hidden_at)

ALTER TABLE room_members
ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to messages for soft delete (unsend)
-- This allows the message to be "deleted" but still referenced for reply chains
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Update the room_summaries view to filter out hidden rooms (unless there's a newer message)
-- Note: This is a complex view change, so we'll handle filtering in the application layer instead
-- to avoid breaking existing queries.

COMMENT ON COLUMN room_members.hidden_at IS 'When set, hides the room from the user list until a new message arrives';
COMMENT ON COLUMN messages.deleted_at IS 'Soft delete timestamp for message unsend/delete functionality';
