import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { buildPaginationResult, decodeCursor } from '../../utils/pagination.js';

export const createDrop = async (userId: string, content: string) => {
  const drop = await prisma.drop.create({
    data: {
      userId,
      content: content.trim(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          branch: true,
          college: {
            select: { name: true },
          },
        },
      },
    },
  });

  return {
    id: drop.id,
    userId: drop.userId,
    content: drop.content,
    createdAt: drop.createdAt,
    upVotes: 0,
    downVotes: 0,
    userVote: null as 'up' | 'down' | null,
    user: {
      id: drop.user.id,
      name: drop.user.name,
      avatarUrl: drop.user.avatarUrl,
      branch: drop.user.branch,
      collegeName: drop.user.college?.name || null,
    },
  };
};

export const getDrops = async (userId: string, cursor?: string, limit: number = 20) => {
  const where: any = {};

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.createdAt && decoded.id) {
      where.OR = [
        { createdAt: { lt: new Date(decoded.createdAt) } },
        {
          createdAt: new Date(decoded.createdAt),
          id: { lt: decoded.id },
        },
      ];
    }
  }

  const rawDrops = await prisma.drop.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          branch: true,
          college: {
            select: { name: true },
          },
        },
      },
      votes: {
        select: {
          userId: true,
          voteType: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
    take: limit + 1,
  });

  const paginated = buildPaginationResult(rawDrops, limit, (item) => ({
    createdAt: item.createdAt?.toISOString() || '',
    id: item.id,
  }));

  const data = paginated.data.map((d) => {
    let upVotes = 0;
    let downVotes = 0;
    let userVote: 'up' | 'down' | null = null;

    for (const v of d.votes) {
      if (v.voteType === 'up') upVotes++;
      else if (v.voteType === 'down') downVotes++;

      if (v.userId === userId) {
        userVote = v.voteType as 'up' | 'down';
      }
    }

    return {
      id: d.id,
      userId: d.userId,
      content: d.content,
      createdAt: d.createdAt,
      upVotes,
      downVotes,
      userVote,
      user: {
        id: d.user.id,
        name: d.user.name,
        avatarUrl: d.user.avatarUrl,
        branch: d.user.branch,
        collegeName: d.user.college?.name || null,
      },
    };
  });

  return {
    data,
    nextCursor: paginated.nextCursor,
    hasMore: paginated.hasMore,
  };
};

export const voteDrop = async (userId: string, dropId: string, voteType: 'up' | 'down') => {
  return prisma.$transaction(async (tx) => {
    const drop = await tx.drop.findUnique({
      where: { id: dropId },
      select: { id: true },
    });

    if (!drop) throw new NotFoundError('Drop not found');

    const existingVote = await tx.dropVote.findUnique({
      where: {
        dropId_userId: { dropId, userId },
      },
    });

    let finalUserVote: 'up' | 'down' | null = null;

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Toggle off / remove vote
        await tx.dropVote.delete({
          where: { id: existingVote.id },
        });
        finalUserVote = null;
      } else {
        // Change vote type
        await tx.dropVote.update({
          where: { id: existingVote.id },
          data: { voteType },
        });
        finalUserVote = voteType;
      }
    } else {
      // New vote
      await tx.dropVote.create({
        data: {
          dropId,
          userId,
          voteType,
        },
      });
      finalUserVote = voteType;
    }

    const votes = await tx.dropVote.findMany({
      where: { dropId },
      select: { voteType: true },
    });

    let upVotes = 0;
    let downVotes = 0;
    for (const v of votes) {
      if (v.voteType === 'up') upVotes++;
      else if (v.voteType === 'down') downVotes++;
    }

    return {
      dropId,
      userVote: finalUserVote,
      upVotes,
      downVotes,
    };
  });
};

export const deleteDrop = async (userId: string, dropId: string) => {
  const drop = await prisma.drop.findUnique({
    where: { id: dropId },
    select: { userId: true },
  });

  if (!drop) throw new NotFoundError('Drop not found');
  if (drop.userId !== userId) {
    throw new ForbiddenError('Only the author can delete this drop');
  }

  await prisma.drop.delete({
    where: { id: dropId },
  });

  return { success: true, message: 'Drop deleted successfully' };
};
