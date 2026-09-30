import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';

export const createCommunity = async (
  userId: string,
  data: { name: string; description?: string | null }
) => {
  return prisma.$transaction(async (tx) => {
    const community = await tx.group.create({
      data: {
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        creatorId: userId,
        collegeId: null,
        visibility: 'global',
        maxMembers: 1000,
        expiresAt: null,
        isCommunity: true,
      },
    });

    await tx.groupMember.create({
      data: {
        groupId: community.id,
        userId,
        role: 'admin',
      },
    });

    return {
      ...community,
      isCommunity: true,
      is_community: true,
      memberCount: 1,
      member_count: 1,
      isMember: true,
      userRole: 'admin',
    };
  });
};

export const getCommunities = async (userId: string, search?: string) => {
  const where: any = { isCommunity: true };

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } },
    ];
  }

  const communities = await prisma.group.findMany({
    where,
    include: {
      members: {
        select: { userId: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return communities
    .map((g) => {
      const memberCount = g.members.length;
      const userMembership = g.members.find((m) => m.userId === userId);
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        creator_id: g.creatorId,
        visibility: g.visibility,
        max_members: g.maxMembers,
        status: g.status,
        created_at: g.createdAt,
        isCommunity: true,
        is_community: true,
        memberCount,
        member_count: memberCount,
        isMember: Boolean(userMembership),
        userRole: userMembership?.role || null,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount);
};

export const getMyCommunities = async (userId: string) => {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      group: { isCommunity: true },
    },
    include: {
      group: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  return memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    description: m.group.description,
    creator_id: m.group.creatorId,
    visibility: m.group.visibility,
    max_members: m.group.maxMembers,
    status: m.group.status,
    created_at: m.group.createdAt,
    isCommunity: true,
    is_community: true,
    memberCount: m.group._count.members,
    member_count: m.group._count.members,
    isMember: true,
    userRole: m.role,
  }));
};

export const getCommunityDetail = async (communityId: string, viewerId: string) => {
  const community = await prisma.group.findFirst({
    where: { id: communityId, isCommunity: true },
    include: {
      members: {
        include: {
          user: {
            include: { college: true },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      },
    },
  });

  if (!community) throw new NotFoundError('Community not found');

  const viewerMember = community.members.find((m) => m.userId === viewerId);

  return {
    id: community.id,
    name: community.name,
    description: community.description,
    creator_id: community.creatorId,
    college_id: community.collegeId,
    visibility: 'global',
    maxMembers: 1000,
    max_members: 1000,
    status: community.status,
    created_at: community.createdAt,
    expiresAt: null,
    expires_at: null,
    isCommunity: true,
    is_community: true,
    viewerId,
    viewerRole: viewerMember ? viewerMember.role : null,
    isMember: Boolean(viewerMember),
    memberCount: community.members.length,
    member_count: community.members.length,
    members: community.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      avatar_url: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
      joined_at: m.joinedAt,
      collegeName: m.user.college?.name || null,
      college_name: m.user.college?.name || null,
      branch: m.user.branch,
      yearOfStudy: m.user.yearOfStudy,
    })),
  };
};

export const joinCommunity = async (communityId: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const community = await tx.group.findFirst({
      where: { id: communityId, isCommunity: true },
      include: { _count: { select: { members: true } } },
    });

    if (!community) throw new NotFoundError('Community not found');
    if (community.status === 'closed') {
      throw new BadRequestError('This community is closed');
    }
    if (community._count.members >= 1000) {
      throw new BadRequestError('Community has reached the maximum capacity of 1,000 members');
    }

    await tx.groupMember.upsert({
      where: { groupId_userId: { groupId: communityId, userId } },
      update: {},
      create: {
        groupId: communityId,
        userId,
        role: 'member',
      },
    });

    return { success: true, message: 'Joined community successfully' };
  });
};

export const leaveCommunity = async (communityId: string, userId: string) => {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: communityId, userId } },
  });
  if (!member) throw new NotFoundError('Not a member of this community');

  if (member.role === 'admin') {
    const adminCount = await prisma.groupMember.count({
      where: { groupId: communityId, role: 'admin' },
    });
    const totalCount = await prisma.groupMember.count({
      where: { groupId: communityId },
    });

    if (adminCount === 1 && totalCount > 1) {
      throw new BadRequestError('Please promote another member to admin before leaving');
    }
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId: communityId, userId } },
  });

  return { success: true, message: 'Left community successfully' };
};

export const deleteCommunity = async (communityId: string, userId: string) => {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: communityId, userId } },
    select: { role: true },
  });

  if (!member || member.role !== 'admin') {
    throw new ForbiddenError('Only admins can delete this community');
  }

  await prisma.group.delete({
    where: { id: communityId },
  });

  return { success: true, message: 'Community deleted successfully' };
};
