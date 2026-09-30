import { env } from './env.js';
export { maintenanceQueue } from '../jobs/maintenance.js';

export const queueConnection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};
