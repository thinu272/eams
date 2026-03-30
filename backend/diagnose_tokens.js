const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');
const Attendee = require('./src/models/Attendee');
const Order = require('./src/models/Order');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const latestOrder = await Order.findOne().sort('-createdAt');
  if (!latestOrder) {
    console.log('No orders found');
    return;
  }
  console.log('Latest Order ID:', latestOrder._id);
  console.log('Latest Order confirmationLink:', latestOrder.confirmationLink);

  const tickets = await Ticket.find({ order: latestOrder._id }).populate('attendee');
  console.log(`Found ${tickets.length} tickets`);
  
  tickets.forEach((t, i) => {
    console.log(`Ticket ${i+1}:`);
    console.log(`  Attendee ID: ${t.attendee?._id || t.attendee}`);
    console.log(`  Attendee Name: ${t.attendee?.fullName}`);
    console.log(`  Attendee Token: ${t.attendee?.confirmationToken}`);
  });

  await mongoose.disconnect();
}

diagnose();
