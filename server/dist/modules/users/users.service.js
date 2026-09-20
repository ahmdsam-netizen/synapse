import { query } from '../../config/database.js';
import { recommendationQueue } from '../../config/queue.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { computeCompleteness } from '../../utils/profileCompleteness.js';
async function recomputeCompleteness(userId) {
    const userRes = await query(`SELECT name, bio, avatar_url, year_of_study, branch, looking_for FROM users WHERE id = $1`, [userId]);
    if (!userRes.rows.length)
        return;
    const user = userRes.rows[0];
    const skillsRes = await query(`SELECT COUNT(*) FROM user_skills WHERE user_id = $1`, [userId]);
    const skillCount = parseInt(skillsRes.rows[0].count, 10);
    const interestsRes = await query(`SELECT COUNT(*) FROM user_interests WHERE user_id = $1`, [userId]);
    const interestCount = parseInt(interestsRes.rows[0].count, 10);
    const workRes = await query(`SELECT COUNT(*) FROM work_items WHERE user_id = $1`, [userId]);
    const workItemCount = parseInt(workRes.rows[0].count, 10);
    const completeness = computeCompleteness({ ...user, skillCount, interestCount, workItemCount });
    await query(`UPDATE users SET profile_completeness = $1 WHERE id = $2`, [completeness, userId]);
}
export async function getProfile(viewerId, targetId) {
    const userRes = await query(`SELECT u.id, u.name, u.email, u.bio, u.avatar_url, u.year_of_study, u.branch, u.looking_for, u.profile_completeness, COALESCE(u.open_to_invites, TRUE) as open_to_invites, c.name as college_name 
     FROM users u 
     LEFT JOIN colleges c ON u.college_id = c.id 
     WHERE u.id = $1`, [targetId]);
    if (!userRes.rows.length)
        throw new NotFoundError('User not found');
    const user = userRes.rows[0];
    const skillsRes = await query(`SELECT s.id, s.name, s.category, us.proficiency 
     FROM user_skills us 
     JOIN skills s ON us.skill_id = s.id 
     WHERE us.user_id = $1`, [targetId]);
    const interestsRes = await query(`SELECT i.id, i.name, i.category 
     FROM user_interests ui 
     JOIN interests i ON ui.interest_id = i.id 
     WHERE ui.user_id = $1`, [targetId]);
    const workRes = await query(`SELECT id, title, description, tech_used, repo_url, live_url, media_url 
     FROM work_items 
     WHERE user_id = $1`, [targetId]);
    let connectionStatus = 'none';
    let connectionId = null;
    let mutualConnections = 0;
    if (viewerId && viewerId !== targetId) {
        const connRes = await query(`SELECT id AS connection_id, requester_id, receiver_id, status FROM connections 
       WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)`, [viewerId, targetId]);
        if (connRes.rows.length > 0) {
            const conn = connRes.rows[0];
            connectionId = conn.connection_id;
            if (conn.status === 'accepted')
                connectionStatus = 'connected';
            else if (conn.requester_id === viewerId)
                connectionStatus = 'pending_sent';
            else
                connectionStatus = 'pending_received';
        }
        const mutualRes = await query(`SELECT COUNT(*) FROM connection_edges e1 
       JOIN connection_edges e2 ON e1.friend_id = e2.friend_id 
       WHERE e1.user_id = $1 AND e2.user_id = $2`, [viewerId, targetId]);
        mutualConnections = parseInt(mutualRes.rows[0].count, 10);
    }
    return {
        ...user,
        openToInvites: user.open_to_invites ?? true,
        open_to_invites: user.open_to_invites ?? true,
        skills: skillsRes.rows,
        interests: interestsRes.rows,
        workItems: workRes.rows,
        connectionStatus,
        connectionId,
        connection_id: connectionId,
        mutualConnections,
    };
}
export async function getMe(userId) {
    return getProfile(userId, userId);
}
export async function updateProfile(userId, data) {
    const fields = [];
    const values = [];
    let idx = 1;
    const mapping = {
        name: 'name',
        bio: 'bio',
        avatarUrl: 'avatar_url',
        yearOfStudy: 'year_of_study',
        branch: 'branch',
        lookingFor: 'looking_for',
        openToInvites: 'open_to_invites',
        open_to_invites: 'open_to_invites'
    };
    for (const [key, value] of Object.entries(data)) {
        if (mapping[key] !== undefined && value !== undefined) {
            fields.push(`${mapping[key]} = $${idx}`);
            values.push(value);
            idx++;
        }
    }
    if (fields.length === 0)
        return getMe(userId);
    values.push(userId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    await recomputeCompleteness(userId);
    return getMe(userId);
}
export async function addSkill(userId, payload) {
    let finalSkillId = payload.skillId;
    if (!finalSkillId && payload.name) {
        const trimmed = payload.name.trim();
        const existing = await query(`SELECT id FROM skills WHERE LOWER(name) = LOWER($1) LIMIT 1`, [trimmed]);
        if (existing.rows.length > 0) {
            finalSkillId = existing.rows[0].id;
        }
        else {
            const inserted = await query(`INSERT INTO skills (name, category) VALUES ($1, 'Other') RETURNING id`, [trimmed]);
            finalSkillId = inserted.rows[0].id;
        }
    }
    if (!finalSkillId) {
        throw new BadRequestError('Skill ID or valid skill name is required');
    }
    const skillRes = await query(`SELECT id, name, category FROM skills WHERE id = $1`, [finalSkillId]);
    if (!skillRes.rows.length)
        throw new NotFoundError('Skill not found');
    await query(`INSERT INTO user_skills (user_id, skill_id, proficiency) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (user_id, skill_id) DO UPDATE SET proficiency = $3 RETURNING *`, [userId, finalSkillId, payload.proficiency]);
    await recomputeCompleteness(userId);
    await recommendationQueue.add('computeSimilarity', { userId });
    return {
        id: finalSkillId,
        skill_id: finalSkillId,
        name: skillRes.rows[0].name,
        category: skillRes.rows[0].category,
        proficiency: payload.proficiency
    };
}
export async function removeSkill(userId, skillId) {
    const res = await query(`DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2`, [userId, skillId]);
    if (res.rowCount === 0)
        throw new NotFoundError('Skill not found in user profile');
    await recomputeCompleteness(userId);
    await recommendationQueue.add('computeSimilarity', { userId });
}
export async function addInterest(userId, payload) {
    let finalInterestId = payload.interestId;
    if (!finalInterestId && payload.name) {
        const trimmed = payload.name.trim();
        const existing = await query(`SELECT id FROM interests WHERE LOWER(name) = LOWER($1) LIMIT 1`, [trimmed]);
        if (existing.rows.length > 0) {
            finalInterestId = existing.rows[0].id;
        }
        else {
            const inserted = await query(`INSERT INTO interests (name, category) VALUES ($1, 'Other') RETURNING id`, [trimmed]);
            finalInterestId = inserted.rows[0].id;
        }
    }
    if (!finalInterestId) {
        throw new BadRequestError('Interest ID or valid interest name is required');
    }
    const intRes = await query(`SELECT id, name, category FROM interests WHERE id = $1`, [finalInterestId]);
    if (!intRes.rows.length)
        throw new NotFoundError('Interest not found');
    await query(`INSERT INTO user_interests (user_id, interest_id) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id, interest_id) DO NOTHING RETURNING *`, [userId, finalInterestId]);
    await recomputeCompleteness(userId);
    await recommendationQueue.add('computeSimilarity', { userId });
    return {
        id: finalInterestId,
        interest_id: finalInterestId,
        name: intRes.rows[0].name,
        category: intRes.rows[0].category
    };
}
export async function removeInterest(userId, interestId) {
    const res = await query(`DELETE FROM user_interests WHERE user_id = $1 AND interest_id = $2`, [userId, interestId]);
    if (res.rowCount === 0)
        throw new NotFoundError('Interest not found in user profile');
    await recomputeCompleteness(userId);
    await recommendationQueue.add('computeSimilarity', { userId });
}
export async function createWorkItem(userId, data) {
    const res = await query(`INSERT INTO work_items (user_id, title, description, tech_used, repo_url, live_url, media_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [userId, data.title, data.description || null, data.techUsed || [], data.repoUrl || null, data.liveUrl || null, data.mediaUrl || null]);
    await recomputeCompleteness(userId);
    return res.rows[0];
}
export async function updateWorkItem(userId, workItemId, data) {
    const fields = [];
    const values = [];
    let idx = 1;
    const mapping = {
        title: 'title',
        description: 'description',
        techUsed: 'tech_used',
        repoUrl: 'repo_url',
        liveUrl: 'live_url',
        mediaUrl: 'media_url'
    };
    for (const [key, value] of Object.entries(data)) {
        if (mapping[key] !== undefined && value !== undefined) {
            fields.push(`${mapping[key]} = $${idx}`);
            values.push(value);
            idx++;
        }
    }
    if (fields.length === 0) {
        const res = await query(`SELECT * FROM work_items WHERE id = $1 AND user_id = $2`, [workItemId, userId]);
        if (!res.rows.length)
            throw new NotFoundError('Work item not found');
        return res.rows[0];
    }
    values.push(workItemId, userId);
    const res = await query(`UPDATE work_items SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`, values);
    if (res.rowCount === 0)
        throw new NotFoundError('Work item not found');
    return res.rows[0];
}
export async function deleteWorkItem(userId, workItemId) {
    const res = await query(`DELETE FROM work_items WHERE id = $1 AND user_id = $2`, [workItemId, userId]);
    if (res.rowCount === 0)
        throw new NotFoundError('Work item not found');
    await recomputeCompleteness(userId);
}
export async function searchSkills(q) {
    if (!q || !q.trim()) {
        const res = await query(`SELECT id, name, category FROM skills ORDER BY category, name LIMIT 100`);
        return res.rows;
    }
    const term = q.trim();
    const queryStr = `%${term}%`;
    const res = await query(`SELECT id, name, category FROM skills 
     WHERE name ILIKE $1 
     ORDER BY 
       CASE 
         WHEN LOWER(name) = LOWER($2) THEN 1
         WHEN LOWER(name) LIKE LOWER($3) THEN 2
         ELSE 3 
       END, 
       name 
     LIMIT 50`, [queryStr, term, `${term}%`]);
    return res.rows;
}
export async function searchInterests(q) {
    if (!q || !q.trim()) {
        const res = await query(`SELECT id, name, category FROM interests ORDER BY category, name LIMIT 100`);
        return res.rows;
    }
    const term = q.trim();
    const queryStr = `%${term}%`;
    const res = await query(`SELECT id, name, category FROM interests 
     WHERE name ILIKE $1 
     ORDER BY 
       CASE 
         WHEN LOWER(name) = LOWER($2) THEN 1
         WHEN LOWER(name) LIKE LOWER($3) THEN 2
         ELSE 3 
       END, 
       name 
     LIMIT 50`, [queryStr, term, `${term}%`]);
    return res.rows;
}
export async function getAllUsersForEmbedding() {
    const usersRes = await query(`
    SELECT u.id, u.name, u.avatar_url, u.bio, u.year_of_study, u.branch, u.looking_for, c.name as college_name,
      COALESCE((SELECT json_agg(s.name) FROM user_skills us JOIN skills s ON us.skill_id = s.id WHERE us.user_id = u.id), '[]'::json) as skills,
      COALESCE((SELECT json_agg(i.name) FROM user_interests ui JOIN interests i ON ui.interest_id = i.id WHERE ui.user_id = u.id), '[]'::json) as interests
    FROM users u
    LEFT JOIN colleges c ON u.college_id = c.id
  `);
    return usersRes.rows;
}
export async function getUserForEmbedding(userId) {
    const userRes = await query(`
    SELECT u.id, u.name, u.avatar_url, u.bio, u.year_of_study, u.branch, u.looking_for, c.name as college_name,
      COALESCE((SELECT json_agg(s.name) FROM user_skills us JOIN skills s ON us.skill_id = s.id WHERE us.user_id = u.id), '[]'::json) as skills,
      COALESCE((SELECT json_agg(i.name) FROM user_interests ui JOIN interests i ON ui.interest_id = i.id WHERE ui.user_id = u.id), '[]'::json) as interests
    FROM users u
    LEFT JOIN colleges c ON u.college_id = c.id
    WHERE u.id = $1
  `, [userId]);
    return userRes.rows[0] || null;
}
//# sourceMappingURL=users.service.js.map