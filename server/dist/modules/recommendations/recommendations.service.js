import { query } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { recommendationQueue } from '../../config/queue.js';
async function hydrateProfiles(candidateIds, viewerSkillIds, viewerInterestIds, recRows, source, viewerCollegeId, viewerUserId) {
    if (candidateIds.length === 0)
        return { data: [], nextCursor: null, hasMore: false, source };
    const usersRes = await query(`SELECT * FROM users WHERE id = ANY($1)`, [candidateIds]);
    const collegesRes = await query(`SELECT id, name FROM colleges`);
    const collegeMap = new Map(collegesRes.rows.map((c) => [c.id, c.name]));
    const skillsRes = await query(`SELECT us.user_id, s.id, s.name, s.category, us.proficiency 
     FROM user_skills us JOIN skills s ON s.id = us.skill_id 
     WHERE us.user_id = ANY($1)`, [candidateIds]);
    const interestsRes = await query(`SELECT ui.user_id, i.id, i.name, i.category 
     FROM user_interests ui JOIN interests i ON i.id = ui.interest_id 
     WHERE ui.user_id = ANY($1)`, [candidateIds]);
    const viaIds = recRows.map(r => r.via_connection_id).filter(Boolean);
    let viaNames = new Map();
    if (viaIds.length > 0) {
        const viasRes = await query(`SELECT id, name, avatar_url FROM users WHERE id = ANY($1)`, [viaIds]);
        for (const r of viasRes.rows)
            viaNames.set(r.id, { id: r.id, name: r.name, avatarUrl: r.avatar_url });
    }
    // Batch-fetch any pending outgoing requests the viewer has sent to these candidates
    const pendingSentSet = new Set();
    if (viewerUserId && candidateIds.length > 0) {
        const pendingRes = await query(`SELECT receiver_id FROM connections
       WHERE requester_id = $1 AND receiver_id = ANY($2) AND status = 'pending'`, [viewerUserId, candidateIds]);
        for (const r of pendingRes.rows)
            pendingSentSet.add(r.receiver_id);
    }
    const userMap = new Map(usersRes.rows.map(u => [u.id, u]));
    const skillsMap = new Map();
    const interestsMap = new Map();
    for (const row of skillsRes.rows) {
        if (!skillsMap.has(row.user_id))
            skillsMap.set(row.user_id, []);
        skillsMap.get(row.user_id).push(row);
    }
    for (const row of interestsRes.rows) {
        if (!interestsMap.has(row.user_id))
            interestsMap.set(row.user_id, []);
        interestsMap.get(row.user_id).push(row);
    }
    const items = [];
    let lastRank = null;
    for (const row of recRows) {
        const candidateId = row.candidate_id || row.id;
        const user = userMap.get(candidateId);
        if (!user)
            continue;
        const uSkills = skillsMap.get(candidateId) || [];
        const uInterests = interestsMap.get(candidateId) || [];
        const matchedSkills = uSkills.filter((s) => viewerSkillIds.has(s.id));
        const matchedInterests = uInterests.filter((i) => viewerInterestIds.has(i.id));
        // 'pending' = viewer already sent a request; 'none' = no request yet
        const connectionStatus = pendingSentSet.has(candidateId) ? 'pending' : 'none';
        items.push({
            id: user.id,
            name: user.name,
            avatarUrl: user.avatar_url,
            headline: user.headline,
            collegeId: user.college_id,
            collegeName: collegeMap.get(user.college_id) || 'Campus Connect Member',
            year: user.year_of_study,
            yearOfStudy: user.year_of_study,
            branch: user.branch,
            lookingFor: user.looking_for,
            sameCollege: viewerCollegeId ? user.college_id === viewerCollegeId : false,
            score: row.score || 0,
            matchScore: row.score !== undefined ? Number(row.score) : undefined,
            similarityScore: row.score !== undefined ? Number(row.score) : undefined,
            matchPercentage: row.score !== undefined ? (Number(row.score) <= 1.0 ? Math.round(Number(row.score) * 100) : Math.min(100, Math.round(Number(row.score)))) : undefined,
            match_percentage: row.score !== undefined ? (Number(row.score) <= 1.0 ? Math.round(Number(row.score) * 100) : Math.min(100, Math.round(Number(row.score)))) : undefined,
            mutualCount: row.mutual_count || 0,
            viaConnection: row.via_connection_id ? viaNames.get(row.via_connection_id) : null,
            matchedSkills,
            matchedInterests,
            skills: uSkills,
            interests: uInterests,
            allSkills: uSkills,
            allInterests: uInterests,
            connectionStatus,
        });
        if (row.rank !== undefined) {
            lastRank = row.rank;
        }
    }
    return {
        data: items,
        nextCursor: lastRank ? String(lastRank) : null,
        hasMore: lastRank !== null,
        source
    };
}
export async function getSimilarityRecs(userId, collegeId, cursor, limit) {
    limit = Math.min(Math.max(limit, 1), 30);
    const cursorRank = cursor ? parseInt(cursor, 10) : 0;
    const redisKey = `rec:sim:${userId}`;
    let candidateIds = [];
    const redisResult = await redis.zrangebyscore(redisKey, `(${cursorRank}`, '+inf', 'LIMIT', 0, limit);
    let recRows = [];
    let source = 'similarity';
    if (redisResult.length > 0) {
        candidateIds = redisResult;
        const pgRes = await query(`SELECT candidate_id, score, rank FROM recommendations 
       WHERE user_id = $1 AND rec_type = 'similarity' AND candidate_id = ANY($2)
       ORDER BY rank ASC`, [userId, candidateIds]);
        recRows = pgRes.rows;
    }
    else {
        const pgRes = await query(`SELECT candidate_id, score, rank 
       FROM recommendations
       WHERE user_id = $1 AND rec_type = 'similarity' AND rank > $2
       ORDER BY rank ASC LIMIT $3`, [userId, cursorRank, limit]);
        if (pgRes.rows.length > 0) {
            recRows = pgRes.rows;
            candidateIds = recRows.map(r => r.candidate_id);
        }
        recommendationQueue.add('computeSimilarity', { userId, force: false });
    }
    const vSkills = await query('SELECT skill_id FROM user_skills WHERE user_id = $1', [userId]);
    const vInterests = await query('SELECT interest_id FROM user_interests WHERE user_id = $1', [userId]);
    const viewerSkillIds = new Set(vSkills.rows.map(r => r.skill_id));
    const viewerInterestIds = new Set(vInterests.rows.map(r => r.interest_id));
    if (recRows.length === 0 && (cursor === null || cursor === '0')) {
        const liveRes = await query(`SELECT u.id, u.id as candidate_id,
              COUNT(DISTINCT us.skill_id) * 10 + COUNT(DISTINCT ui.interest_id) * 6
                + CASE WHEN u.college_id = $2 THEN 30 ELSE 0 END AS score,
              0 as rank
       FROM users u
       LEFT JOIN user_skills us ON us.user_id = u.id AND us.skill_id = ANY($3)
       LEFT JOIN user_interests ui ON ui.user_id = u.id AND ui.interest_id = ANY($4)
       WHERE u.id <> $1
         AND NOT EXISTS (SELECT 1 FROM connection_edges WHERE user_id = $1 AND friend_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = u.id AND blocked_id = $1)
       GROUP BY u.id
       HAVING COUNT(DISTINCT us.skill_id) + COUNT(DISTINCT ui.interest_id) >= 1 OR u.college_id = $2
       ORDER BY score DESC, u.last_active DESC NULLS LAST
       LIMIT $5`, [userId, collegeId, Array.from(viewerSkillIds), Array.from(viewerInterestIds), limit]);
        recRows = liveRes.rows;
        candidateIds = recRows.map(r => r.candidate_id);
        recRows.forEach((r, idx) => r.rank = idx + 1);
    }
    if (candidateIds.length > 0) {
        const dropRes = await query(`SELECT friend_id as drop_id FROM connection_edges WHERE user_id = $1 AND friend_id = ANY($2)
       UNION
       SELECT blocked_id as drop_id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = ANY($2)
       UNION
       SELECT blocker_id as drop_id FROM user_blocks WHERE blocked_id = $1 AND blocker_id = ANY($2)`, [userId, candidateIds]);
        const dropSet = new Set(dropRes.rows.map(r => r.drop_id));
        recRows = recRows.filter(r => !dropSet.has(r.candidate_id));
        candidateIds = recRows.map(r => r.candidate_id);
    }
    return hydrateProfiles(candidateIds, viewerSkillIds, viewerInterestIds, recRows, source, collegeId, userId);
}
export async function getSecondDegreeRecs(userId, collegeId, cursor, limit) {
    limit = Math.min(Math.max(limit, 1), 30);
    const cursorRank = cursor ? parseInt(cursor, 10) : 0;
    const redisKey = `rec:2nd:${userId}`;
    let candidateIds = [];
    const redisResult = await redis.zrangebyscore(redisKey, `(${cursorRank}`, '+inf', 'LIMIT', 0, limit);
    let recRows = [];
    let source = 'second_degree';
    if (redisResult.length > 0) {
        candidateIds = redisResult;
        const pgRes = await query(`SELECT candidate_id, score, rank, via_connection_id, mutual_count 
       FROM recommendations 
       WHERE user_id = $1 AND rec_type = 'second_degree' AND candidate_id = ANY($2)
       ORDER BY rank ASC`, [userId, candidateIds]);
        recRows = pgRes.rows;
    }
    else {
        const pgRes = await query(`SELECT candidate_id, score, rank, via_connection_id, mutual_count 
       FROM recommendations
       WHERE user_id = $1 AND rec_type = 'second_degree' AND rank > $2
       ORDER BY rank ASC LIMIT $3`, [userId, cursorRank, limit]);
        if (pgRes.rows.length > 0) {
            recRows = pgRes.rows;
            candidateIds = recRows.map(r => r.candidate_id);
        }
        recommendationQueue.add('computeSecondDegree', { userId, force: false });
    }
    const vSkills = await query('SELECT skill_id FROM user_skills WHERE user_id = $1', [userId]);
    const vInterests = await query('SELECT interest_id FROM user_interests WHERE user_id = $1', [userId]);
    const viewerSkillIds = new Set(vSkills.rows.map(r => r.skill_id));
    const viewerInterestIds = new Set(vInterests.rows.map(r => r.interest_id));
    if (recRows.length === 0 && (cursor === null || cursor === '0')) {
        const directRes = await query(`SELECT ce.friend_id as candidate_id, 0 as score, 0 as rank
       FROM connection_edges ce
       WHERE ce.user_id = $1
       ORDER BY ce.connected_at DESC LIMIT $2`, [userId, limit]);
        if (directRes.rows.length > 0) {
            recRows = directRes.rows;
            candidateIds = recRows.map(r => r.candidate_id);
            source = 'direct_connections';
            recRows.forEach((r, idx) => r.rank = idx + 1);
        }
        else {
            return getSimilarityRecs(userId, collegeId, cursor, limit);
        }
    }
    if (candidateIds.length > 0) {
        const dropRes = await query(`SELECT friend_id as drop_id FROM connection_edges WHERE user_id = $1 AND friend_id = ANY($2)
       UNION
       SELECT blocked_id as drop_id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = ANY($2)
       UNION
       SELECT blocker_id as drop_id FROM user_blocks WHERE blocked_id = $1 AND blocker_id = ANY($2)`, [userId, candidateIds]);
        const dropSet = new Set(dropRes.rows.map(r => r.drop_id));
        if (source !== 'direct_connections') {
            recRows = recRows.filter(r => !dropSet.has(r.candidate_id));
            candidateIds = recRows.map(r => r.candidate_id);
        }
    }
    return hydrateProfiles(candidateIds, viewerSkillIds, viewerInterestIds, recRows, source, collegeId, userId);
}
//# sourceMappingURL=recommendations.service.js.map