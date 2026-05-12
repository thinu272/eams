const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

// Mock pdfService logic
const buildBuffer = (draw) => new Promise(async (resolve, reject) => {
  try {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    await draw(doc);
    doc.end();
  } catch (error) {
    reject(error);
  }
});

const generateTicketPDF = async (attendee, event, ticket = null) => buildBuffer(async (doc) => {
  const primaryColor = '#0a1128';
  const secondaryColor = '#64748b';
  const accentColor = '#2684ff';
  const ticketCategory = ticket?.categoryName || attendee.categoryName || 'Standard';
  
  const qrBuffer = await QRCode.toBuffer(attendee.qrToken, {
    errorCorrectionLevel: 'H',
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.fillColor('#ffffff').fontSize(24).text('ENTRYNEX TICKET', 50, 40);
  doc.fontSize(10).text('Verified Event Entry Pass', 50, 70);

  doc.moveDown(4);
  doc.fillColor(primaryColor).fontSize(20).text(event.name || 'Event Ticket', { align: 'center' });
  doc.moveTo(50, 160).lineTo(545, 160).stroke('#e2e8f0');

  doc.fillColor(secondaryColor).fontSize(10).text('ATTENDEE', 50, 180);
  doc.fillColor('#000000').fontSize(14).text(attendee.fullName || 'Attendee', 50, 195);

  doc.fillColor(secondaryColor).fontSize(10).text('CATEGORY', 50, 230);
  doc.fillColor(accentColor).fontSize(14).text(ticketCategory.toUpperCase(), 50, 245);

  doc.fillColor(secondaryColor).fontSize(10).text('VENUE', 50, 345);
  doc.fillColor('#000000').fontSize(12).text(event.venue || 'TBA', 50, 360, { width: 230 });

  doc.image(qrBuffer, 345, 190, { width: 180 });
});

async function test() {
  try {
    const pdfBuffer = await generateTicketPDF(
      { fullName: 'Test User', qrToken: '12345', categoryName: 'VIP' },
      { name: 'Test Event', venue: 'Colombo' }
    );
    fs.writeFileSync('./test-output.pdf', pdfBuffer);
    console.log('SUCCESS, bytes:', pdfBuffer.length);
  } catch(e) {
    console.error('ERROR:', e);
  }
}

test();
