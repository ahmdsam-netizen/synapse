-- Group and Community Chat Messages
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chronological lookup by group
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created ON group_messages(group_id, created_at ASC);

-- Sender lookup for activity tracking
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id);
