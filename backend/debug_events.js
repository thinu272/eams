const mongoose = require('mongoose');
const Event = require('./src/models/Event');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const events = await Event.find({});
  console.log('Total events:', events.length);
  events.forEach(e => {
    console.log(`- ${e.name} (ID: ${e._id}, Slug: ${e.slug}, Status: ${e.status}, End: ${e.endDate})`);
  });
  process.exit(0);
}
check();
