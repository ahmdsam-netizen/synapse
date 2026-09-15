import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(2000).optional(),
  avatarUrl: z.string().url().optional(),
  yearOfStudy: z.number().min(1).max(6).optional(),
  branch: z.string().max(100).optional(),
  lookingFor: z.enum(['project', 'event', 'both', 'none']).optional(),
});

export const addSkillSchema = z.object({
  skillId: z.string().uuid(),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced'])
});

export const addInterestSchema = z.object({
  interestId: z.string().uuid()
});

export const createWorkItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  techUsed: z.array(z.string()).optional().default([]),
  repoUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  mediaUrl: z.string().url().optional()
});

export const updateWorkItemSchema = createWorkItemSchema.partial();

export const taxonomyQuerySchema = z.object({
  q: z.string().optional().default('')
});

export const userIdParamSchema = z.object({
  id: z.string().uuid()
});
