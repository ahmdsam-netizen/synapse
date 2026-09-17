import { z } from 'zod';
export declare const createPostingSchema: z.ZodObject<{
    groupId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    rolesNeeded: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    requiredSkillIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    requiredInterestIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    slotsTotal: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    expiresInHours: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const updatePostingSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    rolesNeeded: z.ZodOptional<z.ZodArray<z.ZodString>>;
    requiredSkillIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    requiredInterestIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    slotsTotal: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    expiresInHours: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const postingIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const globalBoardQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    skills: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>]>>>;
    interests: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>]>>>;
    collegeId: z.ZodOptional<z.ZodString>;
    college: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const matchedBoardQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const joinRequestSchema: z.ZodObject<{
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const joinRequestActionParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
export declare const groupRequestsQuerySchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        approved: "approved";
        pending: "pending";
        rejected: "rejected";
    }>>>;
}, z.core.$strip>;
//# sourceMappingURL=boards.schema.d.ts.map