const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');
const Order = require('./src/models/Order');

dotenv.config();

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const order = await Order.findOne().sort('-createdAt');
  if (order) {
    const rawTickets = await Ticket.find({ order: order._id }).lean();
    console.log('RAW_TICKETS:');
    console.log(JSON.stringify(rawTickets, null, 2));
  }
  await mongoose.disconnect();
}

diagnose();
