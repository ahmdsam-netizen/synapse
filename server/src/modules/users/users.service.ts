import { prisma } from '../../config/prisma.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { computeCompleteness } from '../../utils/profileCompleteness.js';

async function recomputeCompleteness(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      bio: true,
      avatarUrl: true,
      yearOfStudy: true,
      branch: true,
      lookingFor: true,
    },
  });
  if (!user) return;

  const [skillCount, interestCount, workItemCount] = await Promise.all([
    prisma.userSkill.count({ where: { userId } }),
    prisma.userInterest.count({ where: { userId } }),
    prisma.workItem.count({ where: { userId } }),
  ]);

  const completeness = computeCompleteness({
    name: user.name,
    bio: user.bio,
    avatar_url: user.avatarUrl,
    year_of_study: user.yearOfStudy,
    branch: user.branch,
    looking_for: user.lookingFor,
    skillCount,
    interestCount,
    workItemCount,
  });

  await prisma.user.update({
    where: { id: userId },
    data: { profileCompleteness: completeness },
  });
}

export async function getProfile(viewerId: string | null, targetId: string) {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    include: {
      college: true,
      skills: {
        include: { skill: true },
      },
      interests: {
        include: { interest: true },
      },
      workItems: true,
    },
  });

  if (!user) throw new NotFoundError('User not found');

  let connectionStatus = 'none';
  let connectionId: string | null = null;
  let mutualConnections = 0;

  if (viewerId && viewerId !== targetId) {
    const conn = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: viewerId, receiverId: targetId },
          { requesterId: targetId, receiverId: viewerId },
        ],
      },
    });

    if (conn) {
      connectionId = conn.id;
      if (conn.status === 'accepted') connectionStatus = 'connected';
      else if (conn.requesterId === viewerId) connectionStatus = 'pending_sent';
      else connectionStatus = 'pending_received';
    }

    // Mutual friends count on symmetric connection_edges
    const viewerEdges = await prisma.connectionEdge.findMany({
      where: { userId: viewerId },
      select: { friendId: true },
    });
    const viewerFriendIds = viewerEdges.map((e) => e.friendId);
    if (viewerFriendIds.length > 0) {
      mutualConnections = await prisma.connectionEdge.count({
        where: {
          userId: targetId,
          friendId: { in: viewerFriendIds },
        },
      });
    } else {
      mutualConnections = 0;
    }
  }

  const flattenedSkills = user.skills.map((us) => ({
    id: us.skill.id,
    name: us.skill.name,
    category: us.skill.category,
    proficiency: us.proficiency,
  }));

  const flattenedInterests = user.interests.map((ui) => ({
    id: ui.interest.id,
    name: ui.interest.name,
    category: ui.interest.category,
  }));

  const formattedWorkItems = user.workItems.map((wi) => ({
    id: wi.id,
    title: wi.title,
    description: wi.description,
    tech_used: wi.techUsed,
    techUsed: wi.techUsed,
    repo_url: wi.repoUrl,
    repoUrl: wi.repoUrl,
    live_url: wi.liveUrl,
    liveUrl: wi.liveUrl,
    media_url: wi.mediaUrl,
    mediaUrl: wi.mediaUrl,
  }));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    avatar_url: user.avatarUrl,
    yearOfStudy: user.yearOfStudy,
    year_of_study: user.yearOfStudy,
    branch: user.branch,
    lookingFor: user.lookingFor,
    looking_for: user.lookingFor,
    profileCompleteness: user.profileCompleteness,
    profile_completeness: user.profileCompleteness,
    openToInvites: user.openToInvites ?? true,
    open_to_invites: user.openToInvites ?? true,
    collegeId: user.collegeId,
    college_id: user.collegeId,
    collegeName: user.college?.name || null,
    college_name: user.college?.name || null,
    city: user.college?.city || null,
    college: user.college
      ? { id: user.college.id, name: user.college.name, city: user.college.city }
      : null,
    skills: flattenedSkills,
    interests: flattenedInterests,
    workItems: formattedWorkItems,
    connectionStatus,
    connectionId,
    connection_id: connectionId,
    mutualConnections,
  };
}

export async function getMe(userId: string) {
  return getProfile(userId, userId);
}

export async function updateProfile(userId: string, data: any) {
  let collegeId = data.collegeId || data.college_id;

  if (!collegeId && (data.collegeName || data.college_name)) {
    const college = await addCollege(data.collegeName || data.college_name, data.city);
    collegeId = college.id;
  }

  const updateData: Record<string, any> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.avatarUrl !== undefined || data.avatar_url !== undefined) {
    updateData.avatarUrl = data.avatarUrl || data.avatar_url;
  }
  if (data.yearOfStudy !== undefined || data.year_of_study !== undefined) {
    updateData.yearOfStudy = data.yearOfStudy ?? data.year_of_study;
  }
  if (data.branch !== undefined) updateData.branch = data.branch;
  if (data.lookingFor !== undefined || data.looking_for !== undefined) {
    updateData.lookingFor = data.lookingFor || data.looking_for;
  }
  if (data.openToInvites !== undefined || data.open_to_invites !== undefined) {
    updateData.openToInvites = Boolean(data.openToInvites ?? data.open_to_invites);
  }
  if (collegeId !== undefined) {
    updateData.collegeId = collegeId;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    await recomputeCompleteness(userId);
  }

  return getMe(userId);
}

export async function addSkill(
  userId: string,
  payload: { skillId?: string; name?: string; proficiency: string }
) {
  let finalSkillId = payload.skillId;

  if (!finalSkillId && payload.name) {
    const trimmed = payload.name.trim();
    const existing = await prisma.skill.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      finalSkillId = existing.id;
    } else {
      const created = await prisma.skill.create({
        data: { name: trimmed, category: 'Other' },
      });
      finalSkillId = created.id;
    }
  }

  if (!finalSkillId) {
    throw new BadRequestError('Skill ID or valid skill name is required');
  }

  const skill = await prisma.skill.findUnique({
    where: { id: finalSkillId },
  });
  if (!skill) throw new NotFoundError('Skill not found');

  await prisma.userSkill.upsert({
    where: {
      userId_skillId: {
        userId,
        skillId: finalSkillId,
      },
    },
    update: { proficiency: payload.proficiency },
    create: {
      userId,
      skillId: finalSkillId,
      proficiency: payload.proficiency,
    },
  });

  await recomputeCompleteness(userId);

  return {
    id: finalSkillId,
    skill_id: finalSkillId,
    name: skill.name,
    category: skill.category,
    proficiency: payload.proficiency,
  };
}

export async function removeSkill(userId: string, skillId: string) {
  try {
    await prisma.userSkill.delete({
      where: {
        userId_skillId: { userId, skillId },
      },
    });
  } catch {
    throw new NotFoundError('Skill not found in user profile');
  }

  await recomputeCompleteness(userId);
}

export async function addInterest(
  userId: string,
  payload: { interestId?: string; name?: string }
) {
  let finalInterestId = payload.interestId;

  if (!finalInterestId && payload.name) {
    const trimmed = payload.name.trim();
    const existing = await prisma.interest.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
    });
    if (existing) {
      finalInterestId = existing.id;
    } else {
      const created = await prisma.interest.create({
        data: { name: trimmed, category: 'Other' },
      });
      finalInterestId = created.id;
    }
  }

  if (!finalInterestId) {
    throw new BadRequestError('Interest ID or valid interest name is required');
  }

  const interest = await prisma.interest.findUnique({
    where: { id: finalInterestId },
  });
  if (!interest) throw new NotFoundError('Interest not found');

  await prisma.userInterest.upsert({
    where: {
      userId_interestId: {
        userId,
        interestId: finalInterestId,
      },
    },
    update: {},
    create: {
      userId,
      interestId: finalInterestId,
    },
  });

  await recomputeCompleteness(userId);

  return {
    id: finalInterestId,
    interest_id: finalInterestId,
    name: interest.name,
    category: interest.category,
  };
}

export async function removeInterest(userId: string, interestId: string) {
  try {
    await prisma.userInterest.delete({
      where: {
        userId_interestId: { userId, interestId },
      },
    });
  } catch {
    throw new NotFoundError('Interest not found in user profile');
  }

  await recomputeCompleteness(userId);
}

export async function createWorkItem(userId: string, data: any) {
  const workItem = await prisma.workItem.create({
    data: {
      userId,
      title: data.title,
      description: data.description || null,
      techUsed: data.techUsed || data.tech_used || [],
      repoUrl: data.repoUrl || data.repo_url || null,
      liveUrl: data.liveUrl || data.live_url || null,
      mediaUrl: data.mediaUrl || data.media_url || null,
    },
  });

  await recomputeCompleteness(userId);

  return {
    ...workItem,
    tech_used: workItem.techUsed,
    repo_url: workItem.repoUrl,
    live_url: workItem.liveUrl,
    media_url: workItem.mediaUrl,
  };
}

export async function updateWorkItem(userId: string, workItemId: string, data: any) {
  const existing = await prisma.workItem.findFirst({
    where: { id: workItemId, userId },
  });
  if (!existing) throw new NotFoundError('Work item not found');

  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.techUsed !== undefined || data.tech_used !== undefined) {
    updateData.techUsed = data.techUsed || data.tech_used;
  }
  if (data.repoUrl !== undefined || data.repo_url !== undefined) {
    updateData.repoUrl = data.repoUrl || data.repo_url;
  }
  if (data.liveUrl !== undefined || data.live_url !== undefined) {
    updateData.liveUrl = data.liveUrl || data.live_url;
  }
  if (data.mediaUrl !== undefined || data.media_url !== undefined) {
    updateData.mediaUrl = data.mediaUrl || data.media_url;
  }

  const updated = await prisma.workItem.update({
    where: { id: workItemId },
    data: updateData,
  });

  return {
    ...updated,
    tech_used: updated.techUsed,
    repo_url: updated.repoUrl,
    live_url: updated.liveUrl,
    media_url: updated.mediaUrl,
  };
}

export async function deleteWorkItem(userId: string, workItemId: string) {
  const existing = await prisma.workItem.findFirst({
    where: { id: workItemId, userId },
  });
  if (!existing) throw new NotFoundError('Work item not found');

  await prisma.workItem.delete({
    where: { id: workItemId },
  });

  await recomputeCompleteness(userId);
}

export async function searchSkills(q: string) {
  if (!q || !q.trim()) {
    return prisma.skill.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }
  const term = q.trim();
  return prisma.skill.findMany({
    where: {
      name: { contains: term, mode: 'insensitive' },
    },
    orderBy: { name: 'asc' },
    take: 50,
  });
}

export async function searchInterests(q: string) {
  if (!q || !q.trim()) {
    return prisma.interest.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }
  const term = q.trim();
  return prisma.interest.findMany({
    where: {
      name: { contains: term, mode: 'insensitive' },
    },
    orderBy: { name: 'asc' },
    take: 50,
  });
}

export async function searchColleges(q?: string) {
  if (!q || !q.trim()) {
    return prisma.college.findMany({
      select: { id: true, name: true, city: true, emailDomain: true },
      orderBy: { name: 'asc' },
      take: 100,
    });
  }
  const term = q.trim();
  return prisma.college.findMany({
    where: {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, city: true, emailDomain: true },
    orderBy: { name: 'asc' },
    take: 50,
  });
}

export async function addCollege(name: string, city?: string) {
  const cName = name.trim();
  const existing = await prisma.college.findFirst({
    where: { name: { equals: cName, mode: 'insensitive' } },
  });

  if (existing) {
    if (city && city.trim() && !existing.city) {
      return prisma.college.update({
        where: { id: existing.id },
        data: { city: city.trim() },
      });
    }
    return existing;
  }

  const cleanBase = cName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'college';
  const domain = `${cleanBase}-${Math.floor(1000 + Math.random() * 9000)}.edu`;

  return prisma.college.create({
    data: {
      name: cName,
      emailDomain: domain,
      city: city || 'India',
    },
  });
}

export async function getAllUsersForEmbedding() {
  const users = await prisma.user.findMany({
    include: {
      college: true,
      skills: { include: { skill: true } },
      interests: { include: { interest: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    avatar_url: u.avatarUrl,
    bio: u.bio,
    year_of_study: u.yearOfStudy,
    branch: u.branch,
    looking_for: u.lookingFor,
    college_name: u.college?.name || null,
    skills: u.skills.map((s) => s.skill.name),
    interests: u.interests.map((i) => i.interest.name),
  }));
}

export async function getUserForEmbedding(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      college: true,
      skills: { include: { skill: true } },
      interests: { include: { interest: true } },
    },
  });
  if (!u) return null;

  return {
    id: u.id,
    name: u.name,
    avatar_url: u.avatarUrl,
    bio: u.bio,
    year_of_study: u.yearOfStudy,
    branch: u.branch,
    looking_for: u.lookingFor,
    college_name: u.college?.name || null,
    skills: u.skills.map((s) => s.skill.name),
    interests: u.interests.map((i) => i.interest.name),
  };
}
