import { query } from '../../config/database';
import { recommendationQueue } from '../../config/queue';
import { NotFoundError, ConflictError } from '../../utils/errors';
import { computeCompleteness } from '../../utils/profileCompleteness';

async function recomputeCompleteness(userId: string) {
  const userRes = await query(`SELECT name, bio, avatar_url, year_of_study, branch, looking_for FROM users WHERE id = $1`, [userId]);
  if (!userRes.rows.length) return;
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

export async function getProfile(viewerId: string | null, targetId: string) {
  const userRes = await query(
    `SELECT u.id, u.name, u.email, u.bio, u.avatar_url, u.year_of_study, u.branch, u.looking_for, u.profile_completeness, c.name as college_name 
     FROM users u 
     LEFT JOIN colleges c ON u.college_id = c.id 
     WHERE u.id = $1`,
    [targetId]
  );
  if (!userRes.rows.length) throw new NotFoundError('User not found');
  const user = userRes.rows[0];

  const skillsRes = await query(
    `SELECT s.id, s.name, s.category, us.proficiency 
     FROM user_skills us 
     JOIN skills s ON us.skill_id = s.id 
     WHERE us.user_id = $1`,
    [targetId]
  );
  
  const interestsRes = await query(
    `SELECT i.id, i.name, i.category 
     FROM user_interests ui 
     JOIN interests i ON ui.interest_id = i.id 
     WHERE ui.user_id = $1`,
    [targetId]
  );

  const workRes = await query(
    `SELECT id, title, description, tech_used, repo_url, live_url, media_url 
     FROM work_items 
     WHERE user_id = $1`,
    [targetId]
  );

  let connectionStatus = 'none';
  let mutualConnections = 0;

  if (viewerId && viewerId !== targetId) {
    const connRes = await query(
      `SELECT requester_id, receiver_id, status FROM connections 
       WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)`,
      [viewerId, targetId]
    );

    if (connRes.rows.length > 0) {
      const conn = connRes.rows[0];
      if (conn.status === 'accepted') connectionStatus = 'connected';
      else if (conn.requester_id === viewerId) connectionStatus = 'pending_sent';
      else connectionStatus = 'pending_received';
    }

    const mutualRes = await query(
      `SELECT COUNT(*) FROM connection_edges e1 
       JOIN connection_edges e2 ON e1.friend_id = e2.friend_id 
       WHERE e1.user_id = $1 AND e2.user_id = $2`,
      [viewerId, targetId]
    );
    mutualConnections = parseInt(mutualRes.rows[0].count, 10);
  }

  return {
    ...user,
    skills: skillsRes.rows,
    interests: interestsRes.rows,
    workItems: workRes.rows,
    connectionStatus,
    mutualConnections,
  };
}

export async function getMe(userId: string) {
  return getProfile(userId, userId);
}

export async function updateProfile(userId: string, data: any) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping: Record<string, string> = {
    name: 'name',
    bio: 'bio',
    avatarUrl: 'avatar_url',
    yearOfStudy: 'year_of_study',
    branch: 'branch',
    lookingFor: 'looking_for'
  };

  for (const [key, value] of Object.entries(data)) {
    if (mapping[key] !== undefined && value !== undefined) {
      fields.push(`${mapping[key]} = $${idx}`);
      values.push(value);
      idx++;
    }
  }

  if (fields.length === 0) return getMe(userId);

  values.push(userId);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);

  await recomputeCompleteness(userId);
  
  return getMe(userId);
}

export async function addSkill(userId: string, skillId: string, proficiency: string) {
  const skillRes = await query(`SELECT id FROM skills WHERE id = $1`, [skillId]);
  if (!skillRes.rows.length) throw new NotFoundError('Skill not found');

  await query(
    `INSERT INTO user_skills (user_id, skill_id, proficiency) 
     VALUES ($1, $2, $3) 
     ON CONFLICT (user_id, skill_id) DO UPDATE SET proficiency = $3 RETURNING *`,
    [userId, skillId, proficiency]
  );

  await recomputeCompleteness(userId);
  await recommendationQueue.add('computeSimilarity', { userId });

  return { skillId, proficiency };
}

export async function removeSkill(userId: string, skillId: string) {
  const res = await query(`DELETE FROM user_skills WHERE user_id = $1 AND skill_id = $2`, [userId, skillId]);
  if (res.rowCount === 0) throw new NotFoundError('Skill not found in user profile');

  await recomputeCompleteness(userId);
  await recommendationQueue.add('computeSimilarity', { userId });
}

export async function addInterest(userId: string, interestId: string) {
  const intRes = await query(`SELECT id FROM interests WHERE id = $1`, [interestId]);
  if (!intRes.rows.length) throw new NotFoundError('Interest not found');

  await query(
    `INSERT INTO user_interests (user_id, interest_id) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id, interest_id) DO NOTHING RETURNING *`,
    [userId, interestId]
  );

  await recomputeCompleteness(userId);
  await recommendationQueue.add('computeSimilarity', { userId });

  return { interestId };
}

export async function removeInterest(userId: string, interestId: string) {
  const res = await query(`DELETE FROM user_interests WHERE user_id = $1 AND interest_id = $2`, [userId, interestId]);
  if (res.rowCount === 0) throw new NotFoundError('Interest not found in user profile');

  await recomputeCompleteness(userId);
  await recommendationQueue.add('computeSimilarity', { userId });
}

export async function createWorkItem(userId: string, data: any) {
  const res = await query(
    `INSERT INTO work_items (user_id, title, description, tech_used, repo_url, live_url, media_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, data.title, data.description || null, data.techUsed || [], data.repoUrl || null, data.liveUrl || null, data.mediaUrl || null]
  );

  await recomputeCompleteness(userId);
  return res.rows[0];
}

export async function updateWorkItem(userId: string, workItemId: string, data: any) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping: Record<string, string> = {
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
    if (!res.rows.length) throw new NotFoundError('Work item not found');
    return res.rows[0];
  }

  values.push(workItemId, userId);
  const res = await query(
    `UPDATE work_items SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    values
  );

  if (res.rowCount === 0) throw new NotFoundError('Work item not found');
  return res.rows[0];
}

export async function deleteWorkItem(userId: string, workItemId: string) {
  const res = await query(`DELETE FROM work_items WHERE id = $1 AND user_id = $2`, [workItemId, userId]);
  if (res.rowCount === 0) throw new NotFoundError('Work item not found');
  await recomputeCompleteness(userId);
}

export async function searchSkills(q: string) {
  const queryStr = q ? \`%\${q}%\` : '%';
  const res = await query(
    `SELECT id, name, category FROM skills WHERE name ILIKE $1 ORDER BY name LIMIT 20`,
    [queryStr]
  );
  return res.rows;
}

export async function searchInterests(q: string) {
  const queryStr = q ? \`%\${q}%\` : '%';
  const res = await query(
    `SELECT id, name, category FROM interests WHERE name ILIKE $1 ORDER BY name LIMIT 20`,
    [queryStr]
  );
  return res.rows;
}
