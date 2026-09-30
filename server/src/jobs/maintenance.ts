import { Queue } from 'bullmq';
import { env } from '../config/env.js';

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
