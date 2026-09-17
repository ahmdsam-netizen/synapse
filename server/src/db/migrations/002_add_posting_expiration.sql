-- Migration: Add posting expiration
ALTER TABLE board_postings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days');
UPDATE board_postings SET expires_at = NOW() + INTERVAL '7 days' WHERE expires_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_postings_expires_at ON board_postings(expires_at);
