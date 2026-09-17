import { z } from 'zod';
export const createPostingSchema = z.object({
    groupId: z.string().uuid(),
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    rolesNeeded: z.array(z.string()).optional().default([]),
    requiredSkillIds: z.array(z.string().uuid()).optional().default([]),
    requiredInterestIds: z.array(z.string().uuid()).optional().default([]),
    slotsTotal: z.coerce.number().min(1).max(100).optional().default(5),
    expiresInHours: z.coerce.number().min(1).max(720).optional().default(72),
});
export const updatePostingSchema = z.object({
    title: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    rolesNeeded: z.array(z.string()).optional(),
    requiredSkillIds: z.array(z.string().uuid()).optional(),
    requiredInterestIds: z.array(z.string().uuid()).optional(),
    slotsTotal: z.coerce.number().min(1).max(100).optional(),
    expiresInHours: z.coerce.number().min(1).max(720).optional(),
});
export const postingIdParamSchema = z.object({
    id: z.string().uuid()
});
export const globalBoardQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(30).optional().default(30),
    skills: z.union([
        z.array(z.string()),
        z.string().transform(s => (s ? s.split(',').map(x => x.trim()).filter(Boolean) : []))
    ]).optional().default([]),
    interests: z.union([
        z.array(z.string()),
        z.string().transform(s => (s ? s.split(',').map(x => x.trim()).filter(Boolean) : []))
    ]).optional().default([]),
    collegeId: z.string().optional(),
    college: z.string().optional(),
});
export const matchedBoardQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(30).optional().default(30)
});
export const joinRequestSchema = z.object({
    message: z.string().max(500).optional()
});
export const joinRequestActionParamSchema = z.object({
    id: z.string().uuid()
});
export const groupRequestsQuerySchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional().default('pending')
});
//# sourceMappingURL=boards.schema.js.map