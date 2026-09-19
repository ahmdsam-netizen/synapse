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

// Internal microservice communication endpoints for Recommendation Service
app.get('/api/internal/users-data', async (_req, res, next) => {
  try {
    const { getAllUsersForEmbedding } = await import('./modules/users/users.service.js');
    const users = await getAllUsersForEmbedding();
    res.json({ data: users });
  } catch (err) { next(err); }
});

app.get('/api/internal/users-data/:id', async (req, res, next) => {
  try {
    const { getUserForEmbedding } = await import('./modules/users/users.service.js');
    const user = await getUserForEmbedding(req.params.id);
    res.json({ data: user });
  } catch (err) { next(err); }
});

app.get('/api/internal/boards-data', async (_req, res, next) => {
  try {
    const { getAllBoardsForEmbedding } = await import('./modules/boards/boards.service.js');
    const boards = await getAllBoardsForEmbedding();
    res.json({ data: boards });
  } catch (err) { next(err); }
});

app.get('/api/internal/boards-data/:id', async (req, res, next) => {
  try {
    const { getBoardForEmbedding } = await import('./modules/boards/boards.service.js');
    const board = await getBoardForEmbedding(req.params.id);
    res.json({ data: board });
  } catch (err) { next(err); }
});

app.get('/api/internal/connections/:userId', async (req, res, next) => {
  try {
    const { getConnectedUserIds } = await import('./modules/connections/connections.service.js');
    const ids = await getConnectedUserIds(req.params.userId);
    res.json({ data: ids });
  } catch (err) { next(err); }
});

app.get('/api/internal/second-degree-candidates/:userId', async (req, res, next) => {
  try {
    const { getSecondDegreeCandidates } = await import('./modules/connections/connections.service.js');
    const limit = parseInt(req.query.limit as string, 10) || 60;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const candidates = await getSecondDegreeCandidates(req.params.userId, limit, offset);
    res.json({ data: candidates });
  } catch (err) { next(err); }
});

// Error handler (must be last)
app.use(errorHandler);

// Ensure board_postings has expires_at column and index
pool.query(`
  ALTER TABLE board_postings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days');
  UPDATE board_postings SET expires_at = NOW() + INTERVAL '7 days' WHERE expires_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_postings_expires_at ON board_postings(expires_at);
`).catch((err) => {
  console.error('Postings expiration schema check error:', err.message);
});

// Periodic background job: automatically delete expired postings every 60 seconds
setInterval(async () => {
  try {
    const res = await pool.query(`DELETE FROM board_postings WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
    if (res.rowCount && res.rowCount > 0) {
      console.log(`[Auto-Delete] Cleaned up ${res.rowCount} expired board posting(s)`);
    }
  } catch (err: any) {
    console.error('Auto-delete expired postings error:', err.message);
  }
}, 60 * 1000);

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export default app;
