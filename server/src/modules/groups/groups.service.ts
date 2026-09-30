import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../../utils/errors.js';
import { scheduleGroupExpiration, cancelGroupExpiration } from '../../jobs/maintenance.js';

export const createGroup = async (userId: string, collegeId: string | null, data: any) => {
  const groupCollegeId = data.visibility === 'college' ? collegeId : null;
  const durationDays = [1, 7, 15, 30].includes(Number(data.durationDays)) ? Number(data.durationDays) : 7;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name: data.name,
        description: data.description,
        creatorId: userId,
        collegeId: groupCollegeId,
        visibility: data.visibility || 'global',
        maxMembers: data.maxMembers ? Math.min(Number(data.maxMembers), 8) : 8,
        expiresAt,
      },
    });

    await tx.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'admin',
      },
    });

    return {
      ...group,
      expiresAt: group.expiresAt,
      expires_at: group.expiresAt,
    };
  });

  await scheduleGroupExpiration(result.id, expiresAt);

  return result;
};

export const getMyGroups = async (userId: string) => {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      group: {
        isCommunity: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    },
    include: {
      group: {
        include: {
          _count: {
            select: {
              members: true,
              joinRequests: {
                where: { status: 'pending' },
              },
            },
          },
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
    college_id: m.group.collegeId,
    visibility: m.group.visibility,
    max_members: m.group.maxMembers,
    status: m.group.status,
    is_community: m.group.isCommunity,
    created_at: m.group.createdAt,
    expiresAt: m.group.expiresAt,
    expires_at: m.group.expiresAt,
    role: m.role,
    member_count: m.group._count.members,
    pending_request_count: m.role === 'admin' ? m.group._count.joinRequests : 0,
  }));
};

export const getGroupDetail = async (groupId: string, viewerId: string) => {
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      postings: {
        where: {
          status: 'open',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!group) throw new NotFoundError('Group not found or has expired');

  const viewerMember = group.members.find((m) => m.userId === viewerId);

  const members = group.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    avatarUrl: m.user.avatarUrl,
    avatar_url: m.user.avatarUrl,
    role: m.role,
    joinedAt: m.joinedAt,
    joined_at: m.joinedAt,
  }));

  const activePostings = group.postings.filter(
    (p) => (p.slotsFilled ?? 0) < p.slotsTotal
  );

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    creator_id: group.creatorId,
    college_id: group.collegeId,
    visibility: group.visibility,
    max_members: group.maxMembers,
    status: group.status,
    is_community: group.isCommunity,
    created_at: group.createdAt,
    expiresAt: group.expiresAt,
    expires_at: group.expiresAt,
    viewerRole: viewerMember ? viewerMember.role : null,
    members,
    postings: activePostings.map((p) => ({
      id: p.id,
      group_id: p.groupId,
      board_type: p.boardType,
      title: p.title,
      description: p.description,
      roles_needed: p.rolesNeeded,
      required_skill_ids: p.requiredSkillIds,
      required_interest_ids: p.requiredInterestIds,
      slots_total: p.slotsTotal,
      slots_filled: p.slotsFilled,
      community: p.community,
      status: p.status,
      created_at: p.createdAt,
      expires_at: p.expiresAt,
    })),
  };
};

export const updateGroup = async (groupId: string, userId: string, data: any) => {
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId },
    },
  });

  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Only admins can update group');
  }

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.visibility !== undefined) updateData.visibility = data.visibility;
  if (data.maxMembers !== undefined || data.max_members !== undefined) {
    updateData.maxMembers = Number(data.maxMembers ?? data.max_members);
  }
  if (data.status !== undefined) updateData.status = data.status;

  if (Object.keys(updateData).length === 0) return { id: groupId };

  return prisma.group.update({
    where: { id: groupId },
    data: updateData,
  });
};

export const removeMember = async (groupId: string, targetUserId: string, actingUserId: string) => {
  if (targetUserId !== actingUserId) {
    const actingMember = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: actingUserId } },
    });
    if (!actingMember || actingMember.role !== 'admin') {
      throw new ForbiddenError('Only admins can remove members');
    }
  }

  const adminCount = await prisma.groupMember.count({
    where: { groupId, role: 'admin' },
  });

  const targetMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });

  if (targetMember && targetMember.role === 'admin' && adminCount <= 1) {
    throw new BadRequestError('Cannot remove the last admin');
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });

  return { success: true };
};

export const promoteMember = async (groupId: string, targetUserId: string, actingUserId: string) => {
  const actingMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: actingUserId } },
  });
  if (!actingMember || actingMember.role !== 'admin') {
    throw new ForbiddenError('Only admins can promote members');
  }

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    data: { role: 'admin' },
  });

  return { success: true };
};

export const inviteUser = async (
  groupId: string,
  inviterId: string,
  inviteeId: string,
  note?: string
) => {
  if (inviterId === inviteeId) {
    throw new BadRequestError('You cannot invite yourself to a group');
  }

  // 1. Verify caller is an admin
  const inviterMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: inviterId } },
  });
  if (!inviterMember || inviterMember.role !== 'admin') {
    throw new ForbiddenError('Only group admins can send invitations');
  }

  // 2. Check if group exists and is open
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      _count: { select: { members: true } },
    },
  });
  if (!group) throw new NotFoundError('Group not found');
  if (group.status === 'closed') {
    throw new BadRequestError('Group is closed for new members');
  }

  // 3. Check group member count vs maxMembers
  if (group._count.members >= (group.maxMembers ?? 10)) {
    throw new BadRequestError('Group has reached maximum member capacity');
  }

  // 4. Check if invitee exists and whether open to invites
  const invitee = await prisma.user.findUnique({
    where: { id: inviteeId },
    select: { id: true, name: true, openToInvites: true },
  });
  if (!invitee) throw new NotFoundError('User not found');
  if (!invitee.openToInvites) {
    throw new ForbiddenError(`${invitee.name} is not currently accepting group invitations`);
  }

  // 5. Check if already a member
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: inviteeId } },
  });
  if (isMember) {
    throw new ConflictError('User is already a member of this group');
  }

  // 6. Check if pending invite already exists
  const existingInvite = await prisma.groupInvite.findFirst({
    where: { groupId, inviteeId, status: 'pending' },
  });
  if (existingInvite) {
    throw new ConflictError('An invitation is already pending for this user');
  }

  // 7. Insert invite
  return prisma.groupInvite.create({
    data: {
      groupId,
      inviterId,
      inviteeId,
      note: note?.trim() || null,
      status: 'pending',
    },
  });
};

export const getMyInvites = async (userId: string) => {
  const invites = await prisma.groupInvite.findMany({
    where: { inviteeId: userId },
    include: {
      group: {
        include: { college: true },
      },
      inviter: true,
    },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
  });

  return invites.map((gi) => ({
    id: gi.id,
    groupId: gi.groupId,
    groupName: gi.group.name,
    groupDescription: gi.group.description,
    groupStatus: gi.group.status,
    inviterId: gi.inviterId,
    inviterName: gi.inviter.name,
    inviterAvatarUrl: gi.inviter.avatarUrl,
    collegeName: gi.group.college?.name || null,
    note: gi.note,
    status: gi.status,
    createdAt: gi.createdAt,
    updatedAt: gi.updatedAt,
  }));
};

export const acceptInvite = async (inviteId: string, userId: string) => {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.groupInvite.findFirst({
      where: { id: inviteId, inviteeId: userId, status: 'pending' },
    });
    if (!invite) {
      throw new NotFoundError('Invitation not found or already processed');
    }

    const group = await tx.group.findUnique({
      where: { id: invite.groupId },
      include: { _count: { select: { members: true } } },
    });
    if (!group) throw new NotFoundError('Group not found');
    if (group.status === 'closed') {
      throw new BadRequestError('Group is closed for new members');
    }
    if (group._count.members >= (group.maxMembers ?? 10)) {
      throw new BadRequestError('Group has reached maximum member capacity');
    }

    await tx.groupMember.upsert({
      where: { groupId_userId: { groupId: invite.groupId, userId } },
      update: {},
      create: {
        groupId: invite.groupId,
        userId,
        role: 'member',
      },
    });

    return tx.groupInvite.update({
      where: { id: inviteId },
      data: {
        status: 'accepted',
        updatedAt: new Date(),
      },
    });
  });
};

export const declineInvite = async (inviteId: string, userId: string) => {
  const invite = await prisma.groupInvite.findFirst({
    where: { id: inviteId, inviteeId: userId, status: 'pending' },
  });
  if (!invite) {
    throw new NotFoundError('Invitation not found or already processed');
  }

  return prisma.groupInvite.update({
    where: { id: inviteId },
    data: {
      status: 'declined',
      updatedAt: new Date(),
    },
  });
};

export const deleteGroup = async (groupId: string, userId: string) => {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });
  if (!group) throw new NotFoundError('Group not found');

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });

  const isCreator = group.creatorId === userId;
  const isAdmin = member?.role === 'admin';

  if (!isAdmin && !isCreator) {
    throw new ForbiddenError('Only group admins or the group creator can delete this group');
  }

  await prisma.group.delete({
    where: { id: groupId },
  });

  cancelGroupExpiration(groupId).catch(() => {});

  return { success: true };
};
