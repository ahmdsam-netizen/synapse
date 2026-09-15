import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { connectionRequestLimiter } from '../../middleware/rateLimiter.js';
import * as controllers from './connections.controller.js';
import {
  sendRequestSchema,
  connectionIdParamSchema,
  connectionsQuerySchema,
  mutualParamSchema,
} from './connections.schema.js';

const router = Router();

// Place specific routes BEFORE dynamic /:id routes
router.post('/request', requireAuth, connectionRequestLimiter, validate(sendRequestSchema), controllers.sendRequestHandler);
router.get('/', requireAuth, validate(connectionsQuerySchema, 'query'), controllers.listHandler);
router.get('/pending', requireAuth, controllers.pendingHandler);
router.get('/mutual/:userId', requireAuth, validate(mutualParamSchema, 'params'), controllers.mutualHandler);

router.post('/:id/accept', requireAuth, validate(connectionIdParamSchema, 'params'), controllers.acceptHandler);
router.post('/:id/decline', requireAuth, validate(connectionIdParamSchema, 'params'), controllers.declineHandler);
router.delete('/:id', requireAuth, validate(connectionIdParamSchema, 'params'), controllers.removeHandler);

export default router;
