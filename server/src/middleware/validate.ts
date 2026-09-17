import type { RequestHandler } from 'express';
import { z } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export function validate(
  schema: z.ZodType,
  target: ValidationTarget = 'body'
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      throw result.error; // Caught by errorHandler which handles ZodError
    }
    Object.defineProperty(req, target, {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}
