const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Event = require('./models/Event');

const checkId = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const id = '69d5f34f0697526127cef03e';
    const event = await Event.findById(id);
    
    if (event) {
      console.log('EVENT_FOUND:', event.name);
    } else {
      console.log('EVENT_NOT_FOUND');
      const allEvents = await Event.find({}, '_id name');
      console.log('ALL_EVENTS:', JSON.stringify(allEvents, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

checkId();
