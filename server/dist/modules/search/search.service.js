import { query } from '../../config/database.js';
import { decodeCursor, encodeCursor } from '../../utils/pagination.js';
export const searchUsers = async (userId, _collegeId, filters) => {
    const { q = '', skills = [], interests = [], matchMode = 'any', collegeId: filterCollegeId, year, lookingFor, cursor, limit = 30 } = filters;
    const params = [userId];
    let paramIndex = 2;
    const hasSkills = Array.isArray(skills) && skills.length > 0;
    const hasInterests = Array.isArray(interests) && interests.length > 0;
    let skillMatchesSelect = '0 as skill_match_count';
    let skillLateralJoin = '';
    if (hasSkills) {
        skillMatchesSelect = 'COALESCE(skill_matches.cnt, 0) as skill_match_count';
        skillLateralJoin = `
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM user_skills us
        JOIN skills s ON s.id = us.skill_id
        WHERE us.user_id = u.id AND (us.skill_id::text = ANY($${paramIndex}::text[]) OR s.name = ANY($${paramIndex}::text[]))
      ) skill_matches ON true
    `;
        params.push(skills);
        paramIndex++;
    }
    let interestMatchesSelect = '0 as interest_match_count';
    let interestLateralJoin = '';
    if (hasInterests) {
        interestMatchesSelect = 'COALESCE(interest_matches.cnt, 0) as interest_match_count';
        interestLateralJoin = `
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as cnt FROM user_interests ui
        JOIN interests i ON i.id = ui.interest_id
        WHERE ui.user_id = u.id AND (ui.interest_id::text = ANY($${paramIndex}::text[]) OR i.name = ANY($${paramIndex}::text[]))
      ) interest_matches ON true
    `;
        params.push(interests);
        paramIndex++;
    }
    let baseQuery = `
    WITH matched_users AS (
      SELECT u.id, u.name, u.avatar_url, u.bio, u.college_id, u.year_of_study, u.branch,
             u.looking_for, u.profile_completeness, u.last_active,
             c.name as college_name,
             ${skillMatchesSelect},
             ${interestMatchesSelect}
      FROM users u
      LEFT JOIN colleges c ON c.id = u.college_id
      ${skillLateralJoin}
      ${interestLateralJoin}
      WHERE u.id <> $1
        AND NOT EXISTS (SELECT 1 FROM connection_edges WHERE user_id = $1 AND friend_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = u.id AND blocked_id = $1)
    )
    SELECT * FROM matched_users WHERE true
  `;
    if (q && q.trim()) {
        baseQuery += ` AND (name ILIKE $${paramIndex} OR bio ILIKE $${paramIndex} OR branch ILIKE $${paramIndex} OR college_name ILIKE $${paramIndex})`;
        params.push(`%${q.trim()}%`);
        paramIndex++;
    }
    if (hasSkills) {
        if (matchMode === 'all') {
            baseQuery += ` AND skill_match_count >= ${skills.length}`;
        }
        else {
            baseQuery += ` AND skill_match_count > 0`;
        }
    }
    if (hasInterests) {
        if (matchMode === 'all') {
            baseQuery += ` AND interest_match_count >= ${interests.length}`;
        }
        else {
            baseQuery += ` AND interest_match_count > 0`;
        }
    }
    const collegeFilter = filterCollegeId || filters.college;
    if (collegeFilter && collegeFilter.trim()) {
        const trimmed = collegeFilter.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
        if (isUuid) {
            baseQuery += ` AND (college_id::text = $${paramIndex} OR college_name ILIKE $${paramIndex + 1})`;
            params.push(trimmed, `%${trimmed}%`);
            paramIndex += 2;
        }
        else {
            baseQuery += ` AND college_name ILIKE $${paramIndex}`;
            params.push(`%${trimmed}%`);
            paramIndex++;
        }
    }
    if (year && Number(year) > 0) {
        baseQuery += ` AND year_of_study = $${paramIndex}`;
        params.push(Number(year));
        paramIndex++;
    }
    if (lookingFor && lookingFor.trim() && lookingFor !== 'any') {
        baseQuery += ` AND looking_for = $${paramIndex}`;
        params.push(lookingFor.trim());
        paramIndex++;
    }
    if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded && decoded.tagCount !== undefined && decoded.lastActive && decoded.id) {
            baseQuery += ` AND ((skill_match_count + interest_match_count) < $${paramIndex} OR ((skill_match_count + interest_match_count) = $${paramIndex} AND (last_active < $${paramIndex + 1} OR (last_active = $${paramIndex + 1} AND id > $${paramIndex + 2}))))`;
            params.push(decoded.tagCount, decoded.lastActive, decoded.id);
            paramIndex += 3;
        }
    }
    baseQuery += ` ORDER BY (skill_match_count + interest_match_count) DESC, last_active DESC NULLS LAST, id ASC LIMIT $${paramIndex}`;
    params.push(limit + 1);
    const { rows } = await query(baseQuery, params);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    if (items.length === 0) {
        return { data: [], nextCursor: null, hasMore: false };
    }
    const userIds = items.map(u => u.id);
    const skillsPromise = query(`
    SELECT us.user_id, s.id, s.name 
    FROM user_skills us
    JOIN skills s ON s.id = us.skill_id
    WHERE us.user_id = ANY($1)
  `, [userIds]);
    const interestsPromise = query(`
    SELECT ui.user_id, i.id, i.name 
    FROM user_interests ui
    JOIN interests i ON i.id = ui.interest_id
    WHERE ui.user_id = ANY($1)
  `, [userIds]);
    const [skillsRes, interestsRes] = await Promise.all([skillsPromise, interestsPromise]);
    const userSkillsMap = new Map();
    const userInterestsMap = new Map();
    for (const row of skillsRes.rows) {
        if (!userSkillsMap.has(row.user_id))
            userSkillsMap.set(row.user_id, []);
        userSkillsMap.get(row.user_id).push({ id: row.id, name: row.name });
    }
    for (const row of interestsRes.rows) {
        if (!userInterestsMap.has(row.user_id))
            userInterestsMap.set(row.user_id, []);
        userInterestsMap.get(row.user_id).push({ id: row.id, name: row.name });
    }
    const enrichedItems = items.map(item => ({
        ...item,
        avatarUrl: item.avatar_url,
        collegeName: item.college_name,
        yearOfStudy: item.year_of_study,
        lookingFor: item.looking_for,
        profileCompleteness: item.profile_completeness,
        lastActive: item.last_active,
        skills: userSkillsMap.get(item.id) || [],
        interests: userInterestsMap.get(item.id) || [],
        matchedSkills: userSkillsMap.get(item.id) || [],
        matchedInterests: userInterestsMap.get(item.id) || [],
        matched_skills: userSkillsMap.get(item.id) || [],
        matched_interests: userInterestsMap.get(item.id) || []
    }));
    const lastItem = enrichedItems[enrichedItems.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor({
        tagCount: Number(lastItem.skill_match_count) + Number(lastItem.interest_match_count),
        lastActive: lastItem.last_active,
        id: lastItem.id
    }) : null;
    return {
        data: enrichedItems,
        nextCursor,
        hasMore
    };
};
//# sourceMappingURL=search.service.js.map