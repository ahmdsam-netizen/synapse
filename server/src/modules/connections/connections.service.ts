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
  let decodedCursor: { connectedAt: string; friendId: string } | null = null;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.connectedAt && decoded.friendId) {
      decodedCursor = {
        connectedAt: decoded.connectedAt,
        friendId: decoded.friendId,
      };
    }
  }

  const edges = await prisma.connectionEdge.findMany({
    where: {
      userId,
      ...(decodedCursor
        ? {
            OR: [
              {
                connectedAt: {
                  lt: new Date(decodedCursor.connectedAt),
                },
              },
              {
                connectedAt: new Date(decodedCursor.connectedAt),
                friendId: {
                  lt: decodedCursor.friendId,
                },
              },
            ],
          }
        : {}),
    },
    include: {
      friend: {
        include: {
          college: true,
          skills: {
            include: { skill: true },
          },
        },
      },
    },
    orderBy: [
      { connectedAt: 'desc' },
      { friendId: 'desc' },
    ],
    take: limit + 1,
  });

  const pagination = buildPaginationResult(edges, limit, (edge) => ({
    connectedAt: edge.connectedAt.toISOString(),
    friendId: edge.friendId,
  }));

  const friendIds = pagination.data.map((e) => e.friendId);
  const connections = friendIds.length > 0
    ? await prisma.connection.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requesterId: userId, receiverId: { in: friendIds } },
            { receiverId: userId, requesterId: { in: friendIds } },
          ],
        },
        select: {
          id: true,
          requesterId: true,
          receiverId: true,
        },
      })
    : [];

  const connMap = new Map<string, string>();
  for (const c of connections) {
    const otherId = c.requesterId === userId ? c.receiverId : c.requesterId;
    connMap.set(otherId, c.id);
  }

  const hydratedData = pagination.data.map((edge) => {
    const u = edge.friend;
    const connectionId = connMap.get(edge.friendId) || '';
    return {
      id: u.id,
      friendId: edge.friendId,
      connectionId,
      connection_id: connectionId,
      name: u.name,
      avatarUrl: u.avatarUrl,
      avatar_url: u.avatarUrl,
      bio: u.bio,
      collegeId: u.collegeId,
      collegeName: u.college?.name || null,
      college_name: u.college?.name || null,
      yearOfStudy: u.yearOfStudy,
      year_of_study: u.yearOfStudy,
      branch: u.branch,
      lookingFor: u.lookingFor,
      connectedAt: edge.connectedAt,
      connected_at: edge.connectedAt,
      skills: (u.skills || []).map((s) => ({
        id: s.skill.id,
        name: s.skill.name,
        category: s.skill.category,
        proficiency: s.proficiency,
      })),
    };
  });

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
  // Fetch other user's friend IDs
  const otherFriendEdges = await prisma.connectionEdge.findMany({
    where: { userId: otherUserId },
    select: { friendId: true },
  });
  const otherFriendIds = otherFriendEdges.map((e) => e.friendId);

  let decodedId: string | null = null;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.id) decodedId = decoded.id;
  }

  const mutualEdges = otherFriendIds.length > 0
    ? await prisma.connectionEdge.findMany({
        where: {
          userId,
          friendId: { in: otherFriendIds },
          ...(decodedId ? { friendId: { gt: decodedId } } : {}),
        },
        include: {
          friend: {
            include: {
              college: true,
            },
          },
        },
        orderBy: {
          friendId: 'asc',
        },
        take: limit + 1,
      })
    : [];

  const pagination = buildPaginationResult(mutualEdges, limit, (edge) => ({
    id: edge.friendId,
  }));

  const data = pagination.data.map((edge) => ({
    id: edge.friend.id,
    name: edge.friend.name,
    avatarUrl: edge.friend.avatarUrl,
    collegeId: edge.friend.collegeId,
    collegeName: edge.friend.college?.name || null,
  }));

  return {
    ...pagination,
    data,
  };
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
  // 1. Fetch user's direct connections
  const directEdges = await prisma.connectionEdge.findMany({
    where: { userId },
    select: { friendId: true },
  });
  const directFriendIds = directEdges.map((e) => e.friendId);
  if (directFriendIds.length === 0) {
    return [];
  }

  const directFriendSet = new Set(directFriendIds);
  directFriendSet.add(userId);

  // 2. Fetch blocked users to exclude
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedUserIds = new Set(
    blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId))
  );

  // 3. Fetch 2nd degree edges (friends of direct friends)
  const secondDegreeEdges = await prisma.connectionEdge.findMany({
    where: {
      userId: { in: directFriendIds },
      friendId: { notIn: Array.from(directFriendSet) },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // 4. Aggregate mutual friends by candidate in memory
  const candidateMap = new Map<
    string,
    {
      mutualFriends: Set<string>;
      minViaId: string;
      viaName: string;
    }
  >();

  for (const edge of secondDegreeEdges) {
    const candidateId = edge.friendId;
    if (blockedUserIds.has(candidateId)) {
      continue;
    }

    const mutualFriendId = edge.userId;
    const mutualFriendName = edge.user?.name || 'A mutual connection';

    let entry = candidateMap.get(candidateId);
    if (!entry) {
      entry = {
        mutualFriends: new Set(),
        minViaId: mutualFriendId,
        viaName: mutualFriendName,
      };
      candidateMap.set(candidateId, entry);
    }

    entry.mutualFriends.add(mutualFriendId);
    if (mutualFriendId < entry.minViaId) {
      entry.minViaId = mutualFriendId;
      entry.viaName = mutualFriendName;
    }
  }

  const candidates = Array.from(candidateMap.entries())
    .map(([candidate_id, data]) => ({
      candidate_id,
      mutual_count: data.mutualFriends.size,
      via_connection_id: data.minViaId,
      via_connection_name: data.viaName,
    }))
    .sort((a, b) => {
      if (b.mutual_count !== a.mutual_count) {
        return b.mutual_count - a.mutual_count;
      }
      return a.candidate_id.localeCompare(b.candidate_id);
    });

  return candidates.slice(offset, offset + limit);
}
