-- ============================================
-- Mirror Chat - Realtime Publication
-- ============================================
-- This migration enables Supabase Realtime for relevant tables.
-- ============================================

-- Drop existing publication if it exists (for idempotency)
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create publication for realtime changes
-- Only include tables that need realtime updates
CREATE PUBLICATION supabase_realtime FOR TABLE
    -- Chat messages and related
    messages,
    message_reactions,
    room_members, -- For last_read updates (既読)
    
    -- AI Thread related
    ai_messages,
    ai_stream_events,
    ai_thread_members, -- For permission changes
    ai_runs, -- For run status updates
    ai_queue_items -- For queue status updates
;

-- ============================================
-- REALTIME FILTERS (Optional performance optimization)
-- ============================================

-- Note: Supabase Realtime allows clients to filter subscriptions
-- Example client-side filter:
--   .on('postgres_changes', {
--     event: 'INSERT',
--     schema: 'public',
--     table: 'messages',
--     filter: 'room_id=eq.{room_id}'
--   }, callback)
--
-- RLS policies will automatically filter what each user can receive

-- ============================================
-- BROADCAST CHANNEL SETUP NOTES
-- ============================================

-- Typing indicators use Broadcast (not DB changes)
-- Client-side implementation:
--
-- // Send typing
-- supabase.channel(`room:${roomId}`)
--   .send({
--     type: 'broadcast',
--     event: 'typing',
--     payload: { userId, isTyping: true, timestamp: Date.now() }
--   })
--
-- // Listen typing
-- supabase.channel(`room:${roomId}`)
--   .on('broadcast', { event: 'typing' }, (payload) => {
--     // Update typing indicators
--   })
--   .subscribe()
--
-- No database table needed for ephemeral typing indicators
