import { query, getClient } from '../../config/database.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';

export const createCommunity = async (userId: string, data: { name: string; description?: string | null }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: groupRows } = await client.query(
      `INSERT INTO groups (name, description, creator_id, college_id, visibility, max_members, expires_at, is_community)
       VALUES ($1, $2, $3, NULL, 'global', 1000, NULL, TRUE)
       RETURNING *`,
      [data.name.trim(), data.description ? data.description.trim() : null, userId]
    );

    const community = groupRows[0];

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [community.id, userId]
    );

    await client.query('COMMIT');

    return {
      ...community,
      isCommunity: true,
      is_community: true,
      memberCount: 1,
      member_count: 1,
      isMember: true,
      userRole: 'admin',
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getCommunities = async (userId: string, search?: string) => {
  let queryText = `
    SELECT g.*,
           (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id) as member_count,
           EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = $1) as is_member,
           (SELECT role FROM group_members WHERE group_id = g.id AND user_id = $1) as user_role
    FROM groups g
    WHERE g.is_community = TRUE
  `;
  const params: any[] = [userId];

  if (search && search.trim()) {
    queryText += ` AND (LOWER(g.name) LIKE $2 OR LOWER(g.description) LIKE $2)`;
    params.push(`%${search.trim().toLowerCase()}%`);
  }

  queryText += ` ORDER BY member_count DESC, g.created_at DESC`;

  const { rows } = await query(queryText, params);
  return rows.map((r: any) => ({
    ...r,
    isCommunity: true,
    is_community: true,
    memberCount: r.member_count,
    member_count: r.member_count,
    isMember: r.is_member,
    userRole: r.user_role,
  }));
};

export const getMyCommunities = async (userId: string) => {
  const { rows } = await query(
    `SELECT g.*, gm.role as user_role,
            (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id) as member_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     WHERE g.is_community = TRUE
     ORDER BY gm.joined_at DESC`,
    [userId]
  );
  return rows.map((r: any) => ({
    ...r,
    isCommunity: true,
    is_community: true,
    memberCount: r.member_count,
    member_count: r.member_count,
    isMember: true,
    userRole: r.user_role,
  }));
};

export const getCommunityDetail = async (communityId: string, viewerId: string) => {
  const { rows: commRows } = await query(
    `SELECT * FROM groups WHERE id = $1 AND is_community = TRUE`,
    [communityId]
  );
  if (!commRows.length) throw new NotFoundError('Community not found');
  const community = commRows[0];

  const { rows: memberRows } = await query(
    `SELECT u.id, u.name, u.avatar_url, gm.role, gm.joined_at,
            col.name as college_name, u.branch, u.year_of_study
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     LEFT JOIN colleges col ON col.id = u.college_id
     WHERE gm.group_id = $1
     ORDER BY (gm.role = 'admin') DESC, gm.joined_at ASC`,
    [communityId]
  );

  const viewerMember = memberRows.find((m: any) => m.id === viewerId);

  return {
    ...community,
    isCommunity: true,
    is_community: true,
    maxMembers: 1000,
    max_members: 1000,
    expiresAt: null,
    expires_at: null,
    visibility: 'global',
    viewerId,
    viewerRole: viewerMember ? viewerMember.role : null,
    isMember: !!viewerMember,
    memberCount: memberRows.length,
    member_count: memberRows.length,
    members: memberRows.map((m: any) => ({
      id: m.id,
      name: m.name,
      avatarUrl: m.avatar_url,
      avatar_url: m.avatar_url,
      role: m.role,
      joinedAt: m.joined_at,
      joined_at: m.joined_at,
      collegeName: m.college_name,
      college_name: m.college_name,
      branch: m.branch,
      yearOfStudy: m.year_of_study,
    })),
  };
};

export const joinCommunity = async (communityId: string, userId: string) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: commRows } = await client.query(
      `SELECT id, name, status, max_members FROM groups WHERE id = $1 AND is_community = TRUE FOR UPDATE`,
      [communityId]
    );
    if (!commRows.length) throw new NotFoundError('Community not found');
    const community = commRows[0];

    if (community.status === 'closed') {
      throw new BadRequestError('This community is closed');
    }

    const { rows: countRows } = await client.query(
      `SELECT COUNT(*)::int as count FROM group_members WHERE group_id = $1`,
      [communityId]
    );

    const limit = 1000;
    if (countRows[0].count >= limit) {
      throw new BadRequestError('Community has reached the maximum capacity of 1,000 members');
    }

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [communityId, userId]
    );

    await client.query('COMMIT');
    return { success: true, message: 'Joined community successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const leaveCommunity = async (communityId: string, userId: string) => {
  const { rows: roleRows } = await query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [communityId, userId]
  );
  if (!roleRows.length) throw new NotFoundError('Not a member of this community');

  // If user is admin and the only admin, check if there are other members
  if (roleRows[0].role === 'admin') {
    const { rows: adminCount } = await query(
      `SELECT COUNT(*)::int as count FROM group_members WHERE group_id = $1 AND role = 'admin'`,
      [communityId]
    );
    const { rows: totalCount } = await query(
      `SELECT COUNT(*)::int as count FROM group_members WHERE group_id = $1`,
      [communityId]
    );

    if (adminCount[0].count === 1 && totalCount[0].count > 1) {
      throw new BadRequestError('Please promote another member to admin before leaving');
    }
  }

  await query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [communityId, userId]);
  return { success: true, message: 'Left community successfully' };
};

export const deleteCommunity = async (communityId: string, userId: string) => {
  const { rows: roleRows } = await query(
    `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
    [communityId, userId]
  );
  if (!roleRows.length || roleRows[0].role !== 'admin') {
    throw new ForbiddenError('Only admins can delete this community');
  }

  await query(`DELETE FROM groups WHERE id = $1 AND is_community = TRUE`, [communityId]);
  return { success: true, message: 'Community deleted successfully' };
};
