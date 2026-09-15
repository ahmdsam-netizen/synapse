import { pool, query, getClient } from '../../config/database.js';
import { recommendationQueue } from '../../config/queue.js';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors.js';
import { decodeCursor, buildPaginationResult, PaginationResult } from '../../utils/pagination.js';

export async function sendRequest(requesterId: string, receiverId: string) {
  if (requesterId === receiverId) {
    throw new ValidationError('Cannot send connection request to yourself');
  }

  // Check if receiver exists
  const receiverRes = await query('SELECT id FROM users WHERE id = $1', [receiverId]);
  if (receiverRes.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  // Check if blocked
  const blockRes = await query(
    `SELECT 1 FROM user_blocks 
     WHERE (blocker_id = $1 AND blocked_id = $2) 
        OR (blocker_id = $2 AND blocked_id = $1)`,
    [requesterId, receiverId]
  );
  if (blockRes.rows.length > 0) {
    throw new ConflictError('Cannot send request due to block');
  }

  // Check existing connection
  const connRes = await query(
    `SELECT status FROM connections 
     WHERE (requester_id = $1 AND receiver_id = $2) 
        OR (requester_id = $2 AND receiver_id = $1)`,
    [requesterId, receiverId]
  );

  if (connRes.rows.length > 0) {
    const status = connRes.rows[0].status;
    if (status === 'pending') {
      throw new ConflictError('Connection request already pending');
    } else if (status === 'accepted') {
      throw new ConflictError('Already connected');
    }
  }

  const insertRes = await query(
    `INSERT INTO connections (requester_id, receiver_id, status) 
     VALUES ($1, $2, 'pending') RETURNING *`,
    [requesterId, receiverId]
  );

  return insertRes.rows[0];
}

export async function acceptConnection(connectionId: string, userId: string) {
  const connRes = await query(
    `SELECT * FROM connections WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
    [connectionId, userId]
  );

  if (connRes.rows.length === 0) {
    throw new NotFoundError('Connection request not found or not in pending state');
  }

  const conn = connRes.rows[0];
  const requesterId = conn.requester_id;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE connections SET status = 'accepted', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [connectionId]
    );

    await client.query(
      `INSERT INTO connection_edges (user_id, friend_id, connected_at) 
       VALUES ($1, $2, NOW()), ($2, $1, NOW())`,
      [requesterId, userId]
    );

    await client.query('COMMIT');

    // Enqueue background jobs for both users and batch updates
    await recommendationQueue.add('computeSecondDegree', { userId: requesterId });
    await recommendationQueue.add('computeSecondDegree', { userId });

    return updateRes.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function declineConnection(connectionId: string, userId: string) {
  const res = await query(
    `UPDATE connections 
     SET status = 'declined', updated_at = NOW() 
     WHERE id = $1 AND receiver_id = $2 AND status = 'pending' 
     RETURNING *`,
    [connectionId, userId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError('Connection request not found or not in pending state');
  }

  return res.rows[0];
}

export async function removeConnection(connectionId: string, userId: string) {
  const connRes = await query(
    `SELECT * FROM connections WHERE id = $1 AND (requester_id = $2 OR receiver_id = $2) AND status = 'accepted'`,
    [connectionId, userId]
  );

  if (connRes.rows.length === 0) {
    throw new NotFoundError('Connection not found');
  }

  const conn = connRes.rows[0];
  const requesterId = conn.requester_id;
  const receiverId = conn.receiver_id;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM connections WHERE id = $1', [connectionId]);

    await client.query(
      `DELETE FROM connection_edges 
       WHERE (user_id = $1 AND friend_id = $2) 
          OR (user_id = $2 AND friend_id = $1)`,
      [requesterId, receiverId]
    );

    await client.query('COMMIT');

    await recommendationQueue.add('computeSecondDegree', { userId: requesterId });
    await recommendationQueue.add('computeSecondDegree', { userId: receiverId });

    return { removed: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listConnections(userId: string, cursor: string | null, limit: number): Promise<PaginationResult<any>> {
  let queryText = `
    SELECT ce.friend_id, ce.connected_at,
           u.id, u.name, u.avatar_url, u.bio, u.college_id, u.year_of_study, u.branch,
           c.name as college_name
    FROM connection_edges ce
    JOIN users u ON u.id = ce.friend_id
    LEFT JOIN colleges c ON c.id = u.college_id
    WHERE ce.user_id = $1
  `;
  const params: any[] = [userId];

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.connectedAt && decoded.friendId) {
      queryText += ` AND (ce.connected_at, ce.friend_id) < ($2, $3)`;
      params.push(decoded.connectedAt, decoded.friendId);
    }
  }

  queryText += ` ORDER BY ce.connected_at DESC, ce.friend_id DESC LIMIT $${params.length + 1}`;
  params.push(limit + 1);

  const res = await query(queryText, params);

  return buildPaginationResult(res.rows, limit, (row) => ({
    connectedAt: row.connected_at,
    friendId: row.friend_id,
  }));
}

export async function listPending(userId: string) {
  const res = await query(
    `SELECT c.*, u.name, u.avatar_url, u.bio, u.college_id, u.year_of_study,
            col.name as college_name
     FROM connections c
     JOIN users u ON u.id = c.requester_id
     LEFT JOIN colleges col ON col.id = u.college_id
     WHERE c.receiver_id = $1 AND c.status = 'pending'
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function getMutualConnections(userId: string, otherUserId: string, cursor: string | null, limit: number): Promise<PaginationResult<any>> {
  let queryText = `
    SELECT u.id, u.name, u.avatar_url, u.college_id, col.name as college_name
    FROM connection_edges e1
    JOIN connection_edges e2 ON e1.friend_id = e2.friend_id
    JOIN users u ON u.id = e1.friend_id
    LEFT JOIN colleges col ON col.id = u.college_id
    WHERE e1.user_id = $1 AND e2.user_id = $2
  `;
  const params: any[] = [userId, otherUserId];

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.id) {
      queryText += ` AND u.id > $3`;
      params.push(decoded.id);
    }
  }

  queryText += ` ORDER BY u.id ASC LIMIT $${params.length + 1}`;
  params.push(limit + 1);

  const res = await query(queryText, params);

  return buildPaginationResult(res.rows, limit, (row) => ({
    id: row.id,
  }));
}
