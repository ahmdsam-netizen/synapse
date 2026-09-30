import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';
import { decodeCursor, buildPaginationResult } from '../../utils/pagination.js';
import { schedulePostingExpiration, cancelPostingExpiration } from '../../jobs/maintenance.js';

async function hydrateBoardPostings(rows: any[], viewerUserId?: string) {
  if (!rows || rows.length === 0) return [];

  const allSkillIds = new Set<string>();
  const allInterestIds = new Set<string>();
  for (const r of rows) {
    (r.required_skill_ids || r.requiredSkillIds || []).forEach((id: string) => allSkillIds.add(id));
    (r.required_interest_ids || r.requiredInterestIds || []).forEach((id: string) => allInterestIds.add(id));
  }

  const skillMap = new Map<string, any>();
  if (allSkillIds.size > 0) {
    const skills = await prisma.skill.findMany({
      where: { id: { in: Array.from(allSkillIds) } },
      select: { id: true, name: true, category: true },
    });
    skills.forEach((s) => skillMap.set(s.id, s));
  }

  const interestMap = new Map<string, any>();
  if (allInterestIds.size > 0) {
    const interests = await prisma.interest.findMany({
      where: { id: { in: Array.from(allInterestIds) } },
      select: { id: true, name: true, category: true },
    });
    interests.forEach((i) => interestMap.set(i.id, i));
  }

  let viewerSkillIds = new Set<string>();
  let viewerInterestIds = new Set<string>();
  let requestedPostingIds = new Set<string>();

  if (viewerUserId) {
    const [viewerSkills, viewerInterests] = await Promise.all([
      prisma.userSkill.findMany({
        where: { userId: viewerUserId },
        select: { skillId: true },
      }),
      prisma.userInterest.findMany({
        where: { userId: viewerUserId },
        select: { interestId: true },
      }),
    ]);
    viewerSkillIds = new Set(viewerSkills.map((s) => s.skillId));
    viewerInterestIds = new Set(viewerInterests.map((i) => i.interestId));

    const pIds = rows.map((r) => r.id);
    const pendingReqs = await prisma.joinRequest.findMany({
      where: {
        userId: viewerUserId,
        postingId: { in: pIds },
        status: 'pending',
      },
      select: { postingId: true },
    });
    requestedPostingIds = new Set(pendingReqs.map((pr) => pr.postingId));
  }

  return rows.map((r: any) => {
    const sIds = r.required_skill_ids || r.requiredSkillIds || [];
    const iIds = r.required_interest_ids || r.requiredInterestIds || [];
    const reqSkills = sIds.map((id: string) => skillMap.get(id)).filter(Boolean);
    const reqInterests = iIds.map((id: string) => interestMap.get(id)).filter(Boolean);
    const matchedSkills = reqSkills.filter((s: any) => viewerSkillIds.has(s.id));
    const matchedInterests = reqInterests.filter((i: any) => viewerInterestIds.has(i.id));

    const creatorId = r.creator_id || r.creatorId || r.group?.creatorId;

    return {
      id: r.id,
      groupId: r.group_id || r.groupId,
      group_id: r.group_id || r.groupId,
      groupName: r.group_name || r.group?.name,
      group_name: r.group_name || r.group?.name,
      creatorId,
      creator_id: creatorId,
      title: r.title,
      description: r.description,
      rolesNeeded: r.roles_needed || r.rolesNeeded || [],
      roles_needed: r.roles_needed || r.rolesNeeded || [],
      requiredSkillIds: sIds,
      required_skill_ids: sIds,
      requiredInterestIds: iIds,
      required_interest_ids: iIds,
      requiredSkills: reqSkills,
      required_skills: reqSkills,
      requiredInterests: reqInterests,
      required_interests: reqInterests,
      matchedSkills,
      matched_skills: matchedSkills,
      matchedInterests,
      matched_interests: matchedInterests,
      slotsTotal: r.slots_total || r.slotsTotal || 1,
      slots_total: r.slots_total || r.slotsTotal || 1,
      slotsFilled: r.slots_filled ?? r.slotsFilled ?? 0,
      slots_filled: r.slots_filled ?? r.slotsFilled ?? 0,
      community: r.community || 'project',
      expiresAt: r.expires_at || r.expiresAt,
      expires_at: r.expires_at || r.expiresAt,
      status: r.status,
      createdAt: r.created_at || r.createdAt,
      created_at: r.created_at || r.createdAt,
      hasRequested: requestedPostingIds.has(r.id),
      collegeName: r.college_name || r.group?.college?.name || null,
      college_name: r.college_name || r.group?.college?.name || null,
      matchPercentage:
        (!viewerUserId || (creatorId !== viewerUserId)) && sIds.length + iIds.length > 0
          ? Math.round(
              ((matchedSkills.length + matchedInterests.length) /
                (sIds.length + iIds.length)) *
                100
            )
          : undefined,
      match_percentage:
        (!viewerUserId || (creatorId !== viewerUserId)) && sIds.length + iIds.length > 0
          ? Math.round(
              ((matchedSkills.length + matchedInterests.length) /
                (sIds.length + iIds.length)) *
                100
            )
          : undefined,
    };
  });
}

export const getGlobalBoard = async (
  cursor: string | undefined,
  limit: number,
  filters: any,
  userId?: string
) => {
  const { skills, interests, collegeId } = filters;
  const params: any[] = [];
  let paramIndex = 1;
  let baseQuery = `
    SELECT bp.*, g.name as group_name, g.college_id as group_college_id, g.creator_id,
           c.name as college_name
    FROM board_postings bp
    JOIN groups g ON g.id = bp.group_id
    LEFT JOIN colleges c ON c.id = g.college_id
    WHERE bp.status = 'open' AND bp.slots_filled < bp.slots_total AND (bp.expires_at IS NULL OR bp.expires_at > NOW())
  `;

  if (filters.q && filters.q.trim()) {
    baseQuery += ` AND (bp.title ILIKE $${paramIndex} OR bp.description ILIKE $${paramIndex} OR g.name ILIKE $${paramIndex})`;
    params.push(`%${filters.q.trim()}%`);
    paramIndex++;
  }

  if (filters.community && filters.community !== 'all') {
    baseQuery += ` AND bp.community = $${paramIndex}`;
    params.push(filters.community);
    paramIndex++;
  }

  if (skills && skills.length > 0) {
    const skillUuids = skills.filter((s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    );
    const skillNames = skills.filter(
      (s: string) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    );
    if (skillUuids.length > 0) {
      baseQuery += ` AND bp.required_skill_ids && $${paramIndex}::uuid[]`;
      params.push(skillUuids);
      paramIndex++;
    }
    if (skillNames.length > 0) {
      baseQuery += ` AND EXISTS (
        SELECT 1 FROM skills s WHERE s.id = ANY(bp.required_skill_ids) AND s.name = ANY($${paramIndex}::text[])
      )`;
      params.push(skillNames);
      paramIndex++;
    }
  }

  if (interests && interests.length > 0) {
    const interestUuids = interests.filter((i: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i)
    );
    const interestNames = interests.filter(
      (i: string) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i)
    );
    if (interestUuids.length > 0) {
      baseQuery += ` AND bp.required_interest_ids && $${paramIndex}::uuid[]`;
      params.push(interestUuids);
      paramIndex++;
    }
    if (interestNames.length > 0) {
      baseQuery += ` AND EXISTS (
        SELECT 1 FROM interests i WHERE i.id = ANY(bp.required_interest_ids) AND i.name = ANY($${paramIndex}::text[])
      )`;
      params.push(interestNames);
      paramIndex++;
    }
  }

  const collegeVal = collegeId || (filters as any).college;
  if (collegeVal && String(collegeVal).trim()) {
    const trimmed = String(collegeVal).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid) {
      baseQuery += ` AND (g.college_id::text = $${paramIndex} OR c.name ILIKE $${paramIndex + 1})`;
      params.push(trimmed, `%${trimmed}%`);
      paramIndex += 2;
    } else {
      baseQuery += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${trimmed}%`);
      paramIndex++;
    }
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.createdAt && decoded.id) {
      baseQuery += ` AND (bp.created_at, bp.id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(decoded.createdAt, decoded.id);
      paramIndex += 2;
    }
  }

  baseQuery += ` ORDER BY bp.created_at DESC, bp.id DESC LIMIT $${paramIndex}`;
  params.push(limit + 1);

  const rows: any[] = await prisma.$queryRawUnsafe(baseQuery, ...params);

  const paginated = buildPaginationResult(rows, limit, (item: any) => ({
    createdAt: item.created_at,
    id: item.id,
  }));
  const hydrated = await hydrateBoardPostings(paginated.data, userId);
  return { ...paginated, data: hydrated };
};

export const getMyPostings = async (
  userId: string,
  cursor: string | undefined,
  limit: number,
  community?: string
) => {
  const params: any[] = [userId];
  let paramIndex = 2;
  let baseQuery = `
    SELECT bp.*, g.name as group_name, g.college_id as group_college_id, g.creator_id as creator_id,
           c.name as college_name,
           (SELECT COUNT(*) FROM join_requests jr WHERE jr.posting_id = bp.id AND jr.status = 'pending') as pending_request_count
    FROM board_postings bp
    JOIN groups g ON g.id = bp.group_id
    LEFT JOIN colleges c ON c.id = g.college_id
    WHERE (g.creator_id = $1 OR EXISTS (
      SELECT 1 FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = $1 AND gm.role = 'admin'
    ))
    AND (bp.expires_at IS NULL OR bp.expires_at > NOW())
  `;

  if (community && community !== 'all') {
    baseQuery += ` AND bp.community = $${paramIndex}`;
    params.push(community);
    paramIndex++;
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.createdAt && decoded.id) {
      baseQuery += ` AND (bp.created_at, bp.id) < ($${paramIndex}, $${paramIndex + 1})`;
      params.push(decoded.createdAt, decoded.id);
      paramIndex += 2;
    }
  }

  baseQuery += ` ORDER BY bp.created_at DESC, bp.id DESC LIMIT $${paramIndex}`;
  params.push(limit + 1);

  const rows: any[] = await prisma.$queryRawUnsafe(baseQuery, ...params);

  const paginated = buildPaginationResult(rows, limit, (item: any) => ({
    createdAt: item.created_at,
    id: item.id,
  }));
  const hydrated = await hydrateBoardPostings(paginated.data, userId);
  const data = hydrated.map((item, idx) => ({
    ...item,
    pendingRequestCount: Number(paginated.data[idx]?.pending_request_count || 0),
    isOwner: true,
    matchPercentage: undefined,
    match_percentage: undefined,
  }));
  return { ...paginated, data };
};

async function resolveSkillIds(items: string[]): Promise<string[]> {
  if (!items || items.length === 0) return [];
  const ids: string[] = [];
  for (const item of items) {
    if (!item) continue;
    const trimmed = typeof item === 'string' ? item.trim() : String(item).trim();
    if (!trimmed) continue;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid) {
      ids.push(trimmed);
    } else {
      const existing = await prisma.skill.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (existing) {
        ids.push(existing.id);
      } else {
        const created = await prisma.skill.create({
          data: { name: trimmed, category: 'Other' },
        });
        ids.push(created.id);
      }
    }
  }
  return Array.from(new Set(ids));
}

async function resolveInterestIds(items: string[]): Promise<string[]> {
  if (!items || items.length === 0) return [];
  const ids: string[] = [];
  for (const item of items) {
    if (!item) continue;
    const trimmed = typeof item === 'string' ? item.trim() : String(item).trim();
    if (!trimmed) continue;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid) {
      ids.push(trimmed);
    } else {
      const existing = await prisma.interest.findFirst({
        where: { name: { equals: trimmed, mode: 'insensitive' } },
      });
      if (existing) {
        ids.push(existing.id);
      } else {
        const created = await prisma.interest.create({
          data: { name: trimmed, category: 'Other' },
        });
        ids.push(created.id);
      }
    }
  }
  return Array.from(new Set(ids));
}

export const createPosting = async (userId: string, data: any) => {
  const group = await prisma.group.findUnique({
    where: { id: data.groupId },
    select: { isCommunity: true },
  });
  if (group && group.isCommunity) {
    throw new BadRequestError('Posters/postings cannot be created for communities.');
  }

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: data.groupId, userId } },
    select: { role: true },
  });
  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Only admins can create postings');
  }

  const expiresInHours = Number(data.expiresInHours) || 72;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const community = ['project', 'hackathon', 'competition'].includes(data.community)
    ? data.community
    : 'project';

  const rawSkills = [
    ...(Array.isArray(data.requiredSkillIds) ? data.requiredSkillIds : []),
    ...(Array.isArray(data.requiredSkills) ? data.requiredSkills : []),
  ];
  const requiredSkillIds = await resolveSkillIds(rawSkills);

  const rawInterests = [
    ...(Array.isArray(data.requiredInterestIds) ? data.requiredInterestIds : []),
    ...(Array.isArray(data.requiredInterests) ? data.requiredInterests : []),
  ];
  const requiredInterestIds = await resolveInterestIds(rawInterests);

  const posting = await prisma.boardPosting.create({
    data: {
      groupId: data.groupId,
      title: data.title,
      description: data.description,
      community,
      rolesNeeded: data.rolesNeeded || [],
      requiredSkillIds,
      requiredInterestIds,
      slotsTotal: 1,
      expiresAt,
    },
  });

  await schedulePostingExpiration(posting.id, expiresAt);

  return posting;
};

export const updatePosting = async (postingId: string, userId: string, data: any) => {
  const posting = await prisma.boardPosting.findUnique({
    where: { id: postingId },
    select: { groupId: true },
  });
  if (!posting) throw new NotFoundError('Posting not found');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: posting.groupId, userId } },
    select: { role: true },
  });
  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Only admins can update postings');
  }

  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.community !== undefined) updateData.community = data.community;
  if (data.rolesNeeded !== undefined || data.roles_needed !== undefined) {
    updateData.rolesNeeded = data.rolesNeeded || data.roles_needed;
  }
  if (data.slotsTotal !== undefined || data.slots_total !== undefined) {
    updateData.slotsTotal = Number(data.slotsTotal ?? data.slots_total);
  }
  if (data.expiresInHours !== undefined) {
    updateData.expiresAt = new Date(Date.now() + Number(data.expiresInHours) * 60 * 60 * 1000);
  }

  const updated = await prisma.boardPosting.update({
    where: { id: postingId },
    data: updateData,
  });

  if (updateData.expiresAt) {
    await schedulePostingExpiration(postingId, updateData.expiresAt);
  }

  return updated;
};

export const closePosting = async (postingId: string, userId: string) => {
  const posting = await prisma.boardPosting.findUnique({
    where: { id: postingId },
    select: { groupId: true },
  });
  if (!posting) throw new NotFoundError('Posting not found');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: posting.groupId, userId } },
    select: { role: true },
  });
  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Only admins can close postings');
  }

  await prisma.boardPosting.update({
    where: { id: postingId },
    data: { status: 'closed' },
  });

  cancelPostingExpiration(postingId).catch(() => {});

  return { success: true };
};

export const deletePosting = async (postingId: string, userId: string) => {
  const posting = await prisma.boardPosting.findUnique({
    where: { id: postingId },
    include: { group: { select: { creatorId: true } } },
  });
  if (!posting) throw new NotFoundError('Posting not found');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: posting.groupId, userId } },
    select: { role: true },
  });

  const isAdmin = membership && membership.role === 'admin';
  const isCreator = posting.group.creatorId === userId;

  if (!isAdmin && !isCreator) {
    throw new ForbiddenError('Only group admins can delete this posting');
  }

  await prisma.boardPosting.delete({
    where: { id: postingId },
  });

  cancelPostingExpiration(postingId).catch(() => {});

  return { success: true, message: 'Posting deleted successfully' };
};

export const getPosting = async (postingId: string) => {
  const posting = await prisma.boardPosting.findFirst({
    where: {
      id: postingId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { group: { select: { name: true } } },
  });

  if (!posting) throw new NotFoundError('Posting not found');
  return {
    ...posting,
    group_name: posting.group.name,
  };
};

export const submitJoinRequest = async (
  userId: string,
  postingId: string,
  message: string = ''
) => {
  const posting = await prisma.boardPosting.findUnique({
    where: { id: postingId },
    select: { groupId: true, status: true, expiresAt: true },
  });

  if (!posting) throw new NotFoundError('Posting not found');
  if (posting.status !== 'open') throw new BadRequestError('Posting is not open');
  if (posting.expiresAt && posting.expiresAt <= new Date()) {
    throw new BadRequestError('This posting has expired');
  }

  const groupId = posting.groupId;

  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (isMember) throw new BadRequestError('You are already a member of this group');

  const existingRequest = await prisma.joinRequest.findUnique({
    where: { postingId_userId: { postingId, userId } },
  });
  if (existingRequest && existingRequest.status === 'pending') {
    throw new BadRequestError('You already have a pending request for this posting');
  }

  return prisma.joinRequest.create({
    data: {
      groupId,
      postingId,
      userId,
      message,
    },
  });
};

export const getGroupRequests = async (groupId: string, userId: string, status: string) => {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true },
  });
  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Only admins can view requests');
  }

  const requests = await prisma.joinRequest.findMany({
    where: { groupId, status },
    include: {
      user: { select: { name: true, avatarUrl: true } },
      posting: { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map((jr) => ({
    id: jr.id,
    posting_id: jr.postingId,
    group_id: jr.groupId,
    user_id: jr.userId,
    message: jr.message,
    status: jr.status,
    reviewed_by: jr.reviewedBy,
    created_at: jr.createdAt,
    reviewed_at: jr.reviewedAt,
    name: jr.user.name,
    avatar_url: jr.user.avatarUrl,
    posting_title: jr.posting.title,
  }));
};

export const approveRequest = async (requestId: string, adminId: string) => {
  return prisma.$transaction(async (tx) => {
    const request = await tx.joinRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundError('Request not found');
    if (request.status !== 'pending') throw new BadRequestError('Request is not pending');

    const membership = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId: request.groupId, userId: adminId } },
      select: { role: true },
    });
    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenError('Only admins can approve requests');
    }

    await tx.joinRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    await tx.groupMember.upsert({
      where: { groupId_userId: { groupId: request.groupId, userId: request.userId } },
      update: {},
      create: {
        groupId: request.groupId,
        userId: request.userId,
        role: 'member',
      },
    });

    if (request.postingId) {
      await tx.boardPosting.update({
        where: { id: request.postingId },
        data: {
          status: 'closed',
          slotsFilled: { increment: 1 },
        },
      });
    }

    return { success: true };
  });
};

export const rejectRequest = async (requestId: string, adminId: string) => {
  const request = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    select: { groupId: true, status: true },
  });
  if (!request) throw new NotFoundError('Request not found');
  if (request.status !== 'pending') throw new BadRequestError('Request is not pending');

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: request.groupId, userId: adminId } },
    select: { role: true },
  });
  if (!membership || membership.role !== 'admin') {
    throw new ForbiddenError('Only admins can reject requests');
  }

  await prisma.joinRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: new Date(),
    },
  });

  return { success: true };
};

export const getMyRequests = async (userId: string) => {
  const requests = await prisma.joinRequest.findMany({
    where: { userId },
    include: {
      posting: { select: { title: true } },
      group: { select: { name: true } },
    },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
  });

  return requests.map((jr) => ({
    id: jr.id,
    posting_id: jr.postingId,
    group_id: jr.groupId,
    user_id: jr.userId,
    message: jr.message,
    status: jr.status,
    reviewed_by: jr.reviewedBy,
    created_at: jr.createdAt,
    reviewed_at: jr.reviewedAt,
    posting_title: jr.posting?.title || null,
    group_name: jr.group.name,
  }));
};

export const getAllBoardsForEmbedding = async () => {
  const rows: any[] = await prisma.$queryRaw`
    SELECT bp.id, bp.group_id, g.creator_id, bp.title, bp.description, bp.roles_needed,
           bp.slots_total, bp.slots_filled, bp.expires_at, bp.required_skill_ids, bp.required_interest_ids,
           g.name as group_name
    FROM board_postings bp
    LEFT JOIN groups g ON bp.group_id = g.id
    WHERE (bp.expires_at IS NULL OR bp.expires_at > NOW())
      AND bp.slots_filled < bp.slots_total
  `;
  return hydrateBoardPostings(rows);
};

export const getBoardForEmbedding = async (postingId: string) => {
  const rows: any[] = await prisma.$queryRaw`
    SELECT bp.id, bp.group_id, g.creator_id, bp.title, bp.description, bp.roles_needed,
           bp.slots_total, bp.slots_filled, bp.expires_at, bp.required_skill_ids, bp.required_interest_ids,
           g.name as group_name
    FROM board_postings bp
    LEFT JOIN groups g ON bp.group_id = g.id
    WHERE bp.id = ${postingId}::uuid
  `;
  const hydrated = await hydrateBoardPostings(rows);
  return hydrated[0] || null;
};
