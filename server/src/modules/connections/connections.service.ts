import { prisma } from '../../config/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors.js';
import { decodeCursor, buildPaginationResult, PaginationResult } from '../../utils/pagination.js';

export async function sendRequest(requesterId: string, receiverId: string) {
  if (requesterId === receiverId) {
    throw new ValidationError('Cannot send connection request to yourself');
  }

  // Check if receiver exists
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true },
  });
  if (!receiver) {
    throw new NotFoundError('User not found');
  }

  // Check if blocked
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: requesterId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: requesterId },
      ],
    },
  });
  if (block) {
    throw new ConflictError('Cannot send request due to block');
  }

  // Check existing connection
  const existing = await prisma.connection.findFirst({
    where: {
      OR: [
        { requesterId, receiverId },
        { requesterId: receiverId, receiverId: requesterId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'pending') {
      throw new ConflictError('Connection request already pending');
    } else if (existing.status === 'accepted') {
      throw new ConflictError('Already connected');
    }
  }

  return prisma.connection.create({
    data: {
      requesterId,
      receiverId,
      status: 'pending',
    },
  });
}

export async function acceptConnection(connectionId: string, userId: string) {
  const conn = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      receiverId: userId,
      status: 'pending',
    },
  });

  if (!conn) {
    throw new NotFoundError('Connection request not found or not in pending state');
  }

  const requesterId = conn.requesterId;

  // Use a transaction to update connection status and insert symmetric graph edges
  return prisma.$transaction(async (tx) => {
    const updated = await tx.connection.update({
      where: { id: connectionId },
      data: {
        status: 'accepted',
        updatedAt: new Date(),
      },
    });

    await tx.connectionEdge.upsert({
      where: { userId_friendId: { userId: requesterId, friendId: userId } },
      update: { connectedAt: new Date() },
      create: { userId: requesterId, friendId: userId },
    });

    await tx.connectionEdge.upsert({
      where: { userId_friendId: { userId, friendId: requesterId } },
      update: { connectedAt: new Date() },
      create: { userId, friendId: requesterId },
    });

    return updated;
  });
}

export async function declineConnection(connectionId: string, userId: string) {
  const conn = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      receiverId: userId,
      status: 'pending',
    },
  });

  if (!conn) {
    throw new NotFoundError('Connection request not found or not in pending state');
  }

  return prisma.connection.update({
    where: { id: connectionId },
    data: {
      status: 'declined',
      updatedAt: new Date(),
    },
  });
}

export async function removeConnection(connectionIdOrFriendId: string, userId: string) {
  const conn = await prisma.connection.findFirst({
    where: {
      AND: [
        {
          OR: [
            { status: 'accepted' },
            { status: 'pending' },
          ],
        },
        {
          OR: [
            { id: connectionIdOrFriendId },
            { requesterId: connectionIdOrFriendId, receiverId: userId },
            { receiverId: connectionIdOrFriendId, requesterId: userId },
          ],
        },
      ],
    },
  });

  if (!conn) {
    throw new NotFoundError('Connection not found');
  }

  const requesterId = conn.requesterId;
  const receiverId = conn.receiverId;

  return prisma.$transaction(async (tx) => {
    await tx.connection.delete({
      where: { id: conn.id },
    });

    if (conn.status === 'accepted') {
      await tx.connectionEdge.deleteMany({
        where: {
          OR: [
            { userId: requesterId, friendId: receiverId },
            { userId: receiverId, friendId: requesterId },
          ],
        },
      });
    }

    return { removed: true };
  });
}

export async function listConnections(
  userId: string,
  cursor: string | null,
  limit: number
): Promise<PaginationResult<any>> {
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

  const rows: any[] = await prisma.$queryRawUnsafe(queryText, ...params);

  const pagination = buildPaginationResult(rows, limit, (row) => ({
    connectedAt: row.connected_at,
    friendId: row.friend_id,
  }));

  const friendIds = pagination.data.map((r) => r.friend_id);
  const skillsMap = new Map<string, any[]>();

  if (friendIds.length > 0) {
    const skillsRes = await prisma.userSkill.findMany({
      where: { userId: { in: friendIds } },
      include: { skill: true },
    });
    for (const row of skillsRes) {
      if (!skillsMap.has(row.userId)) skillsMap.set(row.userId, []);
      skillsMap.get(row.userId)!.push({
        id: row.skill.id,
        name: row.skill.name,
        category: row.skill.category,
        proficiency: row.proficiency,
      });
    }
  }

  const hydratedData = pagination.data.map((r) => ({
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
    skills: skillsMap.get(r.id) || [],
  }));

  return {
    ...pagination,
    data: hydratedData,
  };
}

export async function listPending(userId: string) {
  const connections = await prisma.connection.findMany({
    where: {
      OR: [{ receiverId: userId }, { requesterId: userId }],
      status: { in: ['pending', 'accepted'] },
    },
    include: {
      requester: {
        include: { college: true },
      },
      receiver: {
        include: { college: true },
      },
    },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
  });

  return connections.map((c) => {
    const isReceiver = c.receiverId === userId;
    const targetUser = isReceiver ? c.requester : c.receiver;
    return {
      id: c.id,
      requesterId: c.requesterId,
      requester_id: c.requesterId,
      receiverId: c.receiverId,
      receiver_id: c.receiverId,
      direction: isReceiver ? 'received' : 'sent',
      status: c.status === 'accepted' ? 'approved' : c.status,
      createdAt: c.createdAt,
      created_at: c.createdAt,
      userId: targetUser.id,
      name: targetUser.name,
      avatarUrl: targetUser.avatarUrl,
      avatar_url: targetUser.avatarUrl,
      bio: targetUser.bio,
      collegeId: targetUser.collegeId,
      collegeName: targetUser.college?.name || null,
      college_name: targetUser.college?.name || null,
      yearOfStudy: targetUser.yearOfStudy,
      year_of_study: targetUser.yearOfStudy,
      branch: targetUser.branch,
    };
  });
}

export async function getMutualConnections(
  userId: string,
  otherUserId: string,
  cursor: string | null,
  limit: number
): Promise<PaginationResult<any>> {
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

  const rows: any[] = await prisma.$queryRawUnsafe(queryText, ...params);

  return buildPaginationResult(rows, limit, (row) => ({
    id: row.id,
  }));
}

export async function getConnectedUserIds(userId: string): Promise<string[]> {
  const edges = await prisma.connectionEdge.findMany({
    where: { userId },
    select: { friendId: true },
  });
  return edges.map((e) => e.friendId);
}

export async function getSecondDegreeCandidates(
  userId: string,
  limit: number = 60,
  offset: number = 0
): Promise<
  Array<{
    candidate_id: string;
    mutual_count: number;
    via_connection_id: string;
    via_connection_name: string;
  }>
> {
  const rows: Array<{
    candidate_id: string;
    mutual_count: number;
    via_connection_id: string;
    via_connection_name: string;
  }> = await prisma.$queryRaw`
    SELECT 
      ce2.friend_id AS candidate_id, 
      count(distinct ce1.friend_id)::int AS mutual_count,
      min(ce1.friend_id::text) AS via_connection_id,
      COALESCE((SELECT name FROM users WHERE id = min(ce1.friend_id::text)::uuid), 'A mutual connection') AS via_connection_name
    FROM connection_edges ce1
    JOIN connection_edges ce2 ON ce1.friend_id = ce2.user_id
    WHERE ce1.user_id = ${userId}::uuid
      AND ce2.friend_id != ${userId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM connection_edges direct 
        WHERE direct.user_id = ${userId}::uuid 
          AND direct.friend_id = ce2.friend_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_blocks ub
        WHERE (ub.blocker_id = ${userId}::uuid AND ub.blocked_id = ce2.friend_id)
           OR (ub.blocker_id = ce2.friend_id AND ub.blocked_id = ${userId}::uuid)
      )
    GROUP BY ce2.friend_id
    ORDER BY mutual_count DESC, ce2.friend_id ASC
    LIMIT ${limit} OFFSET ${offset};
  `;
  return rows;
}
