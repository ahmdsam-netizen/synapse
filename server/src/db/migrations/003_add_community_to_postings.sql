-- Migration: Add community to board_postings and set slots_total default to 1
ALTER TABLE board_postings ADD COLUMN IF NOT EXISTS community VARCHAR(50) NOT NULL DEFAULT 'project';
ALTER TABLE board_postings ALTER COLUMN slots_total SET DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_postings_community ON board_postings(community);

-- Backfill / classify existing postings if any mentions hackathon or competition in title or description
UPDATE board_postings SET community = 'hackathon' 
WHERE community = 'project' AND (LOWER(title) LIKE '%hackathon%' OR LOWER(description) LIKE '%hackathon%');

UPDATE board_postings SET community = 'competition' 
WHERE community = 'project' AND (LOWER(title) LIKE '%competition%' OR LOWER(title) LIKE '%contest%' OR LOWER(description) LIKE '%competition%' OR LOWER(description) LIKE '%contest%');
