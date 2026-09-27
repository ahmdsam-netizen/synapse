import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ConsistentHashRing } from './hashRing.js';

dotenv.config();

const app = express();

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:4000';
const REC_SERVICE_URL = process.env.REC_SERVICE_URL || 'http://localhost:5000';
const CHAT_SERVICE_URLS = (process.env.CHAT_SERVICE_URLS || 'http://localhost:4001,http://localhost:4002')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// C-04 / C-06: Fail fast if JWT_SECRET is not explicitly configured.
// Never fall back to a hardcoded default — that would allow anyone with
// source-code access to forge valid tokens for any user.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[Gateway] FATAL: JWT_SECRET env var is missing or shorter than 32 characters. Refusing to start.');
  process.exit(1);
}

// C-03 / MED-06: Shared internal secret used to authenticate gateway→service
// header forwarding. Services will reject x-user-id unless this header is also
// present and matches their GATEWAY_SECRET env var.
const GATEWAY_SECRET = process.env.GATEWAY_SECRET;
if (!GATEWAY_SECRET) {
  console.error('[Gateway] FATAL: GATEWAY_SECRET env var is missing. Refusing to start.');
  process.exit(1);
}

// Consistent Hash Ring for Chat Microservices
const chatHashRing = new ConsistentHashRing(CHAT_SERVICE_URLS, { virtualNodes: 100 });

// H-04: Use jwt.verify (cryptographic check) instead of jwt.decode (no check)
// for extracting a routing key from the bearer token.
const getRoutingKey = (req: any): string => {
  // 1. Gateway already validated and injected x-user-id — safest path
  if (req.headers && req.headers['x-user-id']) {
    return req.headers['x-user-id'];
  }

  // 2. Try to verify the bearer token and extract the user id
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id: string };
      if (payload?.id) return payload.id;
    } catch {}
  }

  // 3. Fallback: use the (sanitised) remote address as the hash key
  const clientIp = req.socket?.remoteAddress || '127.0.0.1';
  return String(clientIp);
};

const getTargetChatNode = (req: any): string => {
  const key = getRoutingKey(req);
  return chatHashRing.getNode(key) || CHAT_SERVICE_URLS[0];
};

// 1. Security & CORS
app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

// 2. Prevent client header spoofing by stripping all internal headers before
//    any authentication or routing logic runs.
app.use((req, _res, next) => {
  delete req.headers['x-user-id'];
  delete req.headers['x-user-email'];
  delete req.headers['x-user-college-id'];
  delete req.headers['x-gateway-secret']; // also strip — services set their own check
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
    // M-08: Explicit algorithm restriction prevents alg-confusion attacks.
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
      email?: string;
      collegeId?: string;
    };

    // Enrich internal request headers for downstream microservices
    req.headers['x-user-id'] = payload.id;
    req.headers['x-user-email'] = payload.email || '';
    req.headers['x-user-college-id'] = payload.collegeId || '';
    // C-03: Attach the shared secret so downstream services can verify the
    // headers came from the gateway and not from a direct attacker.
    req.headers['x-gateway-secret'] = GATEWAY_SECRET;

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
  if (req.headers['x-gateway-secret']) {
    proxyReq.setHeader('x-gateway-secret', req.headers['x-gateway-secret']);
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

// H-06: Shared proxy timeout config — prevents a hung service from holding
// connections open indefinitely, which would exhaust the event loop.
const PROXY_TIMEOUT_MS = 30_000;  // 30 s upstream timeout
const SOCKET_TIMEOUT_MS = 35_000; // slightly longer socket timeout

// 4. Gateway Health Check — M-07: removed internal service URLs from response
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// 5. Route: Public Auth -> Core Platform Service
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: SOCKET_TIMEOUT_MS,
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
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: SOCKET_TIMEOUT_MS,
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
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: SOCKET_TIMEOUT_MS,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl.replace(/^\/api/, ''),
    on: {
      proxyReq: onProxyReq,
      error: onProxyError,
    },
  })
);

// 8. Route: Core Application Entities -> Core Platform Service
// H-05: All core entity routes now require a valid authenticated user.
app.use(
  ['/api/users', '/api/connections', '/api/groups', '/api/boards', '/api/search', '/api/communities'],
  authenticateToken,
  requireAuth,
  createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: SOCKET_TIMEOUT_MS,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl,
    on: {
      proxyReq: onProxyReq,
      error: onProxyError,
    },
  })
);

// 9. Route: Real-Time Chat WebSocket Handshake & Upgrades (Consistent Hashing)
const chatWsProxy = createProxyMiddleware({
  target: CHAT_SERVICE_URLS[0],
  router: (req) => getTargetChatNode(req),
  changeOrigin: true,
  ws: true,
  proxyTimeout: PROXY_TIMEOUT_MS,
  timeout: SOCKET_TIMEOUT_MS,
  on: {
    proxyReq: onProxyReq,
    error: onProxyError,
  },
});

app.use('/socket.io', chatWsProxy);

// 10. Route: Real-Time Chat REST API (Consistent Hashing)
app.use(
  '/api/chat',
  authenticateToken,
  requireAuth,
  createProxyMiddleware({
    target: CHAT_SERVICE_URLS[0],
    router: (req) => getTargetChatNode(req),
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    timeout: SOCKET_TIMEOUT_MS,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl,
    on: {
      proxyReq: onProxyReq,
      proxyRes: (_proxyRes, req, res) => {
        const targetNode = getTargetChatNode(req);
        res.setHeader('x-synapse-chat-node', targetNode);
      },
      error: onProxyError,
    },
  })
);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Gateway] Running on port ${PORT}`);
});

// Forward WebSocket HTTP Upgrade requests to the consistent hash proxy
server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/socket.io')) {
    chatWsProxy.upgrade(req, socket as any, head);
  }
});
