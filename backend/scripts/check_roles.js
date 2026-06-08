const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const checkRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}).select('role name').lean();
    console.log('User roles in DB:');
    users.forEach(u => console.log(`- ${u.name}: ${u.role}`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkRoles();
