'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const logger = require('../src/utils/logger'); // assumes .info/.warn/.error API
const connectDB = require('../src/config/database'); // assumes connectDB(): Promise<void>
const User = require('../src/models/User');

// Canonical role set per PROJECT_SCOPE.md §4.1 — update here if the hierarchy changes.
const VALID_ROLES = [
  'MainAdmin',
  'MainOrganiser',
  'SubOrganiser',
  'Staff',
  'Volunteer',
  'Auditor',
  'Sponsor',
  'Attendee',
];

async function checkRoles() {
  await connectDB();

  const users = await User.find({}, 'name role').lean();

  const counts = {};
  const invalid = [];

  for (const user of users) {
    counts[user.role] = (counts[user.role] || 0) + 1;
    if (!VALID_ROLES.includes(user.role)) {
      invalid.push(user);
    }
  }

  logger.info(`Total users: ${users.length}`);
  logger.info('Role counts:');
  for (const [role, count] of Object.entries(counts)) {
    logger.info(`  ${role || '(none)'}: ${count}`);
  }

  if (invalid.length > 0) {
    logger.warn(`Found ${invalid.length} user(s) with unrecognized/un-normalized role values:`);
    invalid.forEach((u) => logger.warn(`  - ${u.name} (${u._id}): "${u.role}"`));
  } else {
    logger.info('All user roles match the expected role set.');
  }

  return invalid.length;
}

checkRoles()
  .then((invalidCount) => {
    process.exitCode = invalidCount > 0 ? 1 : 0;
  })
  .catch((err) => {
    logger.error(`check_roles failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });