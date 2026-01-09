-- Ensure messages table is in the publication
-- Use SET TABLE which replaces members rather than ADD TABLE which errors if already exists.

ALTER PUBLICATION supabase_realtime SET TABLE 
    messages,
    message_reactions,
    room_members,
    ai_messages,
    ai_stream_events,
    ai_thread_members,
    ai_runs,
    ai_queue_items,
    user_llm_keys;
