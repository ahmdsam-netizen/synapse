import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { searchLimiter } from '../../middleware/rateLimiter.js';
import { searchQuerySchema } from './search.schema.js';
import { searchUsersHandler } from './search.controller.js';

const router = Router();

router.get('/', requireAuth, searchLimiter, validate(searchQuerySchema, 'query'), searchUsersHandler);
router.get('/users', requireAuth, searchLimiter, validate(searchQuerySchema, 'query'), searchUsersHandler);

export default router;
