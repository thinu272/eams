/**
 * S3 Image Cleanup Scheduler
 * Runs periodically to delete old photos from S3
 */

const schedule = require('node-schedule');
const { cleanupOldImages } = require('../services/s3Service');

// Run cleanup at 2 AM every day
const cleanupSchedule = '0 2 * * *';

let cleanupJob = null;

/**
 * Initialize cleanup scheduler
 */
const initializeCleanupScheduler = () => {
  try {
    // Don't schedule if not in production or S3 not configured
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_S3_CLEANUP === 'true') {
      console.log('S3 cleanup scheduler disabled');
      return;
    }

    cleanupJob = schedule.scheduleJob(cleanupSchedule, async () => {
      try {
        console.log('[S3 Cleanup] Starting scheduled cleanup...');
        const ageInDays = parseInt(process.env.S3_CLEANUP_AGE_DAYS || '90', 10);
        const result = await cleanupOldImages(ageInDays);
        console.log(`[S3 Cleanup] Completed: ${result.deleted} deleted, ${result.failed} failed`);
      } catch (err) {
        console.error('[S3 Cleanup] Error:', err.message);
      }
    });

    console.log(`[S3 Cleanup] Scheduler initialized - cleanup at ${cleanupSchedule}`);
  } catch (err) {
    console.error('[S3 Cleanup] Failed to initialize scheduler:', err.message);
  }
};

/**
 * Stop cleanup scheduler
 */
const stopCleanupScheduler = () => {
  if (cleanupJob) {
    cleanupJob.cancel();
    console.log('[S3 Cleanup] Scheduler stopped');
  }
};

/**
 * Manually trigger cleanup (e.g., via admin endpoint)
 * @param {number} ageInDays - Age threshold in days
 * @returns {Promise<{deleted: number, failed: number}>}
 */
const triggerCleanupNow = async (ageInDays = 90) => {
  try {
    console.log('[S3 Cleanup] Manual cleanup triggered...');
    return await cleanupOldImages(ageInDays);
  } catch (err) {
    console.error('[S3 Cleanup] Manual cleanup failed:', err);
    throw err;
  }
};

module.exports = {
  initializeCleanupScheduler,
  stopCleanupScheduler,
  triggerCleanupNow,
};
