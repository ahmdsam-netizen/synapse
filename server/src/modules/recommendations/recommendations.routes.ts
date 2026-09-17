import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { getSecondDegreeHandler, getSimilarityHandler } from './recommendations.controller.js';
import { recQuerySchema } from './recommendations.schema.js';

const router = Router();

router.get('/second-degree', requireAuth, validate(recQuerySchema, 'query'), getSecondDegreeHandler);
router.get('/similarity', requireAuth, validate(recQuerySchema, 'query'), getSimilarityHandler);

export default router;
