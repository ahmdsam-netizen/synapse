import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types/index.js';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { query } from '../config/database.js';
import { UnauthorizedError } from '../utils/errors.js';

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // 1. Gateway Forwarded Identity (Microservices Mode)
  // C-03: Only trust x-user-id if the request also carries the shared gateway
  // secret — this confirms the headers were injected by our trusted API gateway
  // and not crafted by an attacker reaching the service directly.
  const gatewayUserId = req.headers['x-user-id'] as string | undefined;
  const gatewaySecret = req.headers['x-gateway-secret'] as string | undefined;
  const expectedGatewaySecret = env.GATEWAY_SECRET;

  if (gatewayUserId && expectedGatewaySecret && gatewaySecret === expectedGatewaySecret) {
    req.user = {
      id: gatewayUserId,
      email: (req.headers['x-user-email'] as string) || '',
      collegeId: (req.headers['x-user-college-id'] as string) || '',
    };
    return next();
  }

  // 2. Direct Bearer Token Fallback (Standalone / Local Mode)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      id: string;
      email: string;
      collegeId: string;
    };

    req.user = {
      id: payload.id,
      email: payload.email,
      collegeId: payload.collegeId,
    };

    // Throttled last_active update using Redis
    const redisKey = `la:${payload.id}`;
    const exists = await redis.exists(redisKey);
    
    if (!exists) {
      await query(`UPDATE users SET last_active = NOW() WHERE id = $1`, [payload.id]);
      await redis.set(redisKey, '1', 'EX', 300); // 300 seconds TTL = 5 minutes
    }

    next();
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
};
