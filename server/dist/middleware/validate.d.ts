import type { RequestHandler } from 'express';
import { z } from 'zod';
type ValidationTarget = 'body' | 'query' | 'params';
export declare function validate(schema: z.ZodType, target?: ValidationTarget): RequestHandler;
export {};
//# sourceMappingURL=validate.d.ts.map