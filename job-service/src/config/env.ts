import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional().default('redis://localhost:6379'),
  VECTOR_DATABASE_URL: z.string().optional().default('postgresql://synapse:synapse_dev@localhost:5433/synapse_vectors'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
