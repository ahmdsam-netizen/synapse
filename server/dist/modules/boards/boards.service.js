import { query, getClient } from '../../config/database.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';
import { decodeCursor, buildPaginationResult } from '../../utils/pagination.js';
async function hydrateBoardPostings(rows, viewerUserId) {
    if (!rows || rows.length === 0)
        return [];
    const allSkillIds = new Set();
    const allInterestIds = new Set();
    for (const r of rows) {
        (r.required_skill_ids || []).forEach((id) => allSkillIds.add(id));
        (r.required_interest_ids || []).forEach((id) => allInterestIds.add(id));
    }
    const skillMap = new Map();
    if (allSkillIds.size > 0) {
        const sRes = await query(`SELECT id, name, category FROM skills WHERE id = ANY($1)`, [Array.from(allSkillIds)]);
        sRes.rows.forEach((s) => skillMap.set(s.id, s));
    }
    const interestMap = new Map();
    if (allInterestIds.size > 0) {
        const iRes = await query(`SELECT id, name, category FROM interests WHERE id = ANY($1)`, [Array.from(allInterestIds)]);
        iRes.rows.forEach((i) => interestMap.set(i.id, i));
    }
    let viewerSkillIds = new Set();
    let viewerInterestIds = new Set();
    let requestedPostingIds = new Set();
    if (viewerUserId) {
        const vsRes = await query(`SELECT skill_id FROM user_skills WHERE user_id = $1`, [viewerUserId]);
        viewerSkillIds = new Set(vsRes.rows.map((r) => r.skill_id));
        const viRes = await query(`SELECT interest_id FROM user_interests WHERE user_id = $1`, [viewerUserId]);
        viewerInterestIds = new Set(viRes.rows.map((r) => r.interest_id));
        const pIds = rows.map((r) => r.id);
        const reqRes = await query(`SELECT posting_id FROM join_requests WHERE user_id = $1 AND posting_id = ANY($2) AND status = 'pending'`, [viewerUserId, pIds]);
        requestedPostingIds = new Set(reqRes.rows.map((r) => r.posting_id));
    }
    return rows.map((r) => {
        const reqSkills = (r.required_skill_ids || []).map((id) => skillMap.get(id)).filter(Boolean);
        const reqInterests = (r.required_interest_ids || []).map((id) => interestMap.get(id)).filter(Boolean);
        const matchedSkills = reqSkills.filter((s) => viewerSkillIds.has(s.id));
        const matchedInterests = reqInterests.filter((i) => viewerInterestIds.has(i.id));
        return {
            id: r.id,
            groupId: r.group_id,
            group_id: r.group_id,
            groupName: r.group_name,
            group_name: r.group_name,
            creatorId: r.creator_id,
            creator_id: r.creator_id,
            title: r.title,
            description: r.description,
            rolesNeeded: r.roles_needed || [],
            roles_needed: r.roles_needed || [],
            requiredSkillIds: r.required_skill_ids || [],
            required_skill_ids: r.required_skill_ids || [],
            requiredInterestIds: r.required_interest_ids || [],
            required_interest_ids: r.required_interest_ids || [],
            requiredSkills: reqSkills,
            required_skills: reqSkills,
            requiredInterests: reqInterests,
            required_interests: reqInterests,
            matchedSkills,
            matched_skills: matchedSkills,
            matchedInterests,
            matched_interests: matchedInterests,
            slotsTotal: r.slots_total,
            slots_total: r.slots_total,
            slotsFilled: r.slots_filled,
            slots_filled: r.slots_filled,
            expiresAt: r.expires_at,
            expires_at: r.expires_at,
            status: r.status,
            createdAt: r.created_at,
            created_at: r.created_at,
            hasRequested: requestedPostingIds.has(r.id),
            collegeName: r.college_name,
            college_name: r.college_name,
            matchPercentage: (!viewerUserId || (r.creator_id !== viewerUserId && r.group_creator_id !== viewerUserId && r.creatorId !== viewerUserId)) && ((r.required_skill_ids || []).length + (r.required_interest_ids || []).length > 0)
                ? Math.round(((matchedSkills.length + matchedInterests.length) / ((r.required_skill_ids || []).length + (r.required_interest_ids || []).length)) * 100)
                : undefined,
            match_percentage: (!viewerUserId || (r.creator_id !== viewerUserId && r.group_creator_id !== viewerUserId && r.creatorId !== viewerUserId)) && ((r.required_skill_ids || []).length + (r.required_interest_ids || []).length > 0)
                ? Math.round(((matchedSkills.length + matchedInterests.length) / ((r.required_skill_ids || []).length + (r.required_interest_ids || []).length)) * 100)
                : undefined
        };
    });
}
export const cleanExpiredPostings = async () => {
    try {
        await query(`DELETE FROM board_postings WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
    }
    catch (err) {
        console.error('Error cleaning up expired postings:', err);
    }
};
export const getGlobalBoard = async (cursor, limit, filters, userId) => {
    await cleanExpiredPostings();
    const { skills, interests, collegeId } = filters;
    const params = [];
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
    if (skills && skills.length > 0) {
        const skillUuids = skills.filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
        const skillNames = skills.filter((s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));
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
        const interestUuids = interests.filter((i) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i));
        const interestNames = interests.filter((i) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i));
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
    const collegeVal = collegeId || filters.college;
    if (collegeVal && String(collegeVal).trim()) {
        const trimmed = String(collegeVal).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
        if (isUuid) {
            baseQuery += ` AND (g.college_id::text = $${paramIndex} OR c.name ILIKE $${paramIndex + 1})`;
            params.push(trimmed, `%${trimmed}%`);
            paramIndex += 2;
        }
        else {
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
    const { rows } = await query(baseQuery, params);
    const paginated = buildPaginationResult(rows, limit, (item) => ({ createdAt: item.created_at, id: item.id }));
    const hydrated = await hydrateBoardPostings(paginated.data, userId);
    return { ...paginated, data: hydrated };
};
export const getMatchedBoard = async (userId, collegeId, cursor, limit) => {
    await cleanExpiredPostings();
    const params = [userId, collegeId];
    let paramIndex = 3;
    let baseQuery = `
    SELECT bp.*, g.name as group_name, g.college_id,
           c.name as college_name,
           COALESCE(skill_overlap.cnt, 0) as matched_skill_count,
           COALESCE(interest_overlap.cnt, 0) as matched_interest_count,
           CASE WHEN g.college_id = $2 THEN 1 ELSE 0 END as same_college
    FROM board_postings bp
    JOIN groups g ON g.id = bp.group_id
    LEFT JOIN colleges c ON c.id = g.college_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as cnt FROM user_skills us
      WHERE us.user_id = $1 AND us.skill_id = ANY(bp.required_skill_ids)
    ) skill_overlap ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) as cnt FROM user_interests ui  
      WHERE ui.user_id = $1 AND ui.interest_id = ANY(bp.required_interest_ids)
    ) interest_overlap ON true
    WHERE bp.status = 'open' AND bp.slots_filled < bp.slots_total
      AND (bp.expires_at IS NULL OR bp.expires_at > NOW())
      AND (COALESCE(skill_overlap.cnt, 0) + COALESCE(interest_overlap.cnt, 0)) > 0
      AND NOT EXISTS (SELECT 1 FROM group_members WHERE group_id = bp.group_id AND user_id = $1)
  `;
    if (cursor) {
        const decoded = decodeCursor(cursor);
        if (decoded) {
            baseQuery += ` AND ((COALESCE(skill_overlap.cnt, 0) + COALESCE(interest_overlap.cnt, 0)) < $${paramIndex} 
                       OR ((COALESCE(skill_overlap.cnt, 0) + COALESCE(interest_overlap.cnt, 0)) = $${paramIndex} AND same_college < $${paramIndex + 1})
                       OR ((COALESCE(skill_overlap.cnt, 0) + COALESCE(interest_overlap.cnt, 0)) = $${paramIndex} AND same_college = $${paramIndex + 1} AND bp.created_at < $${paramIndex + 2}))`;
            params.push(decoded.score, decoded.sameCollege, decoded.createdAt);
            paramIndex += 3;
        }
    }
    baseQuery += ` ORDER BY (COALESCE(skill_overlap.cnt, 0) + COALESCE(interest_overlap.cnt, 0)) DESC, same_college DESC, bp.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit + 1);
    const { rows } = await query(baseQuery, params);
    const paginated = buildPaginationResult(rows, limit, (item) => ({
        score: Number(item.matched_skill_count) + Number(item.matched_interest_count),
        sameCollege: item.same_college,
        createdAt: item.created_at
    }));
    const hydrated = await hydrateBoardPostings(paginated.data, userId);
    return { ...paginated, data: hydrated };
};
export const getMyPostings = async (userId, cursor, limit) => {
    await cleanExpiredPostings();
    const params = [userId];
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
    const { rows } = await query(baseQuery, params);
    const paginated = buildPaginationResult(rows, limit, (item) => ({ createdAt: item.created_at, id: item.id }));
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
export const createPosting = async (userId, data) => {
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [data.groupId, userId]);
    if (!roleRows.length || roleRows[0].role !== 'admin') {
        throw new ForbiddenError('Only admins can create postings');
    }
    const expiresInHours = Number(data.expiresInHours) || 72; // default 72 hours (3 days)
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const { rows } = await query(`INSERT INTO board_postings (group_id, title, description, roles_needed, required_skill_ids, required_interest_ids, slots_total, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [data.groupId, data.title, data.description, data.rolesNeeded, data.requiredSkillIds, data.requiredInterestIds, data.slotsTotal, expiresAt]);
    return rows[0];
};
export const updatePosting = async (postingId, userId, data) => {
    const { rows: postingRows } = await query(`SELECT group_id FROM board_postings WHERE id = $1`, [postingId]);
    if (!postingRows.length)
        throw new NotFoundError('Posting not found');
    const groupId = postingRows[0].group_id;
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
    if (!roleRows.length || roleRows[0].role !== 'admin')
        throw new ForbiddenError('Only admins can update postings');
    const updates = [];
    const params = [];
    let paramIndex = 1;
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            if (key === 'expiresInHours') {
                const expiresInHours = Number(value);
                const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
                updates.push(`"expires_at" = $${paramIndex}`);
                params.push(expiresAt);
                paramIndex++;
            }
            else {
                updates.push(`"${key.replace(/([A-Z])/g, "_$1").toLowerCase()}" = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        }
    }
    if (updates.length === 0)
        return { id: postingId };
    params.push(postingId);
    const { rows } = await query(`UPDATE board_postings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, params);
    return rows[0];
};
export const closePosting = async (postingId, userId) => {
    const { rows: postingRows } = await query(`SELECT group_id FROM board_postings WHERE id = $1`, [postingId]);
    if (!postingRows.length)
        throw new NotFoundError('Posting not found');
    const groupId = postingRows[0].group_id;
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
    if (!roleRows.length || roleRows[0].role !== 'admin')
        throw new ForbiddenError('Only admins can close postings');
    await query(`UPDATE board_postings SET status = 'closed' WHERE id = $1`, [postingId]);
    return { success: true };
};
export const deletePosting = async (postingId, userId) => {
    const { rows: postingRows } = await query(`SELECT bp.group_id, g.creator_id 
     FROM board_postings bp 
     JOIN groups g ON g.id = bp.group_id 
     WHERE bp.id = $1`, [postingId]);
    if (!postingRows.length)
        throw new NotFoundError('Posting not found');
    const { group_id: groupId, creator_id: creatorId } = postingRows[0];
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
    const isAdmin = roleRows.length && roleRows[0].role === 'admin';
    const isCreator = creatorId === userId;
    if (!isAdmin && !isCreator) {
        throw new ForbiddenError('Only group admins can delete this posting');
    }
    await query(`DELETE FROM board_postings WHERE id = $1`, [postingId]);
    return { success: true, message: 'Posting deleted successfully' };
};
export const getPosting = async (postingId) => {
    await cleanExpiredPostings();
    const { rows } = await query(`SELECT bp.*, g.name as group_name 
     FROM board_postings bp 
     JOIN groups g ON g.id = bp.group_id 
     WHERE bp.id = $1 AND (bp.expires_at IS NULL OR bp.expires_at > NOW())`, [postingId]);
    if (!rows.length)
        throw new NotFoundError('Posting not found');
    return rows[0];
};
export const submitJoinRequest = async (userId, postingId, message = '') => {
    await cleanExpiredPostings();
    const { rows: postingRows } = await query(`SELECT group_id, status, expires_at FROM board_postings WHERE id = $1`, [postingId]);
    if (!postingRows.length)
        throw new NotFoundError('Posting not found');
    if (postingRows[0].status !== 'open')
        throw new BadRequestError('Posting is not open');
    if (postingRows[0].expires_at && new Date(postingRows[0].expires_at) <= new Date()) {
        throw new BadRequestError('This posting has expired');
    }
    const groupId = postingRows[0].group_id;
    const { rows: memberRows } = await query(`SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
    if (memberRows.length)
        throw new BadRequestError('You are already a member of this group');
    const { rows: existingRequest } = await query(`SELECT 1 FROM join_requests WHERE posting_id = $1 AND user_id = $2 AND status = 'pending'`, [postingId, userId]);
    if (existingRequest.length)
        throw new BadRequestError('You already have a pending request for this posting');
    const { rows } = await query(`INSERT INTO join_requests (group_id, posting_id, user_id, message) VALUES ($1, $2, $3, $4) RETURNING *`, [groupId, postingId, userId, message]);
    return rows[0];
};
export const getGroupRequests = async (groupId, userId, status) => {
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
    if (!roleRows.length || roleRows[0].role !== 'admin')
        throw new ForbiddenError('Only admins can view requests');
    const { rows } = await query(`SELECT jr.*, u.name, u.avatar_url, bp.title as posting_title
     FROM join_requests jr
     JOIN users u ON u.id = jr.user_id
     JOIN board_postings bp ON bp.id = jr.posting_id
     WHERE jr.group_id = $1 AND jr.status = $2
     ORDER BY jr.created_at DESC`, [groupId, status]);
    return rows;
};
export const approveRequest = async (requestId, adminId) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const { rows: reqRows } = await client.query(`SELECT * FROM join_requests WHERE id = $1 FOR UPDATE`, [requestId]);
        if (!reqRows.length)
            throw new NotFoundError('Request not found');
        const request = reqRows[0];
        if (request.status !== 'pending')
            throw new BadRequestError('Request is not pending');
        const { rows: roleRows } = await client.query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [request.group_id, adminId]);
        if (!roleRows.length || roleRows[0].role !== 'admin')
            throw new ForbiddenError('Only admins can approve requests');
        await client.query(`UPDATE join_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`, [adminId, requestId]);
        await client.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [request.group_id, request.user_id]);
        const { rows: bpRows } = await client.query(`UPDATE board_postings SET slots_filled = slots_filled + 1 WHERE id = $1 RETURNING slots_filled, slots_total`, [request.posting_id]);
        if (bpRows.length && bpRows[0].slots_filled >= bpRows[0].slots_total) {
            // Auto-delete posting and remove from board when all slots are filled
            await client.query(`DELETE FROM board_postings WHERE id = $1`, [request.posting_id]);
        }
        await client.query('COMMIT');
        return { success: true };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};
export const rejectRequest = async (requestId, adminId) => {
    const { rows: reqRows } = await query(`SELECT * FROM join_requests WHERE id = $1`, [requestId]);
    if (!reqRows.length)
        throw new NotFoundError('Request not found');
    const request = reqRows[0];
    if (request.status !== 'pending')
        throw new BadRequestError('Request is not pending');
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [request.group_id, adminId]);
    if (!roleRows.length || roleRows[0].role !== 'admin')
        throw new ForbiddenError('Only admins can reject requests');
    await query(`UPDATE join_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`, [adminId, requestId]);
    return { success: true };
};
export const getMyRequests = async (userId) => {
    const { rows } = await query(`SELECT jr.*, bp.title as posting_title, g.name as group_name
     FROM join_requests jr
     JOIN board_postings bp ON bp.id = jr.posting_id
     JOIN groups g ON g.id = jr.group_id
     WHERE jr.user_id = $1
     ORDER BY jr.created_at DESC`, [userId]);
    return rows;
};
export const getAllBoardsForEmbedding = async () => {
    const { rows } = await query(`
    SELECT bp.id, bp.group_id, g.creator_id, bp.title, bp.description, bp.roles_needed,
           bp.slots_total, bp.slots_filled, bp.expires_at, bp.required_skill_ids, bp.required_interest_ids,
           g.name as group_name
    FROM board_postings bp
    LEFT JOIN groups g ON bp.group_id = g.id
    WHERE (bp.expires_at IS NULL OR bp.expires_at > NOW())
      AND bp.slots_filled < bp.slots_total
  `);
    return hydrateBoardPostings(rows);
};
export const getBoardForEmbedding = async (postingId) => {
    const { rows } = await query(`
    SELECT bp.id, bp.group_id, g.creator_id, bp.title, bp.description, bp.roles_needed,
           bp.slots_total, bp.slots_filled, bp.expires_at, bp.required_skill_ids, bp.required_interest_ids,
           g.name as group_name
    FROM board_postings bp
    LEFT JOIN groups g ON bp.group_id = g.id
    WHERE bp.id = $1
  `, [postingId]);
    const hydrated = await hydrateBoardPostings(rows);
    return hydrated[0] || null;
};
//# sourceMappingURL=boards.service.js.map