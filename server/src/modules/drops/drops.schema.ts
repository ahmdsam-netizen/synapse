import { z } from 'zod';

export const createDropSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Drop content cannot be empty')
    .max(500, 'Drop cannot exceed 500 characters'),
});

export const voteDropSchema = z.object({
  voteType: z.enum(['up', 'down']),
});

export const dropIdParamSchema = z.object({
  id: z.string().uuid('Invalid drop ID format'),
});

export const getDropsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});
