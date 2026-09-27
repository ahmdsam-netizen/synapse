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
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-characters-dev-key';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
// Consistent Hash Ring for Chat Microservices
const chatHashRing = new ConsistentHashRing(CHAT_SERVICE_URLS, { virtualNodes: 100 });
// Deterministic key extraction for sticky session & cache preservation
const getRoutingKey = (req) => {
    if (req.headers && req.headers['x-user-id']) {
        return req.headers['x-user-id'];
    }
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.decode(token);
            if (decoded?.id)
                return decoded.id;
        }
        catch { }
    }
    const url = req.url || '';
    const tokenMatch = url.match(/[?&]token=([^&]+)/);
    if (tokenMatch && tokenMatch[1]) {
        try {
            const decoded = jwt.decode(decodeURIComponent(tokenMatch[1]));
            if (decoded?.id)
                return decoded.id;
        }
        catch { }
    }
    const userIdMatch = url.match(/[?&]userId=([^&]+)/);
    if (userIdMatch && userIdMatch[1]) {
        return decodeURIComponent(userIdMatch[1]);
    }
    const cookieHeader = req.headers?.cookie;
    if (cookieHeader) {
        const cookieMatch = cookieHeader.match(/synapse_chat_user=([^;]+)/);
        if (cookieMatch && cookieMatch[1]) {
            return decodeURIComponent(cookieMatch[1]);
        }
    }
    const clientIp = req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return String(clientIp);
};
const getTargetChatNode = (req) => {
    const key = getRoutingKey(req);
    return chatHashRing.getNode(key) || CHAT_SERVICE_URLS[0];
};
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
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        // Enrich internal request headers for downstream microservices
        req.headers['x-user-id'] = payload.id;
        req.headers['x-user-email'] = payload.email || '';
        req.headers['x-user-college-id'] = payload.collegeId || '';
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    }
};
const requireAuth = (req, res, next) => {
    if (!req.headers['x-user-id']) {
        return res.status(401).json({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
    }
    next();
};
// Helper: inject enriched headers into outgoing proxy request
const onProxyReq = (proxyReq, req) => {
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
const onProxyError = (err, _req, res) => {
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
app.use('/api/auth', createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl,
    on: {
        proxyReq: onProxyReq,
        error: onProxyError,
    },
}));
// 6. Route: Board Matching (Vector Recommendation) -> Recommendation Service
app.use('/api/boards/matched', authenticateToken, requireAuth, createProxyMiddleware({
    target: REC_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl.replace(/^\/api/, ''),
    on: {
        proxyReq: onProxyReq,
        error: onProxyError,
    },
}));
// 7. Route: Recommendations (Similarity / Peers / Boards) -> Recommendation Service
app.use('/api/recommendations', authenticateToken, requireAuth, createProxyMiddleware({
    target: REC_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl.replace(/^\/api/, ''),
    on: {
        proxyReq: onProxyReq,
        error: onProxyError,
    },
}));
// 8. Route: Core Application Entities -> Core Platform Service
app.use(['/api/users', '/api/connections', '/api/groups', '/api/boards', '/api/search', '/api/communities'], authenticateToken, createProxyMiddleware({
    target: CORE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl,
    on: {
        proxyReq: onProxyReq,
        error: onProxyError,
    },
}));
// 9. Route: Real-Time Chat WebSocket Handshake & Upgrades (Consistent Hashing)
const chatWsProxy = createProxyMiddleware({
    target: CHAT_SERVICE_URLS[0],
    router: (req) => getTargetChatNode(req),
    changeOrigin: true,
    ws: true,
    on: {
        proxyReq: onProxyReq,
        error: onProxyError,
    },
});
app.use('/socket.io', chatWsProxy);
// 10. Route: Real-Time Chat REST API (Consistent Hashing)
app.use('/api/chat', authenticateToken, requireAuth, createProxyMiddleware({
    target: CHAT_SERVICE_URLS[0],
    router: (req) => getTargetChatNode(req),
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl,
    on: {
        proxyReq: onProxyReq,
        proxyRes: (_proxyRes, req, res) => {
            const targetNode = getTargetChatNode(req);
            res.setHeader('x-synapse-chat-node', targetNode);
        },
        error: onProxyError,
    },
}));
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API Gateway] Running on port ${PORT}`);
    console.log(`[API Gateway] Routing Core -> ${CORE_SERVICE_URL}`);
    console.log(`[API Gateway] Routing Recommendations -> ${REC_SERVICE_URL}`);
    console.log(`[API Gateway] Routing Chat -> [${CHAT_SERVICE_URLS.join(', ')}] (Consistent Hash Ring)`);
});
// Forward WebSocket HTTP Upgrade requests to the consistent hash proxy
server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/socket.io')) {
        chatWsProxy.upgrade(req, socket, head);
    }
});
