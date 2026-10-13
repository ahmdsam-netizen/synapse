import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { query, deleteBoardVectors } from '../config/database.js';

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
 * 1. Postings periodic sweep: deletes expired board postings and their vector embeddings
 */
export async function cleanupExpiredPostings(): Promise<number> {
  try {
    const result = await query<{ id: string }>(
      `DELETE FROM board_postings WHERE expires_at IS NOT NULL AND expires_at <= NOW() RETURNING id`
    );
    const count = result.rowCount || 0;
    const deletedIds = (result.rows || []).map((r) => r.id);

    if (deletedIds.length > 0) {
      const vecCount = await deleteBoardVectors(deletedIds);
      console.log(`[JobService:Postings] Cleaned up ${count} expired board posting(s) and ${vecCount} vector embedding(s)`);
    }
    return count;
  } catch (err: any) {
    console.error('[JobService:Postings] Error cleaning up expired postings:', err.message);
    throw err;
  }
}

/**
 * 2. Groups periodic sweep: deletes expired non-community groups, their postings, and their vector embeddings
 */
export async function cleanupExpiredGroups(): Promise<number> {
  try {
    // 1. Fetch all posting IDs belonging to the groups about to be expired
    const postingsResult = await query<{ id: string }>(
      `SELECT bp.id FROM board_postings bp
       JOIN groups g ON bp.group_id = g.id
       WHERE g.expires_at IS NOT NULL AND g.expires_at <= NOW() AND g.is_community = FALSE`
    );
    const postingIds = (postingsResult.rows || []).map((r) => r.id);

    // 2. Delete the expired groups (PostgreSQL CASCADE foreign key removes board_postings in primary DB)
    const result = await query(
      `DELETE FROM groups WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND is_community = FALSE`
    );
    const count = result.rowCount || 0;

    // 3. Delete vector embeddings directly from vector database
    if (postingIds.length > 0) {
      const vecCount = await deleteBoardVectors(postingIds);
      console.log(`[JobService:Groups] Cleaned up ${count} expired group(s), along with ${postingIds.length} posting(s) and ${vecCount} vector embedding(s)`);
    } else if (count > 0) {
      console.log(`[JobService:Groups] Cleaned up ${count} expired group(s)`);
    }

    return count;
  } catch (err: any) {
    console.error('[JobService:Groups] Error cleaning up expired groups:', err.message);
    throw err;
  }
}

/**
 * 3. Delete single posting by ID when delayed job fires on exact second, and delete its vector embedding
 */
export async function deleteSinglePosting(postingId: string): Promise<void> {
  try {
    const result = await query(
      `DELETE FROM board_postings WHERE id = $1 AND expires_at IS NOT NULL AND expires_at <= NOW()`,
      [postingId]
    );
    if ((result.rowCount || 0) > 0) {
      await deleteBoardVectors([postingId]);
      console.log(`[JobService:Postings] Deleted expired posting ${postingId} and its vector embedding right on schedule`);
    }
  } catch (err: any) {
    console.error(`[JobService:Postings] Error deleting expired posting ${postingId}:`, err.message);
  }
}

/**
 * 4. Delete single group by ID when delayed job fires on exact second, and delete all its postings' vector embeddings
 */
export async function deleteSingleGroup(groupId: string): Promise<void> {
  try {
    // 1. Fetch all posting IDs under this group before deletion
    const postingsResult = await query<{ id: string }>(
      `SELECT id FROM board_postings WHERE group_id = $1`,
      [groupId]
    );
    const postingIds = (postingsResult.rows || []).map((r) => r.id);

    // 2. Delete group (cascades board_postings in primary DB)
    const result = await query(
      `DELETE FROM groups WHERE id = $1 AND is_community = FALSE AND expires_at IS NOT NULL AND expires_at <= NOW()`,
      [groupId]
    );

    // 3. Delete vector embeddings for all postings that belonged to this group
    if ((result.rowCount || 0) > 0) {
      if (postingIds.length > 0) {
        await deleteBoardVectors(postingIds);
      }
      console.log(`[JobService:Groups] Deleted expired group ${groupId} and ${postingIds.length} posting vector embedding(s) right on schedule`);
    }
  } catch (err: any) {
    console.error(`[JobService:Groups] Error deleting expired group ${groupId}:`, err.message);
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
      console.warn(`[JobService:Maintenance] Unrecognized job name: ${job.name}`);
  }
}

/**
 * Factory to create and attach event listeners to a maintenance worker
 */
export function createMaintenanceWorker() {
  const worker = new Worker(MAINTENANCE_QUEUE_NAME, processMaintenanceJob, {
    connection,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    console.log(`[JobService:Maintenance] Job ${job.name} [${job.id}] completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[JobService:Maintenance] Job ${job?.name} [${job?.id}] failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[JobService:Maintenance] Worker error:', err.message);
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

    console.log('[JobService:Maintenance] Repeatable cleanup schedules registered (postings: */10 * * * *, groups: 0 * * * *)');
  } catch (err: any) {
    console.error('[JobService:Maintenance] Error registering repeatable schedules:', err.message);
  }
}

/**
 * Initializes maintenance background processing:
 * 1. Runs initial cleanup immediately on startup
 * 2. Registers repeatable cron schedules in Redis
 * 3. Starts worker to consume maintenance jobs
 */
export async function initMaintenance() {
  // Catch up on any expired items immediately
  cleanupExpiredPostings().catch((err) => console.error('[JobService] Initial postings cleanup error:', err.message));
  cleanupExpiredGroups().catch((err) => console.error('[JobService] Initial groups cleanup error:', err.message));

  // Configure BullMQ schedules
  await setupMaintenanceScheduler();

  // Spin up worker
  const worker = createMaintenanceWorker();

  return { worker };
}
