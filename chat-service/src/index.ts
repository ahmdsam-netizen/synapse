import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { pubClient, subClient } from './config/redis.js';
import { socketAuthMiddleware, type AuthenticatedSocket } from './socket/auth.js';
import { registerChatHandlers } from './socket/chatHandler.js';
import chatRoutes from './routes/chat.routes.js';

const app = express();
const server = http.createServer(app);

// 1. HTTP Middleware
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json());

// 2. HTTP Routes
app.use('/api/chat', chatRoutes);

// Root health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'chat-service',
    instanceId: env.INSTANCE_ID,
    timestamp: new Date().toISOString(),
  });
});

// 3. Socket.IO Setup with Redis Pub/Sub Adapter
const io = new Server(server, {
  cors: {
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 25000,
});

// Plug in Redis Adapter for cross-server synchronization
io.adapter(createAdapter(pubClient, subClient));

// 4. Socket Authentication Middleware
io.use(socketAuthMiddleware);

// 5. Connection Handler
io.on('connection', (socket) => {
  registerChatHandlers(io, socket as AuthenticatedSocket);
});

// 6. Start Server
server.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[Chat Microservice] Instance "${env.INSTANCE_ID}" running on port ${env.PORT}`);
  console.log(`[Chat Microservice] Connected to Redis: ${env.REDIS_URL}`);
  console.log(`[Chat Microservice] Connected to PostgreSQL: ${env.DATABASE_URL.replace(/:\/\/.*@/, '://***@')}`);
});

// 7. Graceful Shutdown
const shutdown = async () => {
  console.log(`[Chat Microservice:${env.INSTANCE_ID}] Shutting down gracefully...`);
  io.close();
  server.close(async () => {
    try {
      await pubClient.quit();
      await subClient.quit();
      await pool.end();
      console.log(`[Chat Microservice:${env.INSTANCE_ID}] Resources released. Goodbye.`);
      process.exit(0);
    } catch (err: any) {
      console.error(`[Chat Microservice:${env.INSTANCE_ID}] Error during shutdown:`, err.message);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
