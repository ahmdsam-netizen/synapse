

import { setupMaintenanceScheduler } from './maintenance.js';

async function setupSchedulers() {
  console.log('Setting up job schedulers...');
  await setupMaintenanceScheduler();
  console.log('Job schedulers configured.');
}

setupSchedulers().catch(console.error);
