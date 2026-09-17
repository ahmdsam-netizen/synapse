import { getSecondDegreeRecs, getSimilarityRecs } from './recommendations.service.js';
export async function getSecondDegreeHandler(req, res) {
    const authReq = req;
    const userId = authReq.user.id;
    const collegeId = authReq.user.collegeId;
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit, 10) || 30;
    const result = await getSecondDegreeRecs(userId, collegeId, cursor, limit);
    res.json(result);
}
export async function getSimilarityHandler(req, res) {
    const authReq = req;
    const userId = authReq.user.id;
    const collegeId = authReq.user.collegeId;
    const cursor = req.query.cursor || null;
    const limit = parseInt(req.query.limit, 10) || 30;
    const result = await getSimilarityRecs(userId, collegeId, cursor, limit);
    res.json(result);
}
//# sourceMappingURL=recommendations.controller.js.map