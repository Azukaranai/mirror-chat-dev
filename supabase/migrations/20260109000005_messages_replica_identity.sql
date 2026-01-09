-- Enable REPLICA IDENTITY FULL on messages table for DELETE events to include old row data
-- This is required for Supabase Realtime to broadcast the deleted row's id
ALTER TABLE messages REPLICA IDENTITY FULL;
