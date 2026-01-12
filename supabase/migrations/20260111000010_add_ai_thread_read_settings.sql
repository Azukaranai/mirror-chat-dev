-- Add per-thread read settings (source room + read toggle)

ALTER TABLE ai_threads
ADD COLUMN IF NOT EXISTS source_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS read_enabled BOOLEAN NOT NULL DEFAULT true;

-- Optional index to filter by source_room_id
CREATE INDEX IF NOT EXISTS idx_ai_threads_source_room ON ai_threads(source_room_id);
