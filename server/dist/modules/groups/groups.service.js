import { query, getClient } from '../../config/database.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../../utils/errors.js';
export const createGroup = async (userId, collegeId, data) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const groupCollegeId = data.visibility === 'college' ? collegeId : null;
        const durationDays = [1, 7, 15, 30].includes(Number(data.durationDays)) ? Number(data.durationDays) : 7;
        const { rows: groupRows } = await client.query(`INSERT INTO groups (name, description, creator_id, college_id, visibility, max_members, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + ($7 || ' days')::INTERVAL) RETURNING *`, [data.name, data.description, userId, groupCollegeId, data.visibility, data.maxMembers ? Math.min(Number(data.maxMembers), 8) : 8, durationDays.toString()]);
        const group = groupRows[0];
        await client.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`, [group.id, userId]);
        await client.query('COMMIT');
        return {
            ...group,
            expiresAt: group.expires_at,
            expires_at: group.expires_at,
        };
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};
export const getMyGroups = async (userId) => {
    const { rows } = await query(`SELECT g.*, gm.role,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            CASE WHEN gm.role = 'admin' THEN
              (SELECT COUNT(*) FROM join_requests jr WHERE jr.group_id = g.id AND jr.status = 'pending')
            ELSE 0 END as pending_request_count
     FROM groups g
     JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
     WHERE (g.expires_at IS NULL OR g.expires_at > NOW())
     ORDER BY gm.joined_at DESC`, [userId]);
    return rows.map(r => ({
        ...r,
        expiresAt: r.expires_at,
        expires_at: r.expires_at,
    }));
};
export const getGroupDetail = async (groupId, viewerId) => {
    const { rows: groupRows } = await query(`SELECT * FROM groups WHERE id = $1 AND (expires_at IS NULL OR expires_at > NOW())`, [groupId]);
    if (!groupRows.length)
        throw new NotFoundError('Group not found or has expired');
    const group = groupRows[0];
    const { rows: memberRows } = await query(`SELECT u.id, u.name, u.avatar_url, gm.role, gm.joined_at 
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`, [groupId]);
    const viewerMember = memberRows.find((m) => m.id === viewerId);
    const members = memberRows.map((m) => ({
        id: m.id,
        name: m.name,
        avatarUrl: m.avatar_url,
        avatar_url: m.avatar_url,
        role: m.role,
        joinedAt: m.joined_at,
        joined_at: m.joined_at,
    }));
    const { rows: postingRows } = await query(`SELECT * FROM board_postings 
     WHERE group_id = $1 AND status = 'open' 
       AND slots_filled < slots_total 
       AND (expires_at IS NULL OR expires_at > NOW()) 
     ORDER BY created_at DESC`, [groupId]);
    return {
        ...group,
        expiresAt: group.expires_at,
        expires_at: group.expires_at,
        viewerRole: viewerMember ? viewerMember.role : null,
        members,
        postings: postingRows
    };
};
export const updateGroup = async (groupId, userId, data) => {
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
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
    if (updates.length === 0)
        return { id: groupId };
    params.push(groupId);
    const { rows } = await query(`UPDATE groups SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`, params);
    return rows[0];
};
export const removeMember = async (groupId, targetUserId, actingUserId) => {
    if (targetUserId !== actingUserId) {
        const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, actingUserId]);
        if (!roleRows.length || roleRows[0].role !== 'admin') {
            throw new ForbiddenError('Only admins can remove members');
        }
    }
    const { rows: adminRows } = await query(`SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND role = 'admin'`, [groupId]);
    const { rows: targetRoleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, targetUserId]);
    if (targetRoleRows.length && targetRoleRows[0].role === 'admin' && parseInt(adminRows[0].count) <= 1) {
        throw new BadRequestError('Cannot remove the last admin');
    }
    await query(`DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, targetUserId]);
    return { success: true };
};
export const promoteMember = async (groupId, targetUserId, actingUserId) => {
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, actingUserId]);
    if (!roleRows.length || roleRows[0].role !== 'admin') {
        throw new ForbiddenError('Only admins can promote members');
    }
    await query(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, [groupId, targetUserId]);
    return { success: true };
};
export const inviteUser = async (groupId, inviterId, inviteeId, note) => {
    if (inviterId === inviteeId) {
        throw new BadRequestError('You cannot invite yourself to a group');
    }
    // 1. Verify caller is an admin of the group
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, inviterId]);
    if (!roleRows.length || roleRows[0].role !== 'admin') {
        throw new ForbiddenError('Only group admins can send invitations');
    }
    // 2. Check if group exists and is open
    const { rows: groupRows } = await query(`SELECT id, name, max_members, status FROM groups WHERE id = $1`, [groupId]);
    if (!groupRows.length) {
        throw new NotFoundError('Group not found');
    }
    const group = groupRows[0];
    if (group.status === 'closed') {
        throw new BadRequestError('Group is closed for new members');
    }
    // 3. Check group member count vs max_members
    const { rows: countRows } = await query(`SELECT COUNT(*)::int as count FROM group_members WHERE group_id = $1`, [groupId]);
    if (countRows[0].count >= group.max_members) {
        throw new BadRequestError('Group has reached maximum member capacity');
    }
    // 4. Check if invitee exists and whether they are open to invites
    const { rows: userRows } = await query(`SELECT id, name, COALESCE(open_to_invites, TRUE) as open_to_invites FROM users WHERE id = $1`, [inviteeId]);
    if (!userRows.length) {
        throw new NotFoundError('User not found');
    }
    if (!userRows[0].open_to_invites) {
        throw new ForbiddenError(`${userRows[0].name} is not currently accepting group invitations`);
    }
    // 5. Check if already a member
    const { rows: existingMemberRows } = await query(`SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, inviteeId]);
    if (existingMemberRows.length) {
        throw new ConflictError('User is already a member of this group');
    }
    // 6. Check if pending invite already exists
    const { rows: existingInviteRows } = await query(`SELECT id FROM group_invites WHERE group_id = $1 AND invitee_id = $2 AND status = 'pending'`, [groupId, inviteeId]);
    if (existingInviteRows.length) {
        throw new ConflictError('An invitation is already pending for this user');
    }
    // 7. Insert invite
    const { rows: inviteRows } = await query(`INSERT INTO group_invites (group_id, inviter_id, invitee_id, note, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`, [groupId, inviterId, inviteeId, note?.trim() || null]);
    return inviteRows[0];
};
export const getMyInvites = async (userId) => {
    const { rows } = await query(`SELECT gi.id, gi.group_id, gi.inviter_id, gi.invitee_id, gi.note, gi.status, gi.created_at, gi.updated_at,
            g.name as group_name, g.description as group_description, g.status as group_status,
            u.name as inviter_name, u.avatar_url as inviter_avatar_url,
            c.name as college_name
     FROM group_invites gi
     JOIN groups g ON g.id = gi.group_id
     JOIN users u ON u.id = gi.inviter_id
     LEFT JOIN colleges c ON c.id = g.college_id
     WHERE gi.invitee_id = $1
     ORDER BY (gi.status = 'pending') DESC, gi.created_at DESC`, [userId]);
    return rows.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        groupName: r.group_name,
        groupDescription: r.group_description,
        groupStatus: r.group_status,
        inviterId: r.inviter_id,
        inviterName: r.inviter_name,
        inviterAvatarUrl: r.inviter_avatar_url,
        collegeName: r.college_name,
        note: r.note,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
};
export const acceptInvite = async (inviteId, userId) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const { rows: inviteRows } = await client.query(`SELECT * FROM group_invites WHERE id = $1 AND invitee_id = $2 AND status = 'pending' FOR UPDATE`, [inviteId, userId]);
        if (!inviteRows.length) {
            throw new NotFoundError('Invitation not found or already processed');
        }
        const invite = inviteRows[0];
        // Check group capacity
        const { rows: groupRows } = await client.query(`SELECT id, name, max_members, status FROM groups WHERE id = $1 FOR UPDATE`, [invite.group_id]);
        if (!groupRows.length) {
            throw new NotFoundError('Group not found');
        }
        const group = groupRows[0];
        if (group.status === 'closed') {
            throw new BadRequestError('Group is closed for new members');
        }
        const { rows: countRows } = await client.query(`SELECT COUNT(*)::int as count FROM group_members WHERE group_id = $1`, [invite.group_id]);
        if (countRows[0].count >= group.max_members) {
            throw new BadRequestError('Group has reached maximum member capacity');
        }
        // Add user as member
        await client.query(`INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (group_id, user_id) DO NOTHING`, [invite.group_id, userId]);
        // Update invite status
        const { rows: updatedRows } = await client.query(`UPDATE group_invites SET status = 'accepted', updated_at = NOW() WHERE id = $1 RETURNING *`, [inviteId]);
        await client.query('COMMIT');
        return updatedRows[0];
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
};
export const declineInvite = async (inviteId, userId) => {
    const { rows } = await query(`UPDATE group_invites SET status = 'declined', updated_at = NOW()
     WHERE id = $1 AND invitee_id = $2 AND status = 'pending'
     RETURNING *`, [inviteId, userId]);
    if (!rows.length) {
        throw new NotFoundError('Invitation not found or already processed');
    }
    return rows[0];
};
export const deleteGroup = async (groupId, userId) => {
    const { rows: groupRows } = await query(`SELECT creator_id FROM groups WHERE id = $1`, [groupId]);
    if (!groupRows.length) {
        throw new NotFoundError('Group not found');
    }
    const { rows: roleRows } = await query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId]);
    const isCreator = groupRows[0].creator_id === userId;
    const isAdmin = roleRows.length > 0 && roleRows[0].role === 'admin';
    if (!isAdmin && !isCreator) {
        throw new ForbiddenError('Only group admins or the group creator can delete this group');
    }
    await query(`DELETE FROM groups WHERE id = $1`, [groupId]);
    return { success: true };
};
//# sourceMappingURL=groups.service.js.map