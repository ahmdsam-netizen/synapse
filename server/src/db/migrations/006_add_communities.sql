-- Migration 006: Add communities support to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_community BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_groups_is_community ON groups(is_community);
