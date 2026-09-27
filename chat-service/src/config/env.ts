import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '4001', 10),
  INSTANCE_ID: process.env.INSTANCE_ID || 'chat-1',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://synapse:synapse_dev@localhost:5432/synapse',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-jwt-key-minimum-32-characters-dev-key',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
