import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createGroupSchema, updateGroupSchema, groupIdParamSchema, removeMemberParamSchema } from './groups.schema.js';
import * as groupsController from './groups.controller.js';
const router = Router();
router.post('/', requireAuth, validate(createGroupSchema), groupsController.createHandler);
router.get('/me', requireAuth, groupsController.getMyGroupsHandler);
router.get('/:id', requireAuth, validate(groupIdParamSchema, 'params'), groupsController.getDetailHandler);
router.put('/:id', requireAuth, validate(groupIdParamSchema, 'params'), validate(updateGroupSchema), groupsController.updateHandler);
router.delete('/:id/members/:userId', requireAuth, validate(removeMemberParamSchema, 'params'), groupsController.removeMemberHandler);
router.post('/:id/members/:userId/promote', requireAuth, validate(removeMemberParamSchema, 'params'), groupsController.promoteMemberHandler);
export default router;
//# sourceMappingURL=groups.routes.js.map