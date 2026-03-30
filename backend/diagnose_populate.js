const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');
const Order = require('./src/models/Order');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const order = await Order.findOne().sort('-createdAt');
  if (order) {
    const tickets = await Ticket.find({ order: order._id }).populate('attendee');
    console.log('TICKETS_WITH_POPULATED_ATTENDEES:');
    tickets.forEach(t => {
      console.log(`Ticket ${t._id}: Attendee=${t.attendee?._id}, Token=${t.attendee?.confirmationToken}`);
    });
  }
  await mongoose.disconnect();
}

diagnose();
