import { Router } from 'express';
import { signupHandler, loginHandler, refreshHandler, logoutHandler } from './auth.controller.js';
import { signupLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { signupSchema, loginSchema, refreshSchema } from './auth.schema.js';

const router = Router();

router.post('/signup', signupLimiter, validate(signupSchema), signupHandler);
router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.post('/logout', logoutHandler);

export default router;
