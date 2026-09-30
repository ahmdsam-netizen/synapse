import { initMaintenance } from './jobs/maintenance.js';
import { pool } from './config/database.js';

console.log('[JobService] Starting Synapse Background Job Service...');

const { worker } = await initMaintenance();

// Graceful shutdown handling
const shutdown = async (signal: string) => {
  console.log(`[JobService] Received ${signal}. Shutting down worker...`);
  try {
    await worker.close();
    await pool.end();
    console.log('[JobService] Worker and database pool closed cleanly.');
    process.exit(0);
  } catch (err: any) {
    console.error('[JobService] Error during shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log('[JobService] Background Job Service is active, schedules registered, and listening for jobs.');
