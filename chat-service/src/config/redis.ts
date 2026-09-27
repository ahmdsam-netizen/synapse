import { Redis } from 'ioredis';
import { env } from './env.js';

export const pubClient = new Redis(env.REDIS_URL, {
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: null,
});

export const subClient = pubClient.duplicate();

pubClient.on('connect', () => {
  console.log(`[Chat Redis:${env.INSTANCE_ID}] Publisher connected to Redis`);
});

subClient.on('connect', () => {
  console.log(`[Chat Redis:${env.INSTANCE_ID}] Subscriber connected to Redis`);
});

pubClient.on('error', (err) => {
  console.error(`[Chat Redis:${env.INSTANCE_ID}] Publisher error:`, err.message);
});

subClient.on('error', (err) => {
  console.error(`[Chat Redis:${env.INSTANCE_ID}] Subscriber error:`, err.message);
});
