import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
    yearOfStudy: z.ZodOptional<z.ZodNumber>;
    branch: z.ZodOptional<z.ZodString>;
    lookingFor: z.ZodOptional<z.ZodEnum<{
        both: "both";
        event: "event";
        none: "none";
        project: "project";
    }>>;
    openToInvites: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const addSkillSchema: z.ZodObject<{
    skillId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    proficiency: z.ZodEnum<{
        advanced: "advanced";
        beginner: "beginner";
        intermediate: "intermediate";
    }>;
}, z.core.$strip>;
export declare const addInterestSchema: z.ZodObject<{
    interestId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const createWorkItemSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    techUsed: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    repoUrl: z.ZodOptional<z.ZodString>;
    liveUrl: z.ZodOptional<z.ZodString>;
    mediaUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateWorkItemSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    techUsed: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString>>>>;
    repoUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    liveUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    mediaUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const taxonomyQuerySchema: z.ZodObject<{
    q: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const userIdParamSchema: z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=users.schema.d.ts.map