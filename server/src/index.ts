import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import connectionRoutes from './modules/connections/connections.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import groupRoutes from './modules/groups/groups.routes.js';
import boardRoutes from './modules/boards/boards.routes.js';
import communityRoutes from './modules/communities/communities.routes.js';
import { initMaintenance } from './jobs/maintenance.js';

const app = express();

// Global middleware
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/communities', communityRoutes);

// Internal microservice communication endpoints for Recommendation Service
// C-02: Protected by a shared GATEWAY_SECRET header check. These routes must
// only be reachable by trusted internal services — not the public internet.
const requireInternalSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = req.headers['x-gateway-secret'];
  if (!secret || secret !== env.GATEWAY_SECRET) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }
  next();
};

app.get('/api/internal/users-data', requireInternalSecret, async (_req, res, next) => {
  try {
    const { getAllUsersForEmbedding } = await import('./modules/users/users.service.js');
    const users = await getAllUsersForEmbedding();
    res.json({ data: users });
  } catch (err) { 
    next(err); 
  }
});

app.get('/api/internal/users-data/:id', requireInternalSecret, async (req, res, next) => {
  try {
    const { getUserForEmbedding } = await import('./modules/users/users.service.js');
    const user = await getUserForEmbedding(req.params.id as string);
    res.json({ data: user });
  } catch (err) { 
    next(err); 
  }
});

app.get('/api/internal/boards-data', requireInternalSecret, async (_req, res, next) => {
  try {
    const { getAllBoardsForEmbedding } = await import('./modules/boards/boards.service.js');
    const boards = await getAllBoardsForEmbedding();
    res.json({ data: boards });
  } catch (err) { 
    next(err); 
  }
});

app.get('/api/internal/boards-data/:id', requireInternalSecret, async (req, res, next) => {
  try {
    const { getBoardForEmbedding } = await import('./modules/boards/boards.service.js');
    const board = await getBoardForEmbedding(req.params.id as string);
    res.json({ data: board });
  } catch (err) { 
    next(err); 
  }
});

app.get('/api/internal/connections/:userId', requireInternalSecret, async (req, res, next) => {
  try {
    const { getConnectedUserIds } = await import('./modules/connections/connections.service.js');
    const ids = await getConnectedUserIds(req.params.userId as string);
    res.json({ data: ids });
  } catch (err) { 
    next(err); 
  }
});

app.get('/api/internal/second-degree-candidates/:userId', requireInternalSecret, async (req, res, next) => {
  try {
    const { getSecondDegreeCandidates } = await import('./modules/connections/connections.service.js');
    const limit = parseInt(req.query.limit as string, 10) || 60;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const candidates = await getSecondDegreeCandidates(req.params.userId as string, limit, offset);
    res.json({ data: candidates });
  } catch (err) { 
    next(err); 
  }
});

// Error handler (must be last)
app.use(errorHandler);

// Background maintenance jobs with BullMQ (distributed repeatable schedules)
initMaintenance().catch((err: any) => {
  console.error('[Maintenance] Failed to initialize BullMQ maintenance jobs:', err.message);
});

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export default app;
