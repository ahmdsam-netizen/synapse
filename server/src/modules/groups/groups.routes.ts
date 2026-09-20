import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createGroupSchema,
  updateGroupSchema,
  groupIdParamSchema,
  removeMemberParamSchema,
  inviteUserSchema,
  inviteIdParamSchema,
} from './groups.schema.js';
import * as groupsController from './groups.controller.js';

const router = Router();

router.post('/', requireAuth, validate(createGroupSchema), groupsController.createHandler);
router.get('/me', requireAuth, groupsController.getMyGroupsHandler);

// Invites routes
router.get('/invites/me', requireAuth, groupsController.getMyInvitesHandler);
router.post('/invites/:inviteId/accept', requireAuth, validate(inviteIdParamSchema, 'params'), groupsController.acceptInviteHandler);
router.post('/invites/:inviteId/decline', requireAuth, validate(inviteIdParamSchema, 'params'), groupsController.declineInviteHandler);

router.get('/:id', requireAuth, validate(groupIdParamSchema, 'params'), groupsController.getDetailHandler);
router.put('/:id', requireAuth, validate(groupIdParamSchema, 'params'), validate(updateGroupSchema), groupsController.updateHandler);
router.delete('/:id', requireAuth, validate(groupIdParamSchema, 'params'), groupsController.deleteHandler);
router.post('/:id/invites', requireAuth, validate(groupIdParamSchema, 'params'), validate(inviteUserSchema), groupsController.inviteUserHandler);
router.delete('/:id/members/:userId', requireAuth, validate(removeMemberParamSchema, 'params'), groupsController.removeMemberHandler);
router.post('/:id/members/:userId/promote', requireAuth, validate(removeMemberParamSchema, 'params'), groupsController.promoteMemberHandler);

export default router;
