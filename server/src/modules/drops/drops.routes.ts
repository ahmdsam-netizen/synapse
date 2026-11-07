import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createDropSchema,
  voteDropSchema,
  dropIdParamSchema,
  getDropsQuerySchema,
} from './drops.schema.js';
import * as dropsController from './drops.controller.js';

const router = Router();

router.get('/', requireAuth, validate(getDropsQuerySchema, 'query'), dropsController.getDropsHandler);
router.post('/', requireAuth, validate(createDropSchema), dropsController.createDropHandler);
router.post('/:id/vote', requireAuth, validate(dropIdParamSchema, 'params'), validate(voteDropSchema), dropsController.voteDropHandler);
router.delete('/:id', requireAuth, validate(dropIdParamSchema, 'params'), dropsController.deleteDropHandler);

export default router;
