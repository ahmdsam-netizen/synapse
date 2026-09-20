import { z } from 'zod';
export declare const createGroupSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    visibility: z.ZodEnum<{
        college: "college";
        global: "global";
    }>;
    maxMembers: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const updateGroupSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodEnum<{
        college: "college";
        global: "global";
    }>>;
    maxMembers: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    status: z.ZodOptional<z.ZodEnum<{
        closed: "closed";
        open: "open";
    }>>;
}, z.core.$strip>;
export declare const groupIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const removeMemberParamSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
}, z.core.$strip>;
export declare const inviteUserSchema: z.ZodObject<{
    userId: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const inviteIdParamSchema: z.ZodObject<{
    inviteId: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=groups.schema.d.ts.map