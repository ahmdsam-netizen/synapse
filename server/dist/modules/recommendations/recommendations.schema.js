import { z } from 'zod';
export const recQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(30).optional().default(30),
});
//# sourceMappingURL=recommendations.schema.js.map