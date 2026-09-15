-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Colleges
CREATE TABLE colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email_domain VARCHAR(255) UNIQUE NOT NULL,
  city VARCHAR(255)
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url VARCHAR(512),
  bio TEXT,
  college_id UUID REFERENCES colleges(id),
  year_of_study INT,
  branch VARCHAR(255),
  looking_for VARCHAR(20) DEFAULT 'none' CHECK (looking_for IN ('project', 'event', 'both', 'none')),
  profile_completeness INT DEFAULT 0,
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Taxonomy tables (curated by admin, users select from these)
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(255) NOT NULL
);

CREATE TABLE interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(255) NOT NULL
);

-- Junction tables
CREATE TABLE user_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency VARCHAR(20) NOT NULL DEFAULT 'beginner' CHECK (proficiency IN ('beginner', 'intermediate', 'advanced')),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE user_interests (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, interest_id)
);

-- Work showcase
CREATE TABLE work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  tech_used TEXT[] DEFAULT '{}',
  repo_url VARCHAR(512),
  live_url VARCHAR(512),
  media_url VARCHAR(512),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Social graph - connection requests
CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (requester_id, receiver_id)
);

-- Materialized symmetric edge table (two rows per accepted connection)
CREATE TABLE connection_edges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id),
  college_id UUID REFERENCES colleges(id),
  visibility VARCHAR(20) DEFAULT 'global' CHECK (visibility IN ('global', 'college')),
  max_members INT DEFAULT 10,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Board postings
CREATE TABLE board_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  board_type VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (board_type IN ('global', 'matched')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  roles_needed TEXT[] DEFAULT '{}',
  required_skill_ids UUID[] DEFAULT '{}',
  required_interest_ids UUID[] DEFAULT '{}',
  slots_total INT NOT NULL DEFAULT 5,
  slots_filled INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Join requests
CREATE TABLE join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id UUID NOT NULL REFERENCES board_postings(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  UNIQUE (posting_id, user_id)
);

-- Precomputed recommendations
CREATE TABLE recommendations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rec_type VARCHAR(30) NOT NULL CHECK (rec_type IN ('second_degree', 'similarity')),
  score NUMERIC NOT NULL DEFAULT 0,
  rank INT NOT NULL,
  via_connection_id UUID,
  mutual_count INT DEFAULT 0,
  computed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, candidate_id, rec_type)
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User blocks
CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ==================== INDEXES ====================
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX idx_user_interests_interest ON user_interests(interest_id);
CREATE INDEX idx_edges_user_recent ON connection_edges(user_id, connected_at DESC);
CREATE INDEX idx_connections_receiver ON connections(receiver_id, status);
CREATE INDEX idx_connections_requester ON connections(requester_id, status);
CREATE INDEX idx_users_college ON users(college_id);
CREATE INDEX idx_rec_user_type_rank ON recommendations(user_id, rec_type, rank);
CREATE INDEX idx_postings_status ON board_postings(status, created_at DESC);
CREATE INDEX idx_join_requests_group ON join_requests(group_id, status);
CREATE INDEX idx_join_requests_user ON join_requests(user_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_work_items_user ON work_items(user_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_active ON users(last_active DESC);
