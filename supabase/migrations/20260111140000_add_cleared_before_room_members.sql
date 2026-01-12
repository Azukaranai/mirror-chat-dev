-- Add per-user message clear timestamp so reopening a talk can start clean for that user only
alter table room_members
add column if not exists cleared_before timestamptz;

create index if not exists idx_room_members_cleared_before
    on room_members (room_id, user_id);
