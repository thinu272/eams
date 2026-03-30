const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const ticketWithAttendee = await Ticket.findOne({ attendee: { $ne: null } }).populate('attendee').lean();
  if (ticketWithAttendee) {
    console.log('FOUND_TICKET_WITH_ATTENDEE:');
    console.log(JSON.stringify(ticketWithAttendee, null, 2));
  } else {
    console.log('NO TICKETS FOUND WITH ATTENDEE FIELD');
    const allTicketsCount = await Ticket.countDocuments();
    console.log(`Total Tickets in DB: ${allTicketsCount}`);
  }
  await mongoose.disconnect();
}

diagnose();
