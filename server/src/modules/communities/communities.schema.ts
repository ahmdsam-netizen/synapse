import { z } from 'zod';

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, 'Community name must be at least 2 characters').max(100, 'Community name cannot exceed 100 characters'),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
  type: z.enum(['permanent', 'temporary']).optional().default('permanent'),
  durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day').max(365, 'Duration cannot exceed 365 days').optional().nullable(),
  maxMembers: z.coerce.number().min(2, 'Member limit must be at least 2').max(1000, 'Member limit cannot exceed 1,000 members').optional().default(1000),
});

export const communityIdParamSchema = z.object({
  id: z.string().uuid('Invalid community ID format'),
});

export const communitiesQuerySchema = z.object({
  q: z.string().trim().optional(),
});
