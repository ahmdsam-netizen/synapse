import { createMaintenanceWorker } from './maintenance.js';

const maintenanceWorker = createMaintenanceWorker();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down BullMQ maintenance worker...');
  await maintenanceWorker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('BullMQ maintenance worker started, listening for jobs...');
