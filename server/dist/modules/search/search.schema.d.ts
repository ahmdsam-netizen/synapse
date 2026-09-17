import { z } from 'zod';
export declare const searchQuerySchema: z.ZodObject<{
    q: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    skills: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>]>>>;
    interests: z.ZodDefault<z.ZodOptional<z.ZodUnion<readonly [z.ZodArray<z.ZodString>, z.ZodPipe<z.ZodString, z.ZodTransform<string[], string>>]>>>;
    matchMode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        all: "all";
        any: "any";
    }>>>;
    collegeId: z.ZodOptional<z.ZodString>;
    college: z.ZodOptional<z.ZodString>;
    year: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    lookingFor: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
//# sourceMappingURL=search.schema.d.ts.map