require('dotenv').config();
const mongoose = require('mongoose');

const checkConfig = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/entrynex');
    const config = await mongoose.connection.db.collection('systemconfigs').findOne();
    console.log('DB CONFIG:', JSON.stringify(config, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkConfig();
