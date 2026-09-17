import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { ZodError } from 'zod';
export const errorHandler = (err, _req, res, _next) => {
    // Zod validation errors
    if (err instanceof ZodError) {
        res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: err.issues,
        });
        return;
    }
    // Known application errors
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
            ...(err.name === 'ValidationError' && { details: err.details }),
        });
        return;
    }
    // Unknown errors
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
    });
};
//# sourceMappingURL=errorHandler.js.map