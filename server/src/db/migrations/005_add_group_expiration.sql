-- Migration 005: Add expiration to groups

ALTER TABLE groups ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days');
UPDATE groups SET expires_at = NOW() + INTERVAL '30 days' WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_groups_expires_at ON groups(expires_at);
