import { searchUsers } from './search.service.js';
export const searchUsersHandler = async (req, res) => {
    const userId = req.user.id;
    const collegeId = req.user.collegeId;
    const filters = req.query;
    const result = await searchUsers(userId, collegeId, filters);
    res.json(result);
};
//# sourceMappingURL=search.controller.js.map