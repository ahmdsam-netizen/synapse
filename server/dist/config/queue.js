import { Queue } from 'bullmq';
import { env } from './env.js';
const connection = {
    host: new URL(env.REDIS_URL).hostname || 'localhost',
    port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};
export const recommendationQueue = new Queue('recommendations', {
    connection,
    defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});
//# sourceMappingURL=queue.js.map