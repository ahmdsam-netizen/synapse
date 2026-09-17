import * as boardsService from './boards.service.js';
export const getGlobalHandler = async (req, res) => {
    const { cursor, limit, ...filters } = req.query;
    const result = await boardsService.getGlobalBoard(cursor, Number(limit), filters, req.user?.id);
    res.json({ status: 'success', data: result });
};
export const getCollegeHandler = async (req, res) => {
    const { cursor, limit, ...filters } = req.query;
    const result = await boardsService.getGlobalBoard(cursor, Number(limit), { ...filters, collegeId: req.user?.collegeId }, req.user?.id);
    res.json({ status: 'success', data: result });
};
export const getMatchedHandler = async (req, res) => {
    const { cursor, limit } = req.query;
    const result = await boardsService.getMatchedBoard(req.user.id, req.user.collegeId, cursor, Number(limit));
    res.json({ status: 'success', data: result });
};
export const getMyPostingsHandler = async (req, res) => {
    const { cursor, limit } = req.query;
    const result = await boardsService.getMyPostings(req.user.id, cursor, Number(limit));
    res.json({ status: 'success', data: result });
};
export const createPostingHandler = async (req, res) => {
    const posting = await boardsService.createPosting(req.user.id, req.body);
    res.status(201).json({ status: 'success', data: posting });
};
export const updatePostingHandler = async (req, res) => {
    const posting = await boardsService.updatePosting(req.params.id, req.user.id, req.body);
    res.json({ status: 'success', data: posting });
};
export const deletePostingHandler = async (req, res) => {
    const result = await boardsService.deletePosting(req.params.id, req.user.id);
    res.json({ status: 'success', data: result });
};
export const closePostingHandler = async (req, res) => {
    await boardsService.closePosting(req.params.id, req.user.id);
    res.json({ status: 'success' });
};
export const getPostingHandler = async (req, res) => {
    const posting = await boardsService.getPosting(req.params.id);
    res.json({ status: 'success', data: posting });
};
export const submitRequestHandler = async (req, res) => {
    const request = await boardsService.submitJoinRequest(req.user.id, req.params.id, req.body.message);
    res.status(201).json({ status: 'success', data: request });
};
export const getGroupRequestsHandler = async (req, res) => {
    const requests = await boardsService.getGroupRequests(req.params.id, req.user.id, req.query.status);
    res.json({ status: 'success', data: requests });
};
export const approveRequestHandler = async (req, res) => {
    await boardsService.approveRequest(req.params.id, req.user.id);
    res.json({ status: 'success' });
};
export const rejectRequestHandler = async (req, res) => {
    await boardsService.rejectRequest(req.params.id, req.user.id);
    res.json({ status: 'success' });
};
export const getMyRequestsHandler = async (req, res) => {
    const requests = await boardsService.getMyRequests(req.user.id);
    res.json({ status: 'success', data: requests });
};
//# sourceMappingURL=boards.controller.js.map