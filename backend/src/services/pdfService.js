const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const axios = require('axios');

const formatVenue = (venue) => {
  if (!venue) return 'TBA';
  if (typeof venue === 'string') return venue;
  return [venue.name, venue.address, venue.city].filter(Boolean).join(', ') || 'TBA';
};

const formatEventDate = (date) => (
  date
    ? new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'TBA'
);

const formatEventTime = (date) => (
  date
    ? new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'TBA'
);

const buildBuffer = (draw) => new Promise(async (resolve, reject) => {
  try {
    // Set margin to 0 so we can draw to the edges without triggering auto-page breaks
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
  
  // 1. Generate QR Code
  const qrBuffer = await QRCode.toBuffer(attendee.qrToken, {
    errorCorrectionLevel: 'H',
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // 2. Fetch Attendee Photo if available
  let photoBuffer = null;
  if (attendee.photo) {
    try {
      const response = await axios.get(attendee.photo, { responseType: 'arraybuffer' });
      photoBuffer = Buffer.from(response.data);
    } catch (error) {
      console.error('PDF_PHOTO_FETCH_ERROR:', error.message);
    }
  }

  // Header Section
  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.fillColor('#ffffff').fontSize(24).text('ENTRYNEX TICKET', 50, 40);
  doc.fontSize(10).text('Verified Event Entry Pass', 50, 70);

  // Main Content
  doc.moveDown(4);
  doc.fillColor(primaryColor).fontSize(20).text(event.name || 'Event Ticket', { align: 'center' });
  doc.moveTo(50, 160).lineTo(545, 160).stroke('#e2e8f0');

  // Left Column: Details
  doc.fillColor(secondaryColor).fontSize(10).text('ATTENDEE', 50, 180);
  doc.fillColor('#000000').fontSize(14).text(attendee.fullName || 'Attendee', 50, 195);

  doc.fillColor(secondaryColor).fontSize(10).text('CATEGORY', 50, 230);
  doc.fillColor(accentColor).fontSize(14).text(ticketCategory.toUpperCase(), 50, 245);

  doc.fillColor(secondaryColor).fontSize(10).text('DATE & TIME', 50, 280);
  doc.fillColor('#000000').fontSize(12).text(`${formatEventDate(event.startDate)} at ${formatEventTime(event.startDate)}`, 50, 295, {
    width: 220,
  });

  doc.fillColor(secondaryColor).fontSize(10).text('VENUE', 50, 345);
  doc.fillColor('#000000').fontSize(12).text(formatVenue(event.venue), 50, 360, { width: 230 });

  // Right Column: Photo and QR
  if (photoBuffer) {
    // Circle or rounded rect for photo
    doc.save();
    doc.roundedRect(365, 180, 140, 140, 15).clip();
    doc.image(photoBuffer, 365, 180, { width: 140, height: 140, cover: [140, 140] });
    doc.restore();
    doc.roundedRect(365, 180, 140, 140, 15).stroke('#e2e8f0');
    
    // QR Code below photo
    doc.image(qrBuffer, 385, 335, { width: 100 });
  } else {
    // QR Code centered in right col if no photo
    doc.image(qrBuffer, 345, 190, { width: 180 });
  }

  doc.fillColor(secondaryColor).fontSize(9).text('Present this QR at entry for scanning.', 325, 450, {
    align: 'center',
    width: 220,
  });

  // Footer / Instructions
  const footerHeight = 90;
  const footerY = doc.page.height - footerHeight;
  doc.rect(0, footerY, doc.page.width, footerHeight).fill('#f8fafc');
  doc.fillColor(secondaryColor).fontSize(9).text('IMPORTANT INSTRUCTIONS', 50, footerY + 15);
  doc.text('- Please present this PDF at the entrance gate.', 50, footerY + 32);
  doc.text('- This ticket is valid only for the confirmed attendee.', 50, footerY + 46);
  doc.text('- Entry is subject to event security and organiser rules.', 50, footerY + 60);
});

const generateOrderSummaryPDF = async (order, event) => buildBuffer(async (doc) => {
  const primaryColor = '#0a1128';
  const ticketRows = order.tickets || [];

  doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
  doc.fillColor('#ffffff').fontSize(24).text('PURCHASE SUMMARY', 50, 40);
  doc.fontSize(10).text('Event Access Management System', 50, 70);

  doc.moveDown(4);
  doc.fillColor(primaryColor).fontSize(20).text(event.name || 'Event', { align: 'center' });
  doc.moveTo(50, 160).lineTo(545, 160).stroke('#e2e8f0');

  doc.fillColor('#64748b').fontSize(10).text('BUYER', 50, 180);
  doc.fillColor('#000000').fontSize(13).text(order.buyerName || 'Buyer', 50, 195);
  doc.fontSize(11).text(order.buyerEmail || '', 50, 214);

  doc.fillColor('#64748b').fontSize(10).text('ORDER NUMBER', 50, 250);
  doc.fillColor('#000000').fontSize(12).text(order.orderNumber || '-', 50, 265);

  doc.fillColor('#64748b').fontSize(10).text('DATE & TIME', 50, 300);
  doc.fillColor('#000000').fontSize(12).text(`${formatEventDate(event.startDate)} at ${formatEventTime(event.startDate)}`, 50, 315);

  doc.fillColor('#64748b').fontSize(10).text('VENUE', 50, 350);
  doc.fillColor('#000000').fontSize(12).text(formatVenue(event.venue), 50, 365, { width: 470 });

  doc.fillColor(primaryColor).fontSize(14).text('Tickets', 50, 420);
  let y = 448;
  ticketRows.forEach((item, index) => {
    // Check for page overflow
    if (y > 750) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor('#000000').fontSize(12).text(`${index + 1}. ${item.categoryName}`, 60, y);
    doc.text(`Qty: ${item.quantity}`, 330, y);
    doc.text(`LKR ${Number(item.price || 0).toLocaleString()}`, 430, y);
    y += 24;
  });

  if (y > 780) {
    doc.addPage();
    y = 50;
  }
  doc.moveTo(50, y + 8).lineTo(545, y + 8).stroke('#e2e8f0');
  doc.fillColor(primaryColor).fontSize(14).text(`Total: LKR ${Number(order.totalAmount || 0).toLocaleString()}`, 50, y + 24);

  doc.fillColor('#64748b').fontSize(10).text('Assign attendees to activate each ticket.', 50, y + 60);
});

module.exports = {
  generateTicketPDF,
  generateOrderSummaryPDF,
};
