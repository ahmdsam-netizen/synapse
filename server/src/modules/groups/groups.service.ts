import { query, getClient } from '../../config/database.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';

export const createGroup = async (userId: string, collegeId: string | null, data: any) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    const groupCollegeId = data.visibility === 'college' ? collegeId : null;
    
    const { rows: groupRows } = await client.query(
      `INSERT INTO groups (name, description, creator_id, college_id, visibility, max_members)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, data.description, userId, groupCollegeId, data.visibility, data.maxMembers]
    );
    
    const group = groupRows[0];
    
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [group.id, userId]
    );
    
    await client.query('COMMIT');
    return group;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getMyGroups = async (userId: string) => {
  const { rows } = await query(
    `SELECT g.*, gm.role,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            CASE WHEN gm.role = 'admin' THEN
              (SELECT COUNT(*) FROM join_requests jr WHERE jr.group_id = g.id AND jr.status = 'pending')
            ELSE 0 END as pending_request_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     ORDER BY gm.joined_at DESC`,
    [userId]
  );
  return rows;
};

export const getGroupDetail = async (groupId: string, viewerId: string) => {
  const { rows: groupRows } = await query(`SELECT * FROM groups WHERE id = $1`, [groupId]);
  if (!groupRows.length) throw new NotFoundError('Group not found');
  const group = groupRows[0];

  const { rows: memberRows } = await query(
    `SELECT u.id, u.name, u.avatar_url, gm.role, gm.joined_at 
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  
  const viewerMember = memberRows.find((m: any) => m.id === viewerId);

  const members = memberRows.map((m: any) => ({
    id: m.id,
    name: m.name,
    avatarUrl: m.avatar_url,
    avatar_url: m.avatar_url,
    role: m.role,
    joinedAt: m.joined_at,
    joined_at: m.joined_at,
  }));

  const { rows: postingRows } = await query(
    `SELECT * FROM board_postings 
     WHERE group_id = $1 AND status = 'open' 
       AND slots_filled < slots_total 
       AND (expires_at IS NULL OR expires_at > NOW()) 
     ORDER BY created_at DESC`,
    [groupId]
  );

  return {
    ...group,
    viewerRole: viewerMember ? viewerMember.role : null,
    members,
    postings: postingRows
  };
};

export const updateGroup = async (groupId: string, userId: string, data: any) => {
  const { rows: roleRows } = await query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  if (!roleRows.length || roleRows[0].role !== 'admin') {
    throw new ForbiddenError('Only admins can update group');
  }

  const updates = [];
  const params = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updates.push(`"${key.replace(/([A-Z])/g, "_$1").toLowerCase()}" = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (updates.length === 0) return { id: groupId };

  params.push(groupId);
  const { rows } = await query(
    `UPDATE groups SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );
  
  return rows[0];
};

export const removeMember = async (groupId: string, targetUserId: string, actingUserId: string) => {
  if (targetUserId !== actingUserId) {
    const { rows: roleRows } = await query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, actingUserId]
    );
    if (!roleRows.length || roleRows[0].role !== 'admin') {
      throw new ForbiddenError('Only admins can remove members');
    }
  }

  const { rows: adminRows } = await query(
    `SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND role = 'admin'`,
    [groupId]
  );
  
  const { rows: targetRoleRows } = await query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, targetUserId]
  );

  if (targetRoleRows.length && targetRoleRows[0].role === 'admin' && parseInt(adminRows[0].count) <= 1) {
    throw new BadRequestError('Cannot remove the last admin');
  }

  await query(
    `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, targetUserId]
  );
  
  return { success: true };
};

export const promoteMember = async (groupId: string, targetUserId: string, actingUserId: string) => {
  const { rows: roleRows } = await query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, actingUserId]
  );
  if (!roleRows.length || roleRows[0].role !== 'admin') {
    throw new ForbiddenError('Only admins can promote members');
  }

  await query(
    `UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`,
    [groupId, targetUserId]
  );

  return { success: true };
};
