import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
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
app.use(generalLimiter);

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
