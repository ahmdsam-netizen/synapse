import { prisma } from '../../config/prisma.js';
import { decodeCursor, encodeCursor, PaginationResult } from '../../utils/pagination.js';

interface SearchFilters {
  q?: string;
  skills?: string[];
  interests?: string[];
  matchMode?: 'any' | 'all';
  collegeId?: string;
  college?: string;
  year?: number;
  lookingFor?: string;
  cursor?: string;
  limit?: number;
}

export const searchUsers = async (
  userId: string,
  _collegeId: string | null,
  filters: SearchFilters
): Promise<PaginationResult<any>> => {
  const {
    q = '',
    skills = [],
    interests = [],
    matchMode = 'any',
    collegeId: filterCollegeId,
    year,
    lookingFor,
    cursor,
    limit = 30,
  } = filters;

  const hasSkills = Array.isArray(skills) && skills.length > 0;
  const hasInterests = Array.isArray(interests) && interests.length > 0;

  // Build Prisma where conditions
  const where: any = {
    id: { not: userId },
    outgoingEdges: { none: { friendId: userId } },
    blockedUsers: { none: { blockedId: userId } },
    blockedBy: { none: { blockerId: userId } },
  };

  // Text query filter
  if (q && q.trim()) {
    const queryStr = q.trim();
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { name: { contains: queryStr, mode: 'insensitive' } },
          { bio: { contains: queryStr, mode: 'insensitive' } },
          { branch: { contains: queryStr, mode: 'insensitive' } },
          { college: { name: { contains: queryStr, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  // Skills filter
  if (hasSkills) {
    const skillFilters = skills.map((s: string) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
      return isUuid
        ? { skillId: s }
        : { skill: { name: { equals: s, mode: 'insensitive' } } };
    });

    if (matchMode === 'all') {
      where.AND = [
        ...(where.AND || []),
        ...skillFilters.map((sf) => ({ skills: { some: sf } })),
      ];
    } else {
      where.AND = [
        ...(where.AND || []),
        { skills: { some: { OR: skillFilters } } },
      ];
    }
  }

  // Interests filter
  if (hasInterests) {
    const interestFilters = interests.map((i: string) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i);
      return isUuid
        ? { interestId: i }
        : { interest: { name: { equals: i, mode: 'insensitive' } } };
    });

    if (matchMode === 'all') {
      where.AND = [
        ...(where.AND || []),
        ...interestFilters.map((inf) => ({ interests: { some: inf } })),
      ];
    } else {
      where.AND = [
        ...(where.AND || []),
        { interests: { some: { OR: interestFilters } } },
      ];
    }
  }

  // College filter
  const collegeFilter = filterCollegeId || (filters as any).college;
  if (collegeFilter && String(collegeFilter).trim()) {
    const trimmed = String(collegeFilter).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          ...(isUuid ? [{ collegeId: trimmed }] : []),
          { college: { name: { contains: trimmed, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  // Year filter
  if (year && Number(year) > 0) {
    where.yearOfStudy = Number(year);
  }

  // Looking for filter
  if (lookingFor && lookingFor.trim() && lookingFor !== 'any') {
    where.lookingFor = lookingFor.trim();
  }

  // Cursor decoding
  let decodedCursor: { lastActive?: string; id?: string } | null = null;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded && decoded.id) {
      decodedCursor = decoded;
    }
  }

  if (decodedCursor?.id) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          ...(decodedCursor.lastActive
            ? [
                { lastActive: { lt: new Date(decodedCursor.lastActive) } },
                { lastActive: new Date(decodedCursor.lastActive), id: { gt: decodedCursor.id } },
              ]
            : [{ id: { gt: decodedCursor.id } }]),
        ],
      },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    include: {
      college: true,
      skills: {
        include: { skill: true },
      },
      interests: {
        include: { interest: true },
      },
    },
    orderBy: [
      { lastActive: 'desc' },
      { id: 'asc' },
    ],
    take: limit + 1,
  });

  const targetSkillNamesLower = new Set(skills.map((s: string) => s.toLowerCase()));
  const targetInterestNamesLower = new Set(interests.map((i: string) => i.toLowerCase()));

  const enriched = users.map((u) => {
    const userSkills = u.skills.map((us) => ({ id: us.skill.id, name: us.skill.name }));
    const userInterests = u.interests.map((ui) => ({ id: ui.interest.id, name: ui.interest.name }));

    const matchedSkills = userSkills.filter(
      (s) => targetSkillNamesLower.has(s.id.toLowerCase()) || targetSkillNamesLower.has(s.name.toLowerCase())
    );
    const matchedInterests = userInterests.filter(
      (i) => targetInterestNamesLower.has(i.id.toLowerCase()) || targetInterestNamesLower.has(i.name.toLowerCase())
    );

    const skill_match_count = matchedSkills.length;
    const interest_match_count = matchedInterests.length;

    return {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      avatar_url: u.avatarUrl,
      bio: u.bio,
      collegeId: u.collegeId,
      college_id: u.collegeId,
      collegeName: u.college?.name || null,
      college_name: u.college?.name || null,
      yearOfStudy: u.yearOfStudy,
      year_of_study: u.yearOfStudy,
      branch: u.branch,
      lookingFor: u.lookingFor,
      looking_for: u.lookingFor,
      profileCompleteness: u.profileCompleteness,
      profile_completeness: u.profileCompleteness,
      lastActive: u.lastActive,
      last_active: u.lastActive,
      skill_match_count,
      interest_match_count,
      skills: userSkills,
      interests: userInterests,
      matchedSkills,
      matchedInterests,
      matched_skills: matchedSkills,
      matched_interests: matchedInterests,
    };
  });

  // Sort by matches first if skills or interests were requested
  if (hasSkills || hasInterests) {
    enriched.sort((a, b) => {
      const aScore = a.skill_match_count + a.interest_match_count;
      const bScore = b.skill_match_count + b.interest_match_count;
      if (bScore !== aScore) return bScore - aScore;
      const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    });
  }

  const hasMore = enriched.length > limit;
  const items = hasMore ? enriched.slice(0, limit) : enriched;
  const lastItem = items[items.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor({
          tagCount: lastItem.skill_match_count + lastItem.interest_match_count,
          lastActive: lastItem.lastActive,
          id: lastItem.id,
        })
      : null;

  return {
    data: items,
    nextCursor,
    hasMore,
  };
};
