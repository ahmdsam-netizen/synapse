import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import connectionRoutes from './modules/connections/connections.routes.js';
import recommendationRoutes from './modules/recommendations/recommendations.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import groupRoutes from './modules/groups/groups.routes.js';
import boardRoutes from './modules/boards/boards.routes.js';
import communityRoutes from './modules/communities/communities.routes.js';
import { pool } from './config/database.js';
const app = express();
// Global middleware
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/communities', communityRoutes);
// Internal microservice communication endpoints for Recommendation Service
app.get('/api/internal/users-data', async (_req, res, next) => {
    try {
        const { getAllUsersForEmbedding } = await import('./modules/users/users.service.js');
        const users = await getAllUsersForEmbedding();
        res.json({ data: users });
    }
    catch (err) {
        next(err);
    }
});
app.get('/api/internal/users-data/:id', async (req, res, next) => {
    try {
        const { getUserForEmbedding } = await import('./modules/users/users.service.js');
        const user = await getUserForEmbedding(req.params.id);
        res.json({ data: user });
    }
    catch (err) {
        next(err);
    }
});
app.get('/api/internal/boards-data', async (_req, res, next) => {
    try {
        const { getAllBoardsForEmbedding } = await import('./modules/boards/boards.service.js');
        const boards = await getAllBoardsForEmbedding();
        res.json({ data: boards });
    }
    catch (err) {
        next(err);
    }
});
app.get('/api/internal/boards-data/:id', async (req, res, next) => {
    try {
        const { getBoardForEmbedding } = await import('./modules/boards/boards.service.js');
        const board = await getBoardForEmbedding(req.params.id);
        res.json({ data: board });
    }
    catch (err) {
        next(err);
    }
});
app.get('/api/internal/connections/:userId', async (req, res, next) => {
    try {
        const { getConnectedUserIds } = await import('./modules/connections/connections.service.js');
        const ids = await getConnectedUserIds(req.params.userId);
        res.json({ data: ids });
    }
    catch (err) {
        next(err);
    }
});
app.get('/api/internal/second-degree-candidates/:userId', async (req, res, next) => {
    try {
        const { getSecondDegreeCandidates } = await import('./modules/connections/connections.service.js');
        const limit = parseInt(req.query.limit, 10) || 60;
        const offset = parseInt(req.query.offset, 10) || 0;
        const candidates = await getSecondDegreeCandidates(req.params.userId, limit, offset);
        res.json({ data: candidates });
    }
    catch (err) {
        next(err);
    }
});
// Error handler (must be last)
app.use(errorHandler);
// Ensure board_postings has expires_at and community column and index, and group_invites table exists
pool.query(`
  ALTER TABLE board_postings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days');
  UPDATE board_postings SET expires_at = NOW() + INTERVAL '7 days' WHERE expires_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_postings_expires_at ON board_postings(expires_at);

  ALTER TABLE board_postings ADD COLUMN IF NOT EXISTS community VARCHAR(50) NOT NULL DEFAULT 'project';
  ALTER TABLE board_postings ALTER COLUMN slots_total SET DEFAULT 1;
  CREATE INDEX IF NOT EXISTS idx_postings_community ON board_postings(community);

  UPDATE board_postings SET community = 'hackathon' WHERE community = 'project' AND (LOWER(title) LIKE '%hackathon%' OR LOWER(description) LIKE '%hackathon%');
  UPDATE board_postings SET community = 'competition' WHERE community = 'project' AND (LOWER(title) LIKE '%competition%' OR LOWER(title) LIKE '%contest%' OR LOWER(description) LIKE '%competition%' OR LOWER(description) LIKE '%contest%');

  ALTER TABLE users ADD COLUMN IF NOT EXISTS open_to_invites BOOLEAN NOT NULL DEFAULT TRUE;
  CREATE INDEX IF NOT EXISTS idx_users_open_to_invites ON users(open_to_invites);

  CREATE TABLE IF NOT EXISTS group_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_group_invites_pending ON group_invites(group_id, invitee_id) WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS idx_group_invites_invitee ON group_invites(invitee_id, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_group_invites_group ON group_invites(group_id, status);

  ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_community BOOLEAN NOT NULL DEFAULT FALSE;
  CREATE INDEX IF NOT EXISTS idx_groups_is_community ON groups(is_community);

  ALTER TABLE groups ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days');
  UPDATE groups SET expires_at = NOW() + INTERVAL '30 days' WHERE expires_at IS NULL AND is_community = FALSE;
  CREATE INDEX IF NOT EXISTS idx_groups_expires_at ON groups(expires_at);
`).catch((err) => {
    console.error('Schema initialization check error:', err.message);
});
// Periodic background cron jobs
// 1. Postings cleanup: runs every 10 minutes
async function cleanupExpiredPostings() {
    try {
        const res = await pool.query(`DELETE FROM board_postings WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
        if (res.rowCount && res.rowCount > 0) {
            console.log(`[Cron:Postings] Cleaned up ${res.rowCount} expired board posting(s)`);
        }
    }
    catch (err) {
        console.error('[Cron:Postings] Error cleaning up expired postings:', err.message);
    }
}
// 2. Groups cleanup: runs every 1 hour (cascades to members, postings, invitations, join_requests)
async function cleanupExpiredGroups() {
    try {
        const res = await pool.query(`DELETE FROM groups WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND is_community = FALSE`);
        if (res.rowCount && res.rowCount > 0) {
            console.log(`[Cron:Groups] Cleaned up ${res.rowCount} expired group(s)`);
        }
    }
    catch (err) {
        console.error('[Cron:Groups] Error cleaning up expired groups:', err.message);
    }
}
// Run initial cleanups on startup
cleanupExpiredPostings();
cleanupExpiredGroups();
// Schedule: Postings every 10 minutes (10 * 60 * 1000 ms)
const POSTING_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
setInterval(cleanupExpiredPostings, POSTING_CLEANUP_INTERVAL_MS);
console.log('[Cron] Scheduled postings cleanup every 10 minutes.');
// Schedule: Groups every 1 hour (60 * 60 * 1000 ms)
const GROUP_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
setInterval(cleanupExpiredGroups, GROUP_CLEANUP_INTERVAL_MS);
console.log('[Cron] Scheduled groups cleanup every 1 hour.');
app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
export default app;
//# sourceMappingURL=index.js.map