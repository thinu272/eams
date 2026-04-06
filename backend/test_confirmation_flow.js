// backend/test_confirmation_flow.js
// Quick test script for the Buyer Confirmation Portal

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

const tests = {
  // Sample UUIDs for testing
  ORDER_TOKEN: 'uuid-from-database',
  TICKET_ID: 'ticket-id-from-database',
  ATTENDEE_EMAIL: 'guest@example.com',
};

// Test 1: Fetch order by confirmation token
async function testGetOrder() {
  try {
    console.log('\n=== Test 1: Get Order by Token ===');
    const response = await axios.get(`${API_BASE}/orders/confirm/${tests.ORDER_TOKEN}`);
    console.log('✓ Order fetched successfully');
    console.log(`  Order ID: ${response.data.data.order._id}`);
    console.log(`  Tickets: ${response.data.data.tickets.length}`);
    console.log(`  All Assigned: ${response.data.data.order.allAssigned}`);
    return response.data.data;
  } catch (error) {
    console.error('✗ Failed to fetch order:', error.response?.data?.message);
  }
}

// Test 2: Assign ticket to self
async function testAssignTicket(ticketId) {
  try {
    console.log('\n=== Test 2: Assign Ticket to Self ===');
    const response = await axios.post(`${API_BASE}/tickets/assign`, {
      ticketId: ticketId,
      fullName: 'Jane Smith',
      email: 'jane.smith@example.com',
      dateOfBirth: '1990-05-15',
      nationalId: '123456789V',
      passportNumber: 'AB123456'
    });
    console.log('✓ Ticket assigned successfully');
    console.log(`  Attendee ID: ${response.data.data.attendee._id}`);
    console.log(`  Ticket Status: ${response.data.data.ticket.status}`);
    console.log(`  QR Token: ${response.data.data.attendee.qrToken}`);
    return response.data.data;
  } catch (error) {
    console.error('✗ Failed to assign ticket:', error.response?.data?.message);
    if (error.response?.data?.errors) {
      error.response.data.errors.forEach(e => {
        console.error(`  - ${e.param}: ${e.msg}`);
      });
    }
  }
}

// Test 3: Send invite to ticket
async function testInviteTicket(ticketId) {
  try {
    console.log('\n=== Test 3: Send Invite to Ticket ===');
    const response = await axios.post(`${API_BASE}/tickets/invite`, {
      ticketId: ticketId,
      email: tests.ATTENDEE_EMAIL
    });
    console.log('✓ Invite sent successfully');
    console.log(`  Ticket Status: ${response.data.data.ticket.status}`);
    console.log(`  Invite Email: ${response.data.data.ticket.inviteEmail}`);
    return response.data.data;
  } catch (error) {
    console.error('✗ Failed to send invite:', error.response?.data?.message);
  }
}

// Test 4: Verify all assigned updates
async function testVerifyAllAssigned() {
  try {
    console.log('\n=== Test 4: Verify All Assigned Status ===');
    const response = await axios.get(`${API_BASE}/orders/confirm/${tests.ORDER_TOKEN}`);
    const data = response.data.data;
    const allAssigned = data.order.allAssigned;
    const assignedCount = data.tickets.filter(t => t.status === 'ASSIGNED' || t.status === 'CONFIRMED').length;
    
    console.log('✓ Order status verified');
    console.log(`  All Assigned: ${allAssigned}`);
    console.log(`  Assigned/Confirmed: ${assignedCount}/${data.tickets.length}`);
    console.log(`  Match: ${(assignedCount === data.tickets.length) === allAssigned ? '✓' : '✗'}`);
  } catch (error) {
    console.error('✗ Failed to verify status:', error.response?.data?.message);
  }
}

// Run tests
async function runAllTests() {
  console.log('Starting Buyer Confirmation Portal Tests...');
  console.log('Note: Replace ORDER_TOKEN and TICKET_ID with real values from database\n');
  
  const order = await testGetOrder();
  if (!order) {
    console.log('\nSkipping further tests: Order not found');
    return;
  }

  // Get first PENDING ticket for testing
  const pendingTicket = order.tickets.find(t => t.status === 'PENDING');
  if (pendingTicket) {
    await testAssignTicket(pendingTicket._id);
  }

  // Get second PENDING ticket for invite test
  const anotherPendingTicket = order.tickets.find((t, i) => t.status === 'PENDING' && order.tickets.indexOf(pendingTicket) !== i);
  if (anotherPendingTicket) {
    await testInviteTicket(anotherPendingTicket._id);
  }

  await testVerifyAllAssigned();
  
  console.log('\n=== Tests Complete ===\n');
}

// Export for use in other scripts
module.exports = {
  testGetOrder,
  testAssignTicket,
  testInviteTicket,
  testVerifyAllAssigned,
  runAllTests
};

// Run if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
