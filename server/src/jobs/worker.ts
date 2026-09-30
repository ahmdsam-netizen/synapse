import { Worker, Job } from 'bullmq';
import { env } from '../config/env.js';

const connection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(env.REDIS_URL).port || '6379'),
};

async function processJob(job: Job) {
  // Legacy recommendation jobs are superseded by Python vector microservice
  console.log(`[Worker] Handled background job: ${job.name} [${job.id}]`);
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
