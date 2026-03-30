const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Attendee = require('./src/models/Attendee');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const attendeeCount = await Attendee.countDocuments();
  console.log(`Total Attendees in DB: ${attendeeCount}`);
  
  const latestAttendee = await Attendee.findOne().sort('-createdAt').lean();
  console.log('Latest Attendee:', JSON.stringify(latestAttendee, null, 2));

  await mongoose.disconnect();
}

diagnose();
