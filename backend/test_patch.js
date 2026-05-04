require('dotenv').config();
const mongoose = require('mongoose');
const SystemConfig = require('./src/models/SystemConfig');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const setQuery = { 'general.platformName': 'ENTRYNEX' };
    const current = await SystemConfig.findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: { key: 'global' }, $set: setQuery },
      { new: true, upsert: true }
    );
    console.log('Success:', current);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit();
}

test();
