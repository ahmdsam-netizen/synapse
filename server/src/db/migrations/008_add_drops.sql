-- Student Drops and Votes (Tweet-like short posts with thumbs up / down)
CREATE TABLE IF NOT EXISTS drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drops_created_at ON drops(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drops_user_id ON drops(user_id);

CREATE TABLE IF NOT EXISTS drop_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (drop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_drop_votes_drop_id ON drop_votes(drop_id);
CREATE INDEX IF NOT EXISTS idx_drop_votes_user_id ON drop_votes(user_id);
