const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const API_BASE = 'http://localhost:5000/api';
const EVENT_ID = '675c1234567890abcdef0001'; // Replace with actual event ID from your DB

async function testFlow() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ MongoDB connected\n');

  try {
    // Step 1: Create an order
    console.log('📋 Step 1: Creating order...');
    const orderRes = await axios.post(`${API_BASE}/orders`, {
      eventId: EVENT_ID,
      buyerName: 'John Doe',
      buyerEmail: 'john@example.com',
      buyerPhone: '+1234567890',
      tickets: [
        { categoryName: 'VIP', quantity: 2, price: 12000 },
        { categoryName: 'General Admission', quantity: 1, price: 3500 }
      ]
    });
    
    const { confirmationToken, orderId, orderNumber } = orderRes.data.data;
    console.log(`✓ Order created: ${orderNumber}`);
    console.log(`✓ Confirmation token: ${confirmationToken}\n`);

    // Step 2: Get order with tickets
    console.log('📋 Step 2: Fetching order with tickets...');
    const orderDetailsRes = await axios.get(`${API_BASE}/orders/confirm/${confirmationToken}`);
    const { order, tickets } = orderDetailsRes.data.data;
    console.log(`✓ Order retrieved: ${order.orderNumber}`);
    console.log(`✓ Total tickets: ${tickets.length}`);
    console.log(`✓ Tickets:`);
    tickets.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.categoryName} - Status: ${t.status} - ID: ${t._id}`);
    });
    console.log();

    // Step 3: Invite attendee for first ticket
    console.log('📋 Step 3: Inviting attendee for first ticket...');
    const firstTicketId = tickets[0]._id;
    const inviteRes = await axios.post(`${API_BASE}/attendees/invite-by-ticket/${firstTicketId}`, {
      email: 'attendee1@example.com'
    });
    console.log(`✓ Invite sent: ${inviteRes.data.message}\n`);

    // Step 4: Verify ticket status changed
    console.log('📋 Step 4: Verifying ticket status changed...');
    const updatedOrderRes = await axios.get(`${API_BASE}/orders/confirm/${confirmationToken}`);
    const updatedTickets = updatedOrderRes.data.data.tickets;
    updatedTickets.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.categoryName} - Status: ${t.status}`);
    });
    console.log();

    console.log('✅ Test completed successfully!');
  } catch (err) {
    console.error('❌ Error:', err.response?.data?.message || err.message);
  } finally {
    await mongoose.disconnect();
  }
}

testFlow();
