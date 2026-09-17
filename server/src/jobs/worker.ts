import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { recommendationQueue } from '../config/queue.js';

const connection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};

async function processJob(job: Job) {
  console.log(`Processing job ${job.name} [${job.id}]`);
  
  switch (job.name) {
    case 'computeSecondDegree': {
      const { computeSecondDegreeJob } = await import('../modules/recommendations/secondDegree.worker.js');
      await computeSecondDegreeJob(job.data.userId, job.data.force ?? false);
      break;
    }
    case 'computeSimilarity': {
      const { computeSimilarityJob } = await import('../modules/recommendations/similarity.worker.js');
      await computeSimilarityJob(job.data.userId, job.data.force ?? false);
      break;
    }
    case 'computeSecondDegreeBatch': {
      // Fan out: enqueue computeSecondDegree for the user's direct connections
      const { rows } = await query(
        'SELECT friend_id FROM connection_edges WHERE user_id = $1 LIMIT 500',
        [job.data.userId]
      );
      const jobs = rows.map((r: any) => ({
        name: 'computeSecondDegree',
        data: { userId: r.friend_id, force: false },
        opts: { jobId: `sd-${r.friend_id}-${Date.now()}`, delay: 5000 },
      }));
      if (jobs.length > 0) {
        await recommendationQueue.addBulk(jobs);
      }
      break;
    }
    case 'refreshStaleRecs': {
      // Find users with stale recommendations who are recently active
      const { rows } = await query(`
        SELECT DISTINCT u.id FROM users u
        LEFT JOIN recommendations r ON r.user_id = u.id
        WHERE u.last_active > NOW() - INTERVAL '48 hours'
        AND (r.computed_at IS NULL OR r.computed_at < NOW() - INTERVAL '7 days')
        LIMIT 100
      `);
      const jobs = rows.flatMap((r: any) => [
        { name: 'computeSecondDegree', data: { userId: r.id, force: true }, opts: { jobId: `sd-stale-${r.id}` } },
        { name: 'computeSimilarity', data: { userId: r.id, force: true }, opts: { jobId: `sim-stale-${r.id}` } },
      ]);
      if (jobs.length > 0) {
        await recommendationQueue.addBulk(jobs);
      }
      console.log(`Enqueued stale rec refresh for ${rows.length} users`);
      break;
    }
    default:
      console.warn(`Unknown job name: ${job.name}`);
  }
}

const worker = new Worker('recommendations', processJob, {
  connection,
  concurrency: 5,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

worker.on('completed', (job) => {
  console.log(`Job ${job.name} [${job.id}] completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.name} [${job?.id}] failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down worker...');
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('BullMQ worker started, listening for jobs...');
