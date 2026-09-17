import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    DATABASE_URL: z.string(),
    REDIS_URL: z.string().optional().default('redis://localhost:6379'),
    JWT_SECRET: z.string().min(32, { error: 'JWT_SECRET must be at least 32 characters' }),
    JWT_REFRESH_SECRET: z.string().min(32, { error: 'JWT_REFRESH_SECRET must be at least 32 characters' }),
    JWT_ACCESS_EXPIRY: z.string().optional().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().optional().default('7d'),
    PORT: z.coerce.number().optional().default(3001),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
    CLIENT_URL: z.string().optional().default('http://localhost:5173'),
});
export const env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map