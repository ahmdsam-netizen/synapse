import rateLimit from 'express-rate-limit';

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many signup attempts, please try again later', code: 'RATE_LIMITED' },
});

export const connectionRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 50,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Daily connection request limit reached', code: 'RATE_LIMITED' },
});

export const joinRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Daily join request limit reached', code: 'RATE_LIMITED' },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60,
  keyGenerator: (req: any) => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many search requests', code: 'RATE_LIMITED' },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
