import { pool, query, getClient } from '../../config/database.js';
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
       VALUES ($1, $2, NOW()), ($2, $1, NOW())
       ON CONFLICT (user_id, friend_id) DO UPDATE SET connected_at = NOW()`,
      [requesterId, userId]
    );

    await client.query('COMMIT');

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

export async function removeConnection(connectionIdOrFriendId: string, userId: string) {
  const connRes = await query(
    `SELECT * FROM connections
     WHERE (status = 'accepted' OR status = 'pending')
       AND (requester_id = $2 OR receiver_id = $2)
       AND (
         id = $1
         OR (requester_id = $1 AND receiver_id = $2)
         OR (receiver_id = $1 AND requester_id = $2)
       )
     LIMIT 1`,
    [connectionIdOrFriendId, userId]
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

    await client.query('DELETE FROM connections WHERE id = $1', [conn.id]);

    if (conn.status === 'accepted') {
      await client.query(
        `DELETE FROM connection_edges 
         WHERE (user_id = $1 AND friend_id = $2) 
            OR (user_id = $2 AND friend_id = $1)`,
        [requesterId, receiverId]
      );
    }

    await client.query('COMMIT');

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
    SELECT ce.friend_id, ce.connected_at, conn.id AS connection_id,
           u.id, u.name, u.avatar_url, u.bio, u.college_id, u.year_of_study, u.branch, u.looking_for,
           c.name as college_name
    FROM connection_edges ce
    JOIN connections conn ON conn.status = 'accepted'
      AND ((conn.requester_id = ce.user_id AND conn.receiver_id = ce.friend_id)
        OR (conn.receiver_id = ce.user_id AND conn.requester_id = ce.friend_id))
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

  const pagination = buildPaginationResult(res.rows, limit, (row) => ({
    connectedAt: row.connected_at,
    friendId: row.friend_id,
  }));

  const friendIds = pagination.data.map(r => r.friend_id);
  const skillsMap = new Map<string, any[]>();
  if (friendIds.length > 0) {
    const skillsRes = await query(
      `SELECT us.user_id, s.id, s.name, s.category, us.proficiency 
       FROM user_skills us JOIN skills s ON s.id = us.skill_id 
       WHERE us.user_id = ANY($1)`,
      [friendIds]
    );
    for (const row of skillsRes.rows) {
      if (!skillsMap.has(row.user_id)) skillsMap.set(row.user_id, []);
      skillsMap.get(row.user_id)!.push(row);
    }
  }

  const hydratedData = pagination.data.map(r => ({
    id: r.id,
    friendId: r.friend_id,
    connectionId: r.connection_id,
    connection_id: r.connection_id,
    name: r.name,
    avatarUrl: r.avatar_url,
    avatar_url: r.avatar_url,
    bio: r.bio,
    collegeId: r.college_id,
    collegeName: r.college_name,
    college_name: r.college_name,
    yearOfStudy: r.year_of_study,
    year_of_study: r.year_of_study,
    branch: r.branch,
    lookingFor: r.looking_for,
    connectedAt: r.connected_at,
    connected_at: r.connected_at,
    skills: skillsMap.get(r.id) || []
  }));

  return {
    ...pagination,
    data: hydratedData
  };
}

export async function listPending(userId: string) {
  const res = await query(
    `SELECT c.id, c.requester_id, c.receiver_id, c.status, c.created_at,
            CASE WHEN c.receiver_id = $1 THEN 'received' ELSE 'sent' END as direction,
            u.id as user_id, u.name, u.avatar_url, u.bio, u.college_id, u.year_of_study, u.branch,
            col.name as college_name
     FROM connections c
     JOIN users u ON u.id = (CASE WHEN c.receiver_id = $1 THEN c.requester_id ELSE c.receiver_id END)
     LEFT JOIN colleges col ON col.id = u.college_id
     WHERE (c.receiver_id = $1 OR c.requester_id = $1) AND c.status IN ('pending', 'accepted')
     ORDER BY (c.status = 'pending') DESC, c.created_at DESC`,
    [userId]
  );
  return res.rows.map(r => ({
    id: r.id,
    requesterId: r.requester_id,
    requester_id: r.requester_id,
    receiverId: r.receiver_id,
    receiver_id: r.receiver_id,
    direction: r.direction,
    status: r.status === 'accepted' ? 'approved' : r.status,
    createdAt: r.created_at,
    created_at: r.created_at,
    userId: r.user_id,
    name: r.name,
    avatarUrl: r.avatar_url,
    avatar_url: r.avatar_url,
    bio: r.bio,
    collegeId: r.college_id,
    collegeName: r.college_name,
    college_name: r.college_name,
    yearOfStudy: r.year_of_study,
    year_of_study: r.year_of_study,
    branch: r.branch
  }));
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

export async function getConnectedUserIds(userId: string): Promise<string[]> {
  const res = await query(`
    SELECT receiver_id as friend_id FROM connections WHERE requester_id = $1 AND status = 'accepted'
    UNION
    SELECT requester_id as friend_id FROM connections WHERE receiver_id = $1 AND status = 'accepted'
  `, [userId]);
  return res.rows.map((r: any) => r.friend_id);
}

export async function getSecondDegreeCandidates(userId: string, limit: number = 60, offset: number = 0): Promise<Array<{
  candidate_id: string;
  mutual_count: number;
  via_connection_id: string;
  via_connection_name: string;
}>> {
  const res = await query(`
    SELECT 
      ce2.friend_id AS candidate_id, 
      count(distinct ce1.friend_id)::int AS mutual_count,
      min(ce1.friend_id::text) AS via_connection_id,
      COALESCE((SELECT name FROM users WHERE id = min(ce1.friend_id::text)::uuid), 'A mutual connection') AS via_connection_name
    FROM connection_edges ce1
    JOIN connection_edges ce2 ON ce1.friend_id = ce2.user_id
    WHERE ce1.user_id = $1
      AND ce2.friend_id != $1
      AND NOT EXISTS (
        SELECT 1 FROM connection_edges direct 
        WHERE direct.user_id = $1 
          AND direct.friend_id = ce2.friend_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id = $1 AND ub.blocked_id = ce2.friend_id)
           OR (ub.blocker_id = ce2.friend_id AND ub.blocked_id = $1)
      )
    GROUP BY ce2.friend_id
    ORDER BY mutual_count DESC, ce2.friend_id ASC
    LIMIT $2 OFFSET $3;
  `, [userId, limit, offset]);
  return res.rows;
}

