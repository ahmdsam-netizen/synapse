import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().optional().default(3001),
  CLIENT_URL: z.string().optional().default('http://localhost:5173'),

  // Downstream service targets
  CORE_SERVICE_URL: z.string({ error: 'CORE_SERVICE_URL is required' }),
  REC_SERVICE_URL: z.string({ error: 'REC_SERVICE_URL is required' }),

  // Comma-separated list of chat service URLs for consistent hashing
  // e.g. "http://chat1:4000,http://chat2:4000"
  CHAT_SERVICE_URLS: z.string({ error: 'CHAT_SERVICE_URLS is required' }),

  // C-04 / C-06: Must be at least 32 characters — no insecure defaults allowed.
  JWT_SECRET: z.string().min(32, { error: 'JWT_SECRET must be at least 32 characters' }),

  // C-03: Shared secret for gateway → service header verification.
  GATEWAY_SECRET: z.string().min(16, { error: 'GATEWAY_SECRET must be at least 16 characters' }),
});

export const env = envSchema.parse(process.env);

// Derived: parse the comma-separated chat URLs once, here.
export const CHAT_SERVICE_URLS = env.CHAT_SERVICE_URLS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export type Env = z.infer<typeof envSchema>;
