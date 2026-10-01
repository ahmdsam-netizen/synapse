import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { env, CHAT_SERVICE_URLS } from './config/env.js';
import { ConsistentHashRing } from './hashRing.js';

const app = express();

// Consistent Hash Ring for Chat Microservices
const chatHashRing = new ConsistentHashRing(CHAT_SERVICE_URLS, { virtualNodes: 100 });

const getRoutingKey = (req: any): string => {
  const headerUserId = req.headers?.['x-user-id'] as string;
  if (headerUserId) return headerUserId;

  if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const queryUserId = parsedUrl.searchParams.get('userId');
      if (queryUserId) return queryUserId;
    } catch {
      const match = req.url.match(/[?&]userId=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  }
  return '';
};

const getTargetChatNode = (req: any): string => {
  const key = getRoutingKey(req);
  return (key ? chatHashRing.getNode(key) : null) || CHAT_SERVICE_URLS[0];
};

// 1. Security & CORS
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

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
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return next();
  }

  if (token.startsWith('Bearer ')) {
    token = token.substring(7);
  }

  try {
    // M-08: Explicit algorithm restriction prevents alg-confusion attacks.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
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
    req.headers['x-gateway-secret'] = env.GATEWAY_SECRET;

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
    target: env.CORE_SERVICE_URL,
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


// 7. Route: Recommendations (Similarity / Peers / Boards) -> Recommendation Service
app.use(
  '/api/recommendations',
  authenticateToken,
  requireAuth,
  createProxyMiddleware({
    target: env.REC_SERVICE_URL,
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
    target: env.CORE_SERVICE_URL,
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
    proxyReqWs: onProxyReq,
    error: onProxyError,
  },
});

app.use('/socket.io', authenticateToken, chatWsProxy);

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

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[API Gateway] Running on port ${env.PORT}`);
});

// Forward WebSocket HTTP Upgrade requests to the consistent hash proxy.
// Authentication is enforced here — same guarantee as requireAuth on REST routes.
server.on('upgrade', (req, socket, head) => {
  if (!req.url?.startsWith('/socket.io')) return;

  // Strip any spoofed internal headers from the upgrade request
  delete (req.headers as any)['x-user-id'];
  delete (req.headers as any)['x-user-email'];
  delete (req.headers as any)['x-user-college-id'];
  delete (req.headers as any)['x-gateway-secret'];

  // Verify token from Authorization header or URL query parameter ?token=
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      token = parsedUrl.searchParams.get('token') || undefined;
    } catch {
      const match = req.url.match(/[?&]token=([^&]+)/);
      token = match ? decodeURIComponent(match[1]) : undefined;
    }
  }

  if (token?.startsWith('Bearer ')) {
    token = token.substring(7);
  }

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
      email?: string;
      collegeId?: string;
    };

    if (!payload.id) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    (req.headers as any)['x-user-id'] = payload.id;
    (req.headers as any)['x-user-email'] = payload.email || '';
    (req.headers as any)['x-user-college-id'] = payload.collegeId || '';
    (req.headers as any)['x-gateway-secret'] = env.GATEWAY_SECRET;
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  chatWsProxy.upgrade(req, socket as any, head);
});
