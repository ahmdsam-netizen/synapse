import { z } from 'zod';

export const createCommunitySchema = z.object({
  name: z.string().trim().min(2, 'Community name must be at least 2 characters').max(100, 'Community name cannot exceed 100 characters'),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
});

export const communityIdParamSchema = z.object({
  id: z.string().uuid('Invalid community ID format'),
});

export const communitiesQuerySchema = z.object({
  q: z.string().trim().optional(),
});
