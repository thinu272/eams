const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');
const Attendee = require('./src/models/Attendee');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const attendee = await Attendee.findOne().sort('-createdAt');
  if (attendee) {
    console.log('FULL_ATTENDEE_OBJ:');
    console.log(JSON.stringify(attendee.toObject(), null, 2));
  } else {
    console.log('No attendees found');
  }
  await mongoose.disconnect();
}

diagnose();
