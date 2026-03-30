const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ticket = require('./src/models/Ticket');
const Attendee = require('./src/models/Attendee');
const Order = require('./src/models/Order');
const Event = require('./src/models/Event');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://eams_db_user:Fab3JzfDqeFXuZMN@ac-eibrjtr-shard-00-00.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-01.qsnrhfu.mongodb.net:27017,ac-eibrjtr-shard-00-02.qsnrhfu.mongodb.net:27017/?ssl=true&replicaSet=atlas-lyu9mw-shard-0&authSource=admin&appName=Cluster0");
  
  const event = await Event.findOne({ status: 'published' });
  if (!event) { console.log('No event'); return; }

  const buyer = await Attendee.create({
    fullName: 'Test Buyer',
    email: 'test@buyer.com',
    event: event._id,
    addedVia: 'self_purchase',
    confirmationStatus: 'confirmed',
  });

  const order = await Order.create({
    event: event._id,
    buyer: buyer._id,
    buyerEmail: 'test@buyer.com',
    buyerName: 'Test Buyer',
    items: [{ categoryId: 'vvip', categoryName: 'VVIP', quantity: 1, unitPrice: 100, subtotal: 100 }],
    totalAmount: 100,
    paymentStatus: 'pending',
    confirmationLink: uuidv4(),
  });

  // SIMULATE orders.js logic
  const ticketsData = [{
    event: event._id,
    order: order._id,
    attendee: buyer._id,
    categoryId: 'vvip',
    categoryName: 'VVIP',
    price: 100,
    slotIndex: 1,
    ticketNumber: 'TKT-TEST-1',
  }];

  const createdTickets = await Ticket.create(ticketsData);
  console.log('CREATED_TICKET:', JSON.stringify(createdTickets[0].toObject(), null, 2));

  const fetchedTicket = await Ticket.findById(createdTickets[0]._id).populate('attendee');
  console.log('FETCHED_TICKET_ATTENDEE:', fetchedTicket.attendee?._id);
  console.log('FETCHED_TICKET_TOKEN:', fetchedTicket.attendee?.confirmationToken);

  await mongoose.disconnect();
}

test();
