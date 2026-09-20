import * as groupsService from './groups.service.js';
export const createHandler = async (req, res) => {
    const group = await groupsService.createGroup(req.user.id, req.user.collegeId, req.body);
    res.status(201).json({ status: 'success', data: group });
};
export const getMyGroupsHandler = async (req, res) => {
    const groups = await groupsService.getMyGroups(req.user.id);
    res.json({ status: 'success', data: groups });
};
export const getDetailHandler = async (req, res) => {
    const detail = await groupsService.getGroupDetail(req.params.id, req.user.id);
    res.json({ status: 'success', data: detail });
};
export const updateHandler = async (req, res) => {
    const group = await groupsService.updateGroup(req.params.id, req.user.id, req.body);
    res.json({ status: 'success', data: group });
};
export const removeMemberHandler = async (req, res) => {
    await groupsService.removeMember(req.params.id, req.params.userId, req.user.id);
    res.json({ status: 'success' });
};
export const promoteMemberHandler = async (req, res) => {
    await groupsService.promoteMember(req.params.id, req.params.userId, req.user.id);
    res.json({ status: 'success' });
};
export const inviteUserHandler = async (req, res) => {
    const invite = await groupsService.inviteUser(req.params.id, req.user.id, req.body.userId, req.body.note);
    res.status(201).json({ status: 'success', data: invite });
};
export const getMyInvitesHandler = async (req, res) => {
    const invites = await groupsService.getMyInvites(req.user.id);
    res.json({ status: 'success', data: invites });
};
export const acceptInviteHandler = async (req, res) => {
    const result = await groupsService.acceptInvite(req.params.inviteId, req.user.id);
    res.json({ status: 'success', data: result });
};
export const declineInviteHandler = async (req, res) => {
    const result = await groupsService.declineInvite(req.params.inviteId, req.user.id);
    res.json({ status: 'success', data: result });
};
export const deleteHandler = async (req, res) => {
    await groupsService.deleteGroup(req.params.id, req.user.id);
    res.json({ status: 'success', message: 'Group deleted successfully' });
};
//# sourceMappingURL=groups.controller.js.map