'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../../src/utils/logger'); // assumes .info/.warn/.error API
const connectDB = require('../../src/config/database'); // assumes connectDB(): Promise<void>
const SystemConfig = require('../../src/models/SystemConfig');
const Event = require('../../src/models/Event');

const MIGRATION_NAME = 'seed-email-and-event-defaults';
const DEFAULT_BATCH_SIZE = 500;
const SYSTEM_CONFIG_KEY = 'global';

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const batchArg = argv.find((arg) => arg.startsWith('--batch-size='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : DEFAULT_BATCH_SIZE;

  if (Number.isNaN(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch-size value: "${batchArg}"`);
  }

  return { dryRun, batchSize };
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function ensureSystemConfigDefaults({ dryRun }) {
  const config = await SystemConfig.findOne({ key: SYSTEM_CONFIG_KEY }).lean();

  if (!config) {
    logger.info(`[${MIGRATION_NAME}] Creating global SystemConfig with email.enabled=true`);
    if (!dryRun) await SystemConfig.create({ key: SYSTEM_CONFIG_KEY, email: { enabled: true } });
    return true;
  }

  if (config.email?.enabled === undefined) {
    logger.info(`[${MIGRATION_NAME}] Setting SystemConfig.email.enabled=true`);
    if (!dryRun) {
      await SystemConfig.updateOne({ _id: config._id }, { $set: { 'email.enabled': true } });
    }
    return true;
  }

  logger.info(`[${MIGRATION_NAME}] SystemConfig.email.enabled already set (${config.email.enabled})`);
  return false;
}

// Returns a bulkWrite op for fields the event is missing, or null if none needed.
function buildEventPatch(event) {
  const settings = event.settings || {};
  const channels = settings.communicationChannels || {};
  const setFields = {};

  if (channels.email === undefined) setFields['settings.communicationChannels.email'] = true;
  if (channels.sms === undefined) setFields['settings.communicationChannels.sms'] = false;
  if (settings.requiresPhotoVerification === undefined) setFields['settings.requiresPhotoVerification'] = true;

  if (Object.keys(setFields).length === 0) return null;

  return { updateOne: { filter: { _id: event._id }, update: { $set: setFields } } };
}

async function ensureEventDefaults({ dryRun, batchSize }) {
  const stats = { scanned: 0, updated: 0, skipped: 0, failedBatches: 0 };
  const cursor = Event.find({}, '_id settings').lean().cursor();
  let pendingOps = [];

  const flush = async () => {
    if (pendingOps.length === 0) return;
    for (const batch of chunk(pendingOps, batchSize)) {
      try {
        if (!dryRun) await Event.bulkWrite(batch, { ordered: false });
        stats.updated += batch.length;
      } catch (err) {
        stats.failedBatches += 1;
        logger.error(`[${MIGRATION_NAME}] Batch write failed (${batch.length} ops): ${err.message}`);
      }
    }
    pendingOps = [];
  };

  for await (const event of cursor) {
    stats.scanned += 1;
    const op = buildEventPatch(event);

    if (!op) {
      stats.skipped += 1;
      continue;
    }

    pendingOps.push(op);
    if (pendingOps.length >= batchSize) await flush();
  }

  await flush();
  return stats;
}

async function run() {
  const { dryRun, batchSize } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGO_URI) {
    logger.error(`[${MIGRATION_NAME}] MONGO_URI is not set. Aborting.`);
    process.exitCode = 2;
    return;
  }

  logger.info(`[${MIGRATION_NAME}] Starting${dryRun ? ' (dry run)' : ''} — batchSize=${batchSize}`);
  await connectDB();

  try {
    const configChanged = await ensureSystemConfigDefaults({ dryRun });
    const eventStats = await ensureEventDefaults({ dryRun, batchSize });

    logger.info(`[${MIGRATION_NAME}] Summary: configChanged=${configChanged}, ` +
      `scanned=${eventStats.scanned}, updated=${eventStats.updated}, ` +
      `skipped=${eventStats.skipped}, failedBatches=${eventStats.failedBatches}`);

    process.exitCode = eventStats.failedBatches > 0 ? 1 : 0;
  } catch (err) {
    logger.error(`[${MIGRATION_NAME}] Migration failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();