import type { ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { ZodError } from 'zod';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
      ...(err.name === 'ValidationError' && { details: (err as any).details }),
    });
    return;
  }

  // Unknown errors
  console.error('Unhandled error:', err);
  // M-01: Always return a generic message — never expose internal details to
  // clients in production. Stack traces are only printed to server logs.
  res.status(500).json({
    error: env.NODE_ENV === 'development' ? (err.message || 'Internal server error') : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};
