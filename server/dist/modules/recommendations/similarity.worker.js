import { query, getClient } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { SCORING_WEIGHTS, RECOMMENDATION_LIMITS } from '../../config/scoring.js';
export async function computeSimilarityJob(userId, force = false) {
    if (!force) {
        const lastComputed = await query(`SELECT computed_at FROM recommendations WHERE user_id = $1 AND rec_type = 'similarity' LIMIT 1`, [userId]);
        if (lastComputed.rows.length > 0 && lastComputed.rows[0].computed_at) {
            const minutesSince = (Date.now() - new Date(lastComputed.rows[0].computed_at).getTime()) / 60000;
            if (minutesSince < RECOMMENDATION_LIMITS.debounceMinutes) {
                return;
            }
        }
    }
    const userSkills = await query('SELECT skill_id FROM user_skills WHERE user_id = $1', [userId]);
    const userInterests = await query('SELECT interest_id FROM user_interests WHERE user_id = $1', [userId]);
    const userInfo = await query('SELECT college_id, looking_for FROM users WHERE id = $1', [userId]);
    if (userInfo.rows.length === 0)
        return;
    const skillIds = userSkills.rows.map(r => r.skill_id);
    const interestIds = userInterests.rows.map(r => r.interest_id);
    const myCollege = userInfo.rows[0].college_id;
    const myLookingFor = userInfo.rows[0].looking_for;
    const candidatesRes = await query(`SELECT u.id as candidate_id, u.college_id, u.looking_for, u.profile_completeness, u.last_active,
            COUNT(DISTINCT us.skill_id) as shared_skills,
            COUNT(DISTINCT ui.interest_id) as shared_interests
     FROM users u
     LEFT JOIN user_skills us ON us.user_id = u.id AND us.skill_id = ANY($2)
     LEFT JOIN user_interests ui ON ui.user_id = u.id AND ui.interest_id = ANY($3)
     WHERE u.id <> $1
       AND NOT EXISTS (SELECT 1 FROM connection_edges WHERE user_id = $1 AND friend_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = u.id) OR (blocker_id = u.id AND blocked_id = $1))
       AND NOT EXISTS (
         SELECT 1 FROM connections c 
         WHERE (c.requester_id = $1 AND c.receiver_id = u.id AND c.status = 'pending') 
            OR (c.requester_id = u.id AND c.receiver_id = $1 AND c.status = 'pending')
       )
     GROUP BY u.id
     HAVING COUNT(DISTINCT us.skill_id) + COUNT(DISTINCT ui.interest_id) >= 1 OR u.college_id = $4
     LIMIT 1500`, [userId, skillIds, interestIds, myCollege]);
    const result = candidatesRes.rows.map(row => {
        const sharedSkills = parseInt(row.shared_skills, 10) || 0;
        const sharedInterests = parseInt(row.shared_interests, 10) || 0;
        const sameCollege = row.college_id === myCollege ? SCORING_WEIGHTS.sameCollegeSimilarity : 0;
        let compatibleIntent = 0;
        if (myLookingFor && myLookingFor !== 'none' && row.looking_for && row.looking_for !== 'none') {
            if (myLookingFor === row.looking_for || myLookingFor === 'both' || row.looking_for === 'both') {
                compatibleIntent = SCORING_WEIGHTS.compatibleIntent;
            }
        }
        const completeness = (row.profile_completeness || 0) * SCORING_WEIGHTS.profileCompleteness;
        const daysSinceActive = row.last_active
            ? (Date.now() - new Date(row.last_active).getTime()) / (1000 * 60 * 60 * 24)
            : 30;
        const activityPenalty = Math.max(-daysSinceActive * SCORING_WEIGHTS.daysSinceActivePenalty, SCORING_WEIGHTS.daysSinceActiveFloor);
        const score = (sharedSkills * SCORING_WEIGHTS.sharedSkills)
            + (sharedInterests * SCORING_WEIGHTS.sharedInterests)
            + sameCollege + compatibleIntent + completeness + activityPenalty;
        return {
            candidateId: row.candidate_id,
            score,
            rank: 0
        };
    });
    result.sort((a, b) => b.score - a.score);
    result.forEach((r, idx) => { r.rank = idx + 1; });
    const limitedResult = result.slice(0, RECOMMENDATION_LIMITS.maxCandidates);
    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM recommendations WHERE user_id = $1 AND rec_type = $2', [userId, 'similarity']);
        if (limitedResult.length > 0) {
            const BATCH_SIZE = 100;
            for (let i = 0; i < limitedResult.length; i += BATCH_SIZE) {
                const batch = limitedResult.slice(i, i + BATCH_SIZE);
                const vals = [];
                const phs = [];
                batch.forEach((r, idx) => {
                    const base = idx * 5 + 1;
                    phs.push(`($${base}, $${base + 1}, 'similarity', $${base + 2}, $${base + 3}, NULL, 0, NOW())`);
                    vals.push(userId, r.candidateId, r.score, r.rank, r.rank);
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
    pipeline.del(`rec:sim:${userId}`);
    for (const r of limitedResult) {
        pipeline.zadd(`rec:sim:${userId}`, r.rank, r.candidateId);
    }
    pipeline.expire(`rec:sim:${userId}`, RECOMMENDATION_LIMITS.cacheExpirySec);
    await pipeline.exec();
}
//# sourceMappingURL=similarity.worker.js.map