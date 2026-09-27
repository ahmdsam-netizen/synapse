import dotenv from 'dotenv';

dotenv.config();

// C-06 / C-14: Fail fast if critical secrets are not explicitly set.
// Never fall back to hardcoded defaults — that would allow anyone with
// source-code access to forge tokens or connect to the database.
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'] as const;
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`[Chat Service] FATAL: Required env var "${key}" is not set. Refusing to start.`);
    process.exit(1);
  }
}

if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
  console.error('[Chat Service] FATAL: JWT_SECRET must be at least 32 characters. Refusing to start.');
  process.exit(1);
}

export const env = {
  PORT: parseInt(process.env.PORT || '4001', 10),
  INSTANCE_ID: process.env.INSTANCE_ID || 'chat-1',
  DATABASE_URL: process.env.DATABASE_URL as string,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET as string,
  GATEWAY_SECRET: process.env.GATEWAY_SECRET || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
