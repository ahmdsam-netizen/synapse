import { Router } from 'express';
import { signupHandler, loginHandler, refreshHandler, logoutHandler } from './auth.controller.js';
import { signupLimiter, loginLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { signupSchema, loginSchema, refreshSchema } from './auth.schema.js';

const router = Router();

router.post('/signup', signupLimiter, validate(signupSchema), signupHandler);
router.post('/login', loginLimiter, validate(loginSchema), loginHandler);
router.post('/refresh', loginLimiter, validate(refreshSchema), refreshHandler);
router.post('/logout', logoutHandler);

export default router;
