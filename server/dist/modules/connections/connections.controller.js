import * as connectionsService from './connections.service.js';
export const sendRequestHandler = async (req, res) => {
    const result = await connectionsService.sendRequest(req.user.id, req.body.receiverId);
    res.status(201).json(result);
};
export const acceptHandler = async (req, res) => {
    const result = await connectionsService.acceptConnection(req.params.id, req.user.id);
    res.status(200).json(result);
};
export const declineHandler = async (req, res) => {
    const result = await connectionsService.declineConnection(req.params.id, req.user.id);
    res.status(200).json(result);
};
export const removeHandler = async (req, res) => {
    const result = await connectionsService.removeConnection(req.params.id, req.user.id);
    res.status(200).json(result);
};
export const listHandler = async (req, res) => {
    const cursor = req.query.cursor || null;
    const limit = Number(req.query.limit) || 30;
    const result = await connectionsService.listConnections(req.user.id, cursor, limit);
    res.status(200).json(result);
};
export const pendingHandler = async (req, res) => {
    const result = await connectionsService.listPending(req.user.id);
    res.status(200).json(result);
};
export const mutualHandler = async (req, res) => {
    const cursor = req.query.cursor || null;
    const limit = Number(req.query.limit) || 30;
    const result = await connectionsService.getMutualConnections(req.user.id, req.params.userId, cursor, limit);
    res.status(200).json(result);
};
//# sourceMappingURL=connections.controller.js.map