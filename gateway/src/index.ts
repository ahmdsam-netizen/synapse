import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:4000';
const REC_SERVICE_URL = process.env.REC_SERVICE_URL || 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-characters-dev-key';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Security & CORS (No rate limiting as requested)
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

// 2. Prevent client header spoofing by stripping untrusted internal headers
app.use((req, _res, next) => {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-email'];
  delete req.headers['x-user-college-id'];
  next();
});

// 3. Central Gateway Authentication Middleware
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
      email?: string;
      collegeId?: string;
    };

    // Enrich internal request headers for downstream microservices
    req.headers['x-user-id'] = payload.id;
    req.headers['x-user-email'] = payload.email || '';
    req.headers['x-user-college-id'] = payload.collegeId || '';

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.headers['x-user-id']) {
    return res.status(401).json({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
  }
  next();
};

// Helper: inject enriched headers into outgoing proxy request
const onProxyReq = (proxyReq: any, req: any) => {
  if (req.headers['x-user-id']) {
    proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
  }
  if (req.headers['x-user-email']) {
    proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
  }
  if (req.headers['x-user-college-id']) {
    proxyReq.setHeader('x-user-college-id', req.headers['x-user-college-id']);
  }
};

// Helper: handle proxy errors gracefully
const onProxyError = (err: any, _req: any, res: any) => {
  console.error('[Gateway Proxy Error]:', err?.message || err);
  if (res && !res.headersSent) {
    res.status(502).json({
      error: 'Bad Gateway: downstream microservice is unavailable',
      code: 'DOWNSTREAM_UNAVAILABLE',
    });
  }
};

// 4. Gateway Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    routes: {
      core: CORE_SERVICE_URL,
      recommendation: REC_SERVICE_URL,
    },
  });
});

// 5. Route: Public Auth -> Core Platform Service
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl,
    on: {
      proxyReq: onProxyReq,
      error: onProxyError,
    },
  })
);

// 6. Route: Board Matching (Vector Recommendation) -> Recommendation Service
app.use(
  '/api/boards/matched',
  authenticateToken,
  requireAuth,
  createProxyMiddleware({
    target: REC_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl.replace(/^\/api/, ''),
    on: {
      proxyReq: onProxyReq,
      error: onProxyError,
    },
  })
);

// 7. Route: Recommendations (Similarity / Peers / Boards) -> Recommendation Service
app.use(
  '/api/recommendations',
  authenticateToken,
  requireAuth,
  createProxyMiddleware({
    target: REC_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl.replace(/^\/api/, ''),
    on: {
      proxyReq: onProxyReq,
      error: onProxyError,
    },
  })
);

// 8. Route: Core Application Entities -> Core Platform Service
app.use(
  ['/api/users', '/api/connections', '/api/groups', '/api/boards', '/api/search'],
  authenticateToken,
  createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl,
    on: {
      proxyReq: onProxyReq,
      error: onProxyError,
    },
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Gateway] Running on port ${PORT}`);
  console.log(`[API Gateway] Routing Core -> ${CORE_SERVICE_URL}`);
  console.log(`[API Gateway] Routing Recommendations -> ${REC_SERVICE_URL}`);
});
