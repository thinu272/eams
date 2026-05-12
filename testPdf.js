const fs = require('fs');
const path = require('path');
const { generateTicketPDF } = require('./backend/src/services/pdfService');

const mockAttendee = {
  fullName: 'John Doe',
  qrToken: 'test-qr-123',
  categoryName: 'VIP',
};

const mockEvent = {
  name: 'Test Event',
  startDate: new Date(),
  venue: 'Test Venue'
};

async function test() {
  try {
    const pdfBuffer = await generateTicketPDF(mockAttendee, mockEvent);
    fs.writeFileSync('./test-ticket.pdf', pdfBuffer);
    console.log('PDF generated successfully, size:', pdfBuffer.length);
  } catch(e) {
    console.error('PDF error:', e);
  }
}
test();
