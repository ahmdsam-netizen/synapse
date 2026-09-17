import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().optional().default(''),
  skills: z.union([
    z.array(z.string()),
    z.string().transform(s => (s ? s.split(',').map(x => x.trim()).filter(Boolean) : []))
  ]).optional().default([]),
  interests: z.union([
    z.array(z.string()),
    z.string().transform(s => (s ? s.split(',').map(x => x.trim()).filter(Boolean) : []))
  ]).optional().default([]),
  matchMode: z.enum(['any', 'all']).optional().default('any'),
  collegeId: z.string().optional(),
  college: z.string().optional(),
  year: z.coerce.number().int().min(1).max(6).optional(),
  lookingFor: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(30),
});
