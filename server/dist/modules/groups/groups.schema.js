import { z } from 'zod';
export const createGroupSchema = z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(2000).optional(),
    visibility: z.enum(['global', 'college']),
    maxMembers: z.coerce.number().min(2).max(100).optional().default(10)
});
export const updateGroupSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(2000).optional(),
    visibility: z.enum(['global', 'college']).optional(),
    maxMembers: z.coerce.number().min(2).max(100).optional(),
    status: z.enum(['open', 'closed']).optional()
});
export const groupIdParamSchema = z.object({
    id: z.string().uuid()
});
export const removeMemberParamSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid()
});
export const inviteUserSchema = z.object({
    userId: z.string().uuid(),
    note: z.string().max(1000).optional(),
});
export const inviteIdParamSchema = z.object({
    inviteId: z.string().uuid(),
});
//# sourceMappingURL=groups.schema.js.map