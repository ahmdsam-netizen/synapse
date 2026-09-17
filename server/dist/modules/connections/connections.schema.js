import { z } from 'zod';
export const sendRequestSchema = z.object({
    receiverId: z.string().uuid(),
});
export const connectionIdParamSchema = z.object({
    id: z.string().uuid(),
});
export const connectionsQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).optional().default(30),
});
export const mutualParamSchema = z.object({
    userId: z.string().uuid(),
});
//# sourceMappingURL=connections.schema.js.map