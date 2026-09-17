import { z } from 'zod';
export declare const sendRequestSchema: z.ZodObject<{
    receiverId: z.ZodString;
}, z.core.$strip>;
export declare const connectionIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const connectionsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const mutualParamSchema: z.ZodObject<{
    userId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=connections.schema.d.ts.map