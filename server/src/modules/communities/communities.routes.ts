import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createCommunitySchema,
  communityIdParamSchema,
  communitiesQuerySchema,
} from './communities.schema.js';
import * as controller from './communities.controller.js';

const router = Router();

router.get('/', requireAuth, validate(communitiesQuerySchema, 'query'), controller.listHandler);
router.post('/', requireAuth, validate(createCommunitySchema), controller.createHandler);
router.get('/me', requireAuth, controller.getMyCommunitiesHandler);

router.get('/:id', requireAuth, validate(communityIdParamSchema, 'params'), controller.getDetailHandler);
router.post('/:id/join', requireAuth, validate(communityIdParamSchema, 'params'), controller.joinHandler);
router.post('/:id/leave', requireAuth, validate(communityIdParamSchema, 'params'), controller.leaveHandler);
router.delete('/:id', requireAuth, validate(communityIdParamSchema, 'params'), controller.deleteHandler);

export default router;
