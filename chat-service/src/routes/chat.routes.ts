import { Router } from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { env } from '../config/env.js';

const router = Router();

// Helper to extract authenticated user id from header or token
const extractUserId = (req: Request): string | null => {
  if (req.headers['x-user-id']) {
    return req.headers['x-user-id'] as string;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      // H-07: algorithms restriction prevents alg:none and alg-confusion attacks
      const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { id: string };
      return payload.id;
    } catch {}
  }

  return null;
};

// 1. Health check & cluster status
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'chat-service',
    instanceId: env.INSTANCE_ID,
    port: env.PORT,
    timestamp: new Date().toISOString(),
  });
});

// 2. Get message history for a group or community
router.get('/groups/:groupId/messages', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const userId = extractUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: missing user credentials', code: 'UNAUTHORIZED' });
    }

    // Verify user is a member of the group/community
    const { rows: memberRows } = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberRows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden: You must be a member of this group or community to view messages',
        code: 'FORBIDDEN',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const before = req.query.before as string | undefined;

    let queryText = `
      SELECT 
        m.id,
        m.group_id as "groupId",
        m.sender_id as "senderId",
        m.content,
        m.created_at as "createdAt",
        COALESCE(u.name, split_part(u.email, '@', 1)) as "senderName",
        u.avatar_url as "senderAvatar",
        u.email as "senderEmail"
      FROM group_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = $1
    `;
    const params: any[] = [groupId];

    if (before) {
      queryText += ` AND m.created_at < $2`;
      params.push(before);
    }

    queryText += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await query(queryText, params);

    // Return in chronological ascending order for UI consumption
    const messages = rows.reverse();

    res.json({
      data: messages,
      instanceId: env.INSTANCE_ID,
    });
  } catch (err: any) {
    console.error(`[Chat REST Error:${env.INSTANCE_ID}]`, err.message);
    res.status(500).json({ error: 'Failed to retrieve messages', code: 'INTERNAL_ERROR' });
  }
});

export default router;
