import { query, getClient } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { SCORING_WEIGHTS, RECOMMENDATION_LIMITS } from '../../config/scoring.js';
export async function computeSecondDegreeJob(userId, force = false) {
    if (!force) {
        const lastComputed = await query(`SELECT computed_at FROM recommendations WHERE user_id = $1 AND rec_type = 'second_degree' LIMIT 1`, [userId]);
        if (lastComputed.rows.length > 0 && lastComputed.rows[0].computed_at) {
            const minutesSince = (Date.now() - new Date(lastComputed.rows[0].computed_at).getTime()) / 60000;
            if (minutesSince < RECOMMENDATION_LIMITS.debounceMinutes) {
                return;
            }
        }
    }
    const firstDegree = await query(`SELECT friend_id, connected_at FROM connection_edges
     WHERE user_id = $1 ORDER BY connected_at DESC LIMIT $2`, [userId, RECOMMENDATION_LIMITS.maxFirstDegree]);
    if (firstDegree.rows.length === 0)
        return;
    const friendIds = firstDegree.rows.map(r => r.friend_id);
    const pending = await query(`SELECT receiver_id FROM connections WHERE requester_id = $1 AND status = 'pending'
     UNION SELECT requester_id FROM connections WHERE receiver_id = $1 AND status = 'pending'`, [userId]);
    const blocked = await query(`SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
     UNION SELECT blocker_id FROM user_blocks WHERE blocked_id = $1`, [userId]);
    const excludeSet = new Set([
        userId,
        ...friendIds,
        ...pending.rows.map(r => r.receiver_id || r.requester_id),
        ...blocked.rows.map(r => r.blocked_id || r.blocker_id)
    ]);
    const groups = new Map();
    const candidateClaimed = new Map();
    const mutualCounts = new Map();
    for (const friend of firstDegree.rows) {
        const fof = await query(`SELECT ce.friend_id FROM connection_edges ce
       JOIN users u ON u.id = ce.friend_id
       WHERE ce.user_id = $1
       ORDER BY u.last_active DESC NULLS LAST
       LIMIT $2`, [friend.friend_id, RECOMMENDATION_LIMITS.maxFanOut]);
        for (const row of fof.rows) {
            const cId = row.friend_id;
            if (excludeSet.has(cId))
                continue;
            if (candidateClaimed.has(cId)) {
                mutualCounts.set(cId, (mutualCounts.get(cId) || 1) + 1);
            }
            else {
                candidateClaimed.set(cId, friend.friend_id);
                mutualCounts.set(cId, 1);
                if (!groups.has(friend.friend_id))
                    groups.set(friend.friend_id, []);
                groups.get(friend.friend_id).push({ candidateId: cId, mutualCount: 1 });
            }
        }
    }
    if (candidateClaimed.size === 0) {
        await query('DELETE FROM recommendations WHERE user_id = $1 AND rec_type = $2', [userId, 'second_degree']);
        await redis.del(`rec:2nd:${userId}`);
        return;
    }
    const allCandidateIds = Array.from(candidateClaimed.keys());
    const userSkills = await query('SELECT skill_id FROM user_skills WHERE user_id = $1', [userId]);
    const userInterests = await query('SELECT interest_id FROM user_interests WHERE user_id = $1', [userId]);
    const userInfo = await query('SELECT college_id, looking_for FROM users WHERE id = $1', [userId]);
    const userSkillIds = new Set(userSkills.rows.map(r => r.skill_id));
    const userInterestIds = new Set(userInterests.rows.map(r => r.interest_id));
    const myCollege = userInfo.rows[0]?.college_id;
    const myLookingFor = userInfo.rows[0]?.looking_for;
    const candidateUsers = await query(`SELECT id, college_id, looking_for, profile_completeness, last_active FROM users WHERE id = ANY($1)`, [allCandidateIds]);
    const candidateSkills = await query(`SELECT user_id, skill_id FROM user_skills WHERE user_id = ANY($1)`, [allCandidateIds]);
    const candidateInterests = await query(`SELECT user_id, interest_id FROM user_interests WHERE user_id = ANY($1)`, [allCandidateIds]);
    const userMap = new Map(candidateUsers.rows.map(r => [r.id, r]));
    const skillMap = new Map();
    for (const r of candidateSkills.rows) {
        if (!skillMap.has(r.user_id))
            skillMap.set(r.user_id, new Set());
        skillMap.get(r.user_id).add(r.skill_id);
    }
    const interestMap = new Map();
    for (const r of candidateInterests.rows) {
        if (!interestMap.has(r.user_id))
            interestMap.set(r.user_id, new Set());
        interestMap.get(r.user_id).add(r.interest_id);
    }
    function scoreCandidate(candidateId) {
        const info = userMap.get(candidateId);
        if (!info)
            return 0;
        const cSkills = skillMap.get(candidateId) || new Set();
        const cInterests = interestMap.get(candidateId) || new Set();
        let sharedSkills = 0;
        for (const s of cSkills) {
            if (userSkillIds.has(s))
                sharedSkills++;
        }
        let sharedInterests = 0;
        for (const i of cInterests) {
            if (userInterestIds.has(i))
                sharedInterests++;
        }
        const mc = Math.min((mutualCounts.get(candidateId) || 0) * SCORING_WEIGHTS.mutualCount, SCORING_WEIGHTS.mutualCountCap);
        const sameCollege = info.college_id === myCollege ? SCORING_WEIGHTS.sameCollege : 0;
        let compatibleIntent = 0;
        if (myLookingFor && myLookingFor !== 'none' && info.looking_for && info.looking_for !== 'none') {
            if (myLookingFor === info.looking_for || myLookingFor === 'both' || info.looking_for === 'both') {
                compatibleIntent = SCORING_WEIGHTS.compatibleIntent;
            }
        }
        const completeness = (info.profile_completeness || 0) * SCORING_WEIGHTS.profileCompleteness;
        const daysSinceActive = info.last_active
            ? (Date.now() - new Date(info.last_active).getTime()) / (1000 * 60 * 60 * 24)
            : 30;
        const activityPenalty = Math.max(-daysSinceActive * SCORING_WEIGHTS.daysSinceActivePenalty, SCORING_WEIGHTS.daysSinceActiveFloor);
        return (sharedSkills * SCORING_WEIGHTS.sharedSkills)
            + (sharedInterests * SCORING_WEIGHTS.sharedInterests)
            + mc + sameCollege + compatibleIntent + completeness + activityPenalty;
    }
    const scoredGroups = new Map();
    for (const [viaId, candidates] of groups) {
        const scored = candidates.map(c => ({
            candidateId: c.candidateId,
            score: scoreCandidate(c.candidateId),
            mutualCount: mutualCounts.get(c.candidateId) || 1,
        }));
        scored.sort((a, b) => b.score - a.score);
        scoredGroups.set(viaId, scored);
    }
    const orderedGroupKeys = firstDegree.rows
        .map(r => r.friend_id)
        .filter(id => scoredGroups.has(id));
    const result = [];
    const groupPointers = new Map();
    for (const key of orderedGroupKeys)
        groupPointers.set(key, 0);
    let rank = 1;
    let exhaustedCount = 0;
    while (exhaustedCount < orderedGroupKeys.length && result.length < RECOMMENDATION_LIMITS.maxCandidates) {
        for (const groupId of orderedGroupKeys) {
            if (result.length >= RECOMMENDATION_LIMITS.maxCandidates)
                break;
            const items = scoredGroups.get(groupId);
            const pointer = groupPointers.get(groupId);
            if (pointer >= items.length)
                continue;
            result.push({
                candidateId: items[pointer].candidateId,
                score: items[pointer].score,
                mutualCount: items[pointer].mutualCount,
                viaConnectionId: groupId,
                rank: rank++,
            });
            groupPointers.set(groupId, pointer + 1);
            if (pointer + 1 >= items.length)
                exhaustedCount++;
        }
    }
    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM recommendations WHERE user_id = $1 AND rec_type = $2', [userId, 'second_degree']);
        if (result.length > 0) {
            const BATCH_SIZE = 100;
            for (let i = 0; i < result.length; i += BATCH_SIZE) {
                const batch = result.slice(i, i + BATCH_SIZE);
                const vals = [];
                const phs = [];
                batch.forEach((r, idx) => {
                    const base = idx * 6 + 1;
                    phs.push(`($${base}, $${base + 1}, 'second_degree', $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, NOW())`);
                    vals.push(userId, r.candidateId, r.score, r.rank, r.viaConnectionId, r.mutualCount);
                });
                await client.query(`INSERT INTO recommendations (user_id, candidate_id, rec_type, score, rank, via_connection_id, mutual_count, computed_at)
           VALUES ${phs.join(', ')}`, vals);
            }
        }
        await client.query('COMMIT');
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
    const pipeline = redis.pipeline();
    pipeline.del(`rec:2nd:${userId}`);
    for (const r of result) {
        pipeline.zadd(`rec:2nd:${userId}`, r.rank, r.candidateId);
    }
    pipeline.expire(`rec:2nd:${userId}`, RECOMMENDATION_LIMITS.cacheExpirySec);
    await pipeline.exec();
}
//# sourceMappingURL=secondDegree.worker.js.map