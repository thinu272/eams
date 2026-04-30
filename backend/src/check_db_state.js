const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('./models/User');
const Event = require('./models/Event');

const checkDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'email role assignedEvents').lean();
    const events = await Event.find({}, 'name createdBy mainOrganiser').lean();
    
    console.log('--- DB STATE ---');
    console.log('USERS:', JSON.stringify(users, null, 2));
    console.log('EVENTS:', JSON.stringify(events, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkDb();
