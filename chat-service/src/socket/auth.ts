import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    userEmail?: string;
    userName?: string;
    instanceId: string;
  };
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token && socket.handshake.query?.token) {
      token = socket.handshake.query.token as string;
    }

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
      email?: string;
      name?: string;
    };

    if (!payload.id) {
      return next(new Error('Authentication error: Invalid token payload'));
    }

    socket.data.userId = payload.id;
    socket.data.userEmail = payload.email;
    socket.data.userName = payload.name;
    socket.data.instanceId = env.INSTANCE_ID;

    next();
  } catch (err: any) {
    return next(new Error(`Authentication error: ${err.message}`));
  }
};
