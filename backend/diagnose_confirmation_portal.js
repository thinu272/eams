// backend/diagnose_confirmation_portal.js
// Run this script with: node diagnose_confirmation_portal.js

const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

const API_BASE = 'http://localhost:5000/api';
const MONGO_URI = process.env.MONGO_URI;

console.log('\n=== BUYER CONFIRMATION PORTAL DIAGNOSTIC ===\n');

// Test 1: Check MongoDB Connection
async function testMongoDB() {
  console.log('1️⃣  Testing MongoDB Connection...');
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB Connected');
    
    // Count orders
    const Order = require('./src/models/Order');
    const count = await Order.countDocuments();
    console.log(`   Found ${count} orders in database`);
    
    // Get latest order
    if (count > 0) {
      const order = await Order.findOne().sort({ createdAt: -1 }).lean();
      console.log(`   Latest order: ${order.orderNumber}`);
      console.log(`   Confirmation token: ${order.confirmationToken}`);
      console.log(`   AllAssigned: ${order.allAssigned}`);
    }
    
    await mongoose.connection.close();
  } catch (err) {
    console.log('❌ MongoDB Connection Failed');
    console.log(`   Error: ${err.message}`);
  }
}

// Test 2: Check API Server
async function testAPIServer() {
  console.log('\n2️⃣  Testing API Server...');
  try {
    const response = await axios.get('http://localhost:5000/', { timeout: 5000 });
    console.log('✅ Server is Running');
    console.log(`   Response: ${response.data}`);
  } catch (err) {
    console.log('❌ Server is Not Running');
    console.log(`   Error: ${err.code || err.message}`);
    console.log('   Make sure to run: npm run dev');
    return false;
  }
  return true;
}

// Test 3: Test Get Order Endpoint
async function testGetOrder() {
  console.log('\n3️⃣  Testing GET /orders/confirm/:token...');
  try {
    // First, get an order token from DB
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const Order = require('./src/models/Order');
    const order = await Order.findOne().lean();
    
    if (!order) {
      console.log('⚠️  No orders found in database');
      await mongoose.connection.close();
      return;
    }
    
    await mongoose.connection.close();
    
    const token = order.confirmationToken;
    const response = await axios.get(`${API_BASE}/orders/confirm/${token}`, { timeout: 5000 });
    
    if (response.data.success) {
      console.log('✅ Order Fetched Successfully');
      const data = response.data.data;
      console.log(`   Order: ${data.order.orderNumber}`);
      console.log(`   Buyer: ${data.order.buyerName} (${data.order.buyerEmail})`);
      console.log(`   Event: ${data.order.event?.name || 'NOT POPULATED'}`);
      console.log(`   Tickets: ${data.tickets.length}`);
      
      // Check ticket statuses
      const statuses = {};
      data.tickets.forEach(t => {
        statuses[t.status] = (statuses[t.status] || 0) + 1;
      });
      console.log(`   Ticket Statuses:`, statuses);
      
      // Display first ticket details
      if (data.tickets.length > 0) {
        const firstTicket = data.tickets[0];
        console.log(`\n   First Ticket Details:`);
        console.log(`   - ID: ${firstTicket._id}`);
        console.log(`   - Category: ${firstTicket.categoryName}`);
        console.log(`   - Status: ${firstTicket.status}`);
        console.log(`   - Attendee: ${firstTicket.attendee?.fullName || 'Not assigned'}`);
      }
    } else {
      console.log('❌ Order Fetch Failed');
      console.log(`   ${response.data.message}`);
    }
  } catch (err) {
    console.log('❌ API Request Failed');
    console.log(`   Error: ${err.message}`);
  }
}

// Test 4: Check Frontend
async function testFrontend() {
  console.log('\n4️⃣  Testing Frontend Server...');
  try {
    const response = await axios.get('http://localhost:3000/', { timeout: 5000 });
    console.log('✅ Frontend is Running');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.log('❌ Frontend is Not Running');
      console.log('   Make sure to run: cd frontend && npm start');
    } else {
      console.log('⚠️  Frontend check inconclusive');
    }
  }
}

// Main
async function runDiagnostics() {
  await testAPIServer();
  await testMongoDB();
  await testGetOrder();
  await testFrontend();
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
  console.log('📋 Next Steps:');
  console.log('1. If MongoDB or Server failed, fix those first');
  console.log('2. Navigate to: http://localhost:3000/confirmation/{confirmationToken}');
  console.log('3. Check browser DevTools Console for errors');
  console.log('4. Check browser Network tab for API responses\n');
  
  process.exit(0);
}

runDiagnostics().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
