import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

const connection = {
  host: new URL(env.REDIS_URL).hostname || 'localhost',
  port: parseInt(new URL(env.REDIS_URL).port || '6379', 10),
};

export const MAINTENANCE_QUEUE_NAME = 'maintenance';

export const maintenanceQueue = new Queue(MAINTENANCE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

/**
 * 1. Postings cleanup: deletes expired board postings
 */
export async function cleanupExpiredPostings(): Promise<number> {
  try {
    const deleted = await prisma.boardPosting.deleteMany({
      where: {
        expiresAt: {
          not: null,
          lte: new Date(),
        },
      },
    });
    if (deleted.count > 0) {
      console.log(`[BullMQ:Postings] Cleaned up ${deleted.count} expired board posting(s)`);
    }
    return deleted.count;
  } catch (err: any) {
    console.error('[BullMQ:Postings] Error cleaning up expired postings:', err.message);
    throw err;
  }
}

/**
 * 2. Groups cleanup: deletes expired non-community groups (cascades to members, postings, etc.)
 */
export async function cleanupExpiredGroups(): Promise<number> {
  try {
    const deleted = await prisma.group.deleteMany({
      where: {
        expiresAt: {
          not: null,
          lte: new Date(),
        },
        isCommunity: false,
      },
    });
    if (deleted.count > 0) {
      console.log(`[BullMQ:Groups] Cleaned up ${deleted.count} expired group(s)`);
    }
    return deleted.count;
  } catch (err: any) {
    console.error('[BullMQ:Groups] Error cleaning up expired groups:', err.message);
    throw err;
  }
}

/**
 * 3. Delete single posting by ID when delayed job fires
 */
export async function deleteSinglePosting(postingId: string): Promise<void> {
  try {
    const deleted = await prisma.boardPosting.deleteMany({
      where: {
        id: postingId,
        expiresAt: {
          not: null,
          lte: new Date(),
        },
      },
    });
    if (deleted.count > 0) {
      console.log(`[BullMQ:Postings] Deleted expired posting ${postingId} on schedule`);
    }
  } catch (err: any) {
    console.error(`[BullMQ:Postings] Error deleting expired posting ${postingId}:`, err.message);
  }
}

/**
 * 4. Delete single group by ID when delayed job fires
 */
export async function deleteSingleGroup(groupId: string): Promise<void> {
  try {
    const deleted = await prisma.group.deleteMany({
      where: {
        id: groupId,
        isCommunity: false,
        expiresAt: {
          not: null,
          lte: new Date(),
        },
      },
    });
    if (deleted.count > 0) {
      console.log(`[BullMQ:Groups] Deleted expired group ${groupId} on schedule`);
    }
  } catch (err: any) {
    console.error(`[BullMQ:Groups] Error deleting expired group ${groupId}:`, err.message);
  }
}

/**
 * Job processor router for the maintenance queue
 */
export async function processMaintenanceJob(job: Job): Promise<void> {
  switch (job.name) {
    case 'cleanup-postings':
      await cleanupExpiredPostings();
      break;
    case 'cleanup-groups':
      await cleanupExpiredGroups();
      break;
    case 'delete-single-posting':
      await deleteSinglePosting(job.data.postingId);
      break;
    case 'delete-single-group':
      await deleteSingleGroup(job.data.groupId);
      break;
    default:
      console.warn(`[BullMQ:Maintenance] Unrecognized job name: ${job.name}`);
  }
}

/**
 * Schedule precise delayed deletion for a specific board posting
 */
export async function schedulePostingExpiration(postingId: string, expiresAt: Date): Promise<void> {
  try {
    await cancelPostingExpiration(postingId);
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    await maintenanceQueue.add(
      'delete-single-posting',
      { postingId },
      {
        delay,
        jobId: `expire-posting-${postingId}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } catch (err: any) {
    console.error(`[BullMQ:Postings] Failed to schedule expiration for posting ${postingId}:`, err.message);
  }
}

/**
 * Cancel delayed deletion for a specific board posting
 */
export async function cancelPostingExpiration(postingId: string): Promise<void> {
  try {
    const job = await maintenanceQueue.getJob(`expire-posting-${postingId}`);
    if (job) {
      await job.remove();
    }
  } catch (err: any) {
    // Non-fatal if job does not exist
  }
}

/**
 * Schedule precise delayed deletion for a specific group
 */
export async function scheduleGroupExpiration(groupId: string, expiresAt: Date): Promise<void> {
  try {
    await cancelGroupExpiration(groupId);
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    await maintenanceQueue.add(
      'delete-single-group',
      { groupId },
      {
        delay,
        jobId: `expire-group-${groupId}`,
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } catch (err: any) {
    console.error(`[BullMQ:Groups] Failed to schedule expiration for group ${groupId}:`, err.message);
  }
}

/**
 * Cancel delayed deletion for a specific group
 */
export async function cancelGroupExpiration(groupId: string): Promise<void> {
  try {
    const job = await maintenanceQueue.getJob(`expire-group-${groupId}`);
    if (job) {
      await job.remove();
    }
  } catch (err: any) {
    // Non-fatal if job does not exist
  }
}

/**
 * Factory to create and attach event listeners to a maintenance worker
 */
export function createMaintenanceWorker(): Worker {
  const worker = new Worker(MAINTENANCE_QUEUE_NAME, processMaintenanceJob, {
    connection,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[BullMQ:Maintenance] Job ${job.name} [${job.id}] completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ:Maintenance] Job ${job?.name} [${job?.id}] failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[BullMQ:Maintenance] Worker error:', err.message);
  });

  return worker;
}

/**
 * Registers BullMQ repeatable jobs in Redis with cron expressions
 */
export async function setupMaintenanceScheduler(): Promise<void> {
  try {
    // Schedule: Postings cleanup every 10 minutes
    await maintenanceQueue.upsertJobScheduler(
      'cleanup-postings-scheduler',
      { pattern: '*/10 * * * *' },
      { name: 'cleanup-postings' }
    );

    // Schedule: Groups cleanup every 1 hour
    await maintenanceQueue.upsertJobScheduler(
      'cleanup-groups-scheduler',
      { pattern: '0 * * * *' },
      { name: 'cleanup-groups' }
    );

    console.log('[BullMQ:Maintenance] Repeatable cleanup schedules registered (postings: */10 * * * *, groups: 0 * * * *)');
  } catch (err: any) {
    console.error('[BullMQ:Maintenance] Error registering repeatable schedules:', err.message);
  }
}

/**
 * Initializes maintenance background processing:
 * 1. Runs initial cleanup immediately on startup
 * 2. Registers repeatable cron schedules in Redis
 * 3. Starts worker to consume maintenance jobs
 */
export async function initMaintenance(): Promise<{ worker: Worker }> {
  // Catch up on any expired items immediately
  cleanupExpiredPostings().catch((err) => console.error('[Maintenance] Initial postings cleanup error:', err.message));
  cleanupExpiredGroups().catch((err) => console.error('[Maintenance] Initial groups cleanup error:', err.message));

  // Configure BullMQ schedules
  await setupMaintenanceScheduler();

  // Spin up worker
  const worker = createMaintenanceWorker();

  return { worker };
}
