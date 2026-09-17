import { recommendationQueue } from '../config/queue.js';
async function setupSchedulers() {
    console.log('Setting up job schedulers...');
    // Hourly: refresh stale recommendations
    await recommendationQueue.upsertJobScheduler('refresh-stale-recs', { pattern: '0 * * * *' }, // Every hour at minute 0
    {
        name: 'refreshStaleRecs',
        data: {},
    });
    // Nightly (2 AM): compute similarity for active users
    await recommendationQueue.upsertJobScheduler('nightly-similarity', { pattern: '0 2 * * *' }, // 2 AM daily
    {
        name: 'nightlySimilarityBatch',
        data: {},
    });
    console.log('Job schedulers configured.');
}
setupSchedulers().catch(console.error);
//# sourceMappingURL=scheduler.js.map