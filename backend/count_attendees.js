const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');
const Order = require('./src/models/Order');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const order = await Order.findOne().sort('-createdAt');
  if (order) {
    const tickets = await Ticket.find({ order: order._id }).lean();
    const withAttendee = tickets.filter(t => t.attendee).length;
    const withoutAttendee = tickets.filter(t => !t.attendee).length;
    console.log(`Order ID: ${order._id}`);
    console.log(`Summary: ${withAttendee} with attendee, ${withoutAttendee} without attendee`);
    if (tickets.length > 0) {
        console.log('Sample Ticket Keys:', Object.keys(tickets[0]));
    }
  }
  await mongoose.disconnect();
}

diagnose();
