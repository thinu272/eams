const mongoose = require('mongoose');
const SystemConfig = require('./src/models/SystemConfig');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const config = await SystemConfig.findOne({ key: 'global' });
  console.log('System Config:', JSON.stringify(config, null, 2));
  process.exit(0);
}
check();
