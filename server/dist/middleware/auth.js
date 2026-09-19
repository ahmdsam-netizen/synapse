import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { query } from '../config/database.js';
import { UnauthorizedError } from '../utils/errors.js';
export const requireAuth = async (req, res, next) => {
    // 1. Gateway Forwarded Identity (Microservices Mode)
    const gatewayUserId = req.headers['x-user-id'];
    if (gatewayUserId) {
        req.user = {
            id: gatewayUserId,
            email: req.headers['x-user-email'] || '',
            collegeId: req.headers['x-user-college-id'] || '',
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
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
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
    }
    catch (error) {
        throw new UnauthorizedError('Invalid or expired token');
    }
};
//# sourceMappingURL=auth.js.map