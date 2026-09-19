// Rate limiting is disabled for now
const passThrough = (_req, _res, next) => next();
export const signupLimiter = passThrough;
export const connectionRequestLimiter = passThrough;
export const joinRequestLimiter = passThrough;
export const searchLimiter = passThrough;
export const generalLimiter = passThrough;
//# sourceMappingURL=rateLimiter.js.map