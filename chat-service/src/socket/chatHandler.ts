import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from './auth.js';
import { query } from '../config/database.js';
import { env } from '../config/env.js';

// Cache user details for 60 seconds to avoid repeated DB lookups on every message
const userCache = new Map<string, { name: string; avatarUrl: string | null; email: string; cachedAt: number }>();

const getCachedUser = async (userId: string) => {
  const now = Date.now();
  const cached = userCache.get(userId);
  if (cached && now - cached.cachedAt < 60000) {
    return cached;
  }

  const { rows } = await query(
    'SELECT id, name, avatar_url, email FROM users WHERE id = $1',
    [userId]
  );

  if (rows.length === 0) {
    return { name: 'User', avatarUrl: null, email: '', cachedAt: now };
  }

  const user = {
    name: rows[0].name || rows[0].email?.split('@')[0] || 'User',
    avatarUrl: rows[0].avatar_url || null,
    email: rows[0].email || '',
    cachedAt: now,
  };

  userCache.set(userId, user);
  return user;
};

// Verify membership in group or community
const isGroupMember = async (groupId: string, userId: string): Promise<boolean> => {
  const { rows } = await query(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return rows.length > 0;
};

export const registerChatHandlers = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.data.userId;

  // Automatically join personal room for direct user alerts
  socket.join(`user:${userId}`);

  console.log(`[Socket Connected:${env.INSTANCE_ID}] User ${userId} on socket ${socket.id}`);

  // 1. Join Group/Community Room
  socket.on('join_group', async (data: { groupId: string }, callback?: (res: any) => void) => {
    try {
      const { groupId } = data;
      if (!groupId) {
        return callback?.({ success: false, error: 'Group ID is required' });
      }

      const member = await isGroupMember(groupId, userId);
      if (!member) {
        return callback?.({
          success: false,
          error: 'Access denied: You must be a member of this group or community to view and send messages',
        });
      }

      const roomName = `group:${groupId}`;
      await socket.join(roomName);
      console.log(`[Room Join:${env.INSTANCE_ID}] User ${userId} joined ${roomName}`);

      callback?.({
        success: true,
        groupId,
        instanceId: env.INSTANCE_ID,
      });
    } catch (err: any) {
      console.error(`[Join Group Error:${env.INSTANCE_ID}]`, err.message);
      callback?.({ success: false, error: 'Internal server error while joining group room' });
    }
  });

  // 2. Leave Group/Community Room
  socket.on('leave_group', async (data: { groupId: string }, callback?: (res: any) => void) => {
    try {
      const { groupId } = data;
      if (groupId) {
        const roomName = `group:${groupId}`;
        await socket.leave(roomName);
        console.log(`[Room Leave:${env.INSTANCE_ID}] User ${userId} left ${roomName}`);
      }
      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: err.message });
    }
  });

  // 3. Send Message
  socket.on(
    'send_message',
    async (
      data: { groupId: string; content: string },
      callback?: (res: any) => void
    ) => {
      try {
        const { groupId, content } = data;

        if (!groupId) {
          return callback?.({ success: false, error: 'Group ID is required' });
        }

        const trimmedContent = (content || '').trim();
        if (!trimmedContent) {
          return callback?.({ success: false, error: 'Message cannot be empty' });
        }

        if (trimmedContent.length > 2000) {
          return callback?.({ success: false, error: 'Message exceeds 2000 characters' });
        }

        // Verify membership
        const member = await isGroupMember(groupId, userId);
        if (!member) {
          return callback?.({
            success: false,
            error: 'You are not a member of this group or community',
          });
        }

        // Persist message to PostgreSQL
        const { rows } = await query(
          `INSERT INTO group_messages (group_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, group_id, sender_id, content, created_at`,
          [groupId, userId, trimmedContent]
        );

        const savedMsg = rows[0];
        const sender = await getCachedUser(userId);

        const messagePayload = {
          id: savedMsg.id,
          groupId: savedMsg.group_id,
          senderId: savedMsg.sender_id,
          senderName: sender.name,
          senderAvatar: sender.avatarUrl,
          senderEmail: sender.email,
          content: savedMsg.content,
          createdAt: savedMsg.created_at,
          instanceId: env.INSTANCE_ID,
        };

        const roomName = `group:${groupId}`;

        // Broadcast to all sockets in the group room across all instances (via Redis Pub/Sub adapter)
        io.to(roomName).emit('new_message', messagePayload);

        console.log(
          `[Message Broadcast:${env.INSTANCE_ID}] Emitted message ${savedMsg.id} to ${roomName}`
        );

        callback?.({
          success: true,
          message: messagePayload,
        });
      } catch (err: any) {
        console.error(`[Send Message Error:${env.INSTANCE_ID}]`, err.message);
        callback?.({ success: false, error: 'Failed to send message' });
      }
    }
  );

  // 4. Typing Indicator
  socket.on('typing', async (data: { groupId: string; isTyping: boolean }) => {
    try {
      const { groupId, isTyping } = data;
      if (!groupId) return;

      // M-09: Verify membership before broadcasting — prevents any authenticated
      // user from spamming typing events into groups they do not belong to.
      const member = await isGroupMember(groupId, userId);
      if (!member) return;

      const sender = await getCachedUser(userId);
      const roomName = `group:${groupId}`;

      // Broadcast to others in the room across cluster
      socket.to(roomName).emit('user_typing', {
        groupId,
        userId,
        userName: sender.name,
        isTyping: !!isTyping,
        instanceId: env.INSTANCE_ID,
      });
    } catch (err: any) {
      console.error(`[Typing Indicator Error:${env.INSTANCE_ID}]`, err.message);
    }
  });

  // 5. Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket Disconnected:${env.INSTANCE_ID}] User ${userId} disconnected (${reason})`);
  });
};
