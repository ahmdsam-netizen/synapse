import 'dotenv/config';
import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    JWT_SECRET: z.ZodString;
    JWT_REFRESH_SECRET: z.ZodString;
    JWT_ACCESS_EXPIRY: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    JWT_REFRESH_EXPIRY: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    PORT: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    NODE_ENV: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>>;
    CLIENT_URL: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const env: {
    DATABASE_URL: string;
    REDIS_URL: string;
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
    CLIENT_URL: string;
};
export type Env = z.infer<typeof envSchema>;
export {};
//# sourceMappingURL=env.d.ts.map