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

  // Unknown / unhandled errors
  console.error('Unhandled error:', err);

  // Check if error is an internal database/query error (Prisma, Postgres, SQL)
  const errName = typeof err?.name === 'string' ? err.name : '';
  const errMsg = typeof err?.message === 'string' ? err.message : '';
  const isDatabaseError =
    errName.includes('Prisma') ||
    errMsg.includes('prisma') ||
    errMsg.includes('$queryRaw') ||
    errMsg.includes('syntax error') ||
    errMsg.includes('operator does not exist') ||
    err?.code === '42883';

  const userFacingMessage = isDatabaseError
    ? 'A database error occurred while processing your request. Please try again later.'
    : (env.NODE_ENV === 'development' ? (errMsg || 'Internal server error') : 'Internal server error');

  res.status(500).json({
    error: userFacingMessage,
    code: isDatabaseError ? 'DATABASE_ERROR' : 'INTERNAL_ERROR',
  });
};
