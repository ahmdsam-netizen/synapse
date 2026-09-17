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
//# sourceMappingURL=groups.controller.js.map