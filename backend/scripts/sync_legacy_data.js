'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../src/utils/logger'); // assumes .info/.warn/.error API
const connectDB = require('../src/config/database'); // assumes connectDB(): Promise<void>
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Company = require('../src/models/Company');

const LEGACY_COMPANY_NAME = 'Legacy Organization';
const DEFAULT_BATCH_SIZE = 500;

// WARNING: these are placeholder values. If Company.officialEmail /
// paymentContact / bankDetails ever surface in real invoices or bank
// transfer instructions (see PROJECT_SCOPE.md §5.4), someone needs to
// replace these with real org details after running this script —
// or better, pass them in via env vars before running in production.
const LEGACY_COMPANY_DEFAULTS = {
  name: LEGACY_COMPANY_NAME,
  registeredBusinessName: LEGACY_COMPANY_NAME,
  organizationType: 'NGO',
  status: 'Active',
  primaryContactPerson: 'System Administrator',
  officialEmail: process.env.LEGACY_COMPANY_EMAIL || 'admin@legacy.org',
  officialPhone: process.env.LEGACY_COMPANY_PHONE || '0000000000',
  isProfitable: false,
  registeredAddress: 'System Default Address',
  contactNumber: process.env.LEGACY_COMPANY_PHONE || '0000000000',
  designation: 'Admin',
  invoiceEmail: process.env.LEGACY_COMPANY_EMAIL || 'admin@legacy.org',
  paymentContact: 'System Admin',
  bankDetails: 'N/A',
};

const MISSING_COMPANY_FILTER = { company: { $in: [null, undefined] } };

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const batchArg = argv.find((arg) => arg.startsWith('--batch-size='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : DEFAULT_BATCH_SIZE;

  if (Number.isNaN(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid --batch-size value: "${batchArg}"`);
  }

  return { dryRun, batchSize };
}

async function ensureLegacyCompany({ dryRun }) {
  let company = await Company.findOne({ name: LEGACY_COMPANY_NAME });

  if (!company) {
    logger.info(`Creating "${LEGACY_COMPANY_NAME}" company`);
    if (!dryRun) {
      company = await Company.create(LEGACY_COMPANY_DEFAULTS);
    } else {
      company = { _id: 'DRY-RUN-ID' };
    }
  } else {
    logger.info(`"${LEGACY_COMPANY_NAME}" already exists (${company._id})`);
  }

  return company;
}

async function assignCompanyToOrganisers({ dryRun }, companyId) {
  const filter = { role: { $in: ['MainOrganiser', 'SubOrganiser'] }, ...MISSING_COMPANY_FILTER };
  const count = await User.countDocuments(filter);

  if (count === 0) {
    logger.info('No organisers missing a company — skipping');
    return 0;
  }

  logger.info(`${count} organiser(s) missing a company`);
  if (!dryRun) {
    await User.updateMany(filter, { $set: { company: companyId } });
  }
  return count;
}

async function assignCompanyToEvents({ dryRun }, companyId) {
  const count = await Event.countDocuments(MISSING_COMPANY_FILTER);

  if (count === 0) {
    logger.info('No events missing a company — skipping');
    return 0;
  }

  logger.info(`${count} event(s) missing a company`);
  if (!dryRun) {
    await Event.updateMany(MISSING_COMPANY_FILTER, { $set: { company: companyId } });
  }
  return count;
}

// Backfills Event.mainOrganisers[] from the legacy singular Event.mainOrganiser
// field, for events that predate the pluralization.
async function migrateSingularToPluralOrganiser({ dryRun, batchSize }) {
  const filter = {
    mainOrganiser: { $exists: true, $ne: null },
    $or: [{ mainOrganisers: { $exists: false } }, { mainOrganisers: { $size: 0 } }],
  };

  const cursor = Event.find(filter, '_id mainOrganiser').lean().cursor();
  let pendingOps = [];
  let updated = 0;

  const flush = async () => {
    if (pendingOps.length === 0) return;
    if (!dryRun) await Event.bulkWrite(pendingOps, { ordered: false });
    updated += pendingOps.length;
    pendingOps = [];
  };

  for await (const event of cursor) {
    pendingOps.push({
      updateOne: {
        filter: { _id: event._id },
        update: { $set: { mainOrganisers: [event.mainOrganiser] } },
      },
    });
    if (pendingOps.length >= batchSize) await flush();
  }
  await flush();

  return updated;
}

async function run() {
  const { dryRun, batchSize } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGO_URI) {
    logger.error('MONGO_URI is not set. Aborting.');
    process.exitCode = 2;
    return;
  }

  logger.info(`sync_legacy_data starting${dryRun ? ' (dry run)' : ''}`);
  await connectDB();

  try {
    const company = await ensureLegacyCompany({ dryRun });
    const organisersUpdated = await assignCompanyToOrganisers({ dryRun }, company._id);
    const eventsUpdated = await assignCompanyToEvents({ dryRun }, company._id);
    const organiserFieldMigrated = await migrateSingularToPluralOrganiser({ dryRun, batchSize });

    logger.info(
      `Summary: organisersUpdated=${organisersUpdated}, eventsUpdated=${eventsUpdated}, ` +
      `mainOrganiserFieldMigrated=${organiserFieldMigrated}`
    );
    logger.info(dryRun ? 'Dry run complete — no changes written.' : 'Sync completed successfully.');
  } catch (err) {
    logger.error(`Sync failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();