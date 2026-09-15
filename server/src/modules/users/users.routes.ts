import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  getMeHandler,
  updateProfileHandler,
  addSkillHandler,
  removeSkillHandler,
  addInterestHandler,
  removeInterestHandler,
  createWorkItemHandler,
  updateWorkItemHandler,
  deleteWorkItemHandler,
  searchSkillsHandler,
  searchInterestsHandler,
  getProfileHandler
} from './users.controller';
import {
  updateProfileSchema,
  addSkillSchema,
  addInterestSchema,
  createWorkItemSchema,
  updateWorkItemSchema,
  taxonomyQuerySchema,
  userIdParamSchema
} from './users.schema';

const router = Router();

router.get('/me', requireAuth, getMeHandler);
router.put('/me', requireAuth, validate(updateProfileSchema), updateProfileHandler);

router.post('/me/skills', requireAuth, validate(addSkillSchema), addSkillHandler);
router.delete('/me/skills/:skillId', requireAuth, removeSkillHandler);

router.post('/me/interests', requireAuth, validate(addInterestSchema), addInterestHandler);
router.delete('/me/interests/:interestId', requireAuth, removeInterestHandler);

router.post('/me/work', requireAuth, validate(createWorkItemSchema), createWorkItemHandler);
router.put('/me/work/:id', requireAuth, validate(updateWorkItemSchema), updateWorkItemHandler);
router.delete('/me/work/:id', requireAuth, deleteWorkItemHandler);

router.get('/skills', validate(taxonomyQuerySchema, 'query'), searchSkillsHandler);
router.get('/interests', validate(taxonomyQuerySchema, 'query'), searchInterestsHandler);

router.get('/:id', requireAuth, validate(userIdParamSchema, 'params'), getProfileHandler);

export default router;
