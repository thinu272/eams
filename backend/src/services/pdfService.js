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
  // Removed as per request to make ticket details with QR only

  const path = require('path');
  const fs = require('fs');
  const logoPath = path.resolve(process.cwd(), '../frontend/public/logo.png');
  const hasLogo = fs.existsSync(logoPath);

  // Header Section
  const headerHeight = 120;
  doc.rect(0, 0, doc.page.width, headerHeight).fill(primaryColor);
  
  let textStartX = 50;
  let textY = 45;
  if (hasLogo) {
    // Draw a white rounded box for the logo to stand out against the dark header
    doc.fillColor('#ffffff').roundedRect(40, 20, 80, 80, 20).fill();
    // Draw the logo centered inside the white box
    doc.image(logoPath, 45, 25, { width: 70, height: 70, fit: [70, 70], align: 'center', valign: 'center' });
    textStartX = 140; 
  } else {
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('ENTRYNEX', 50, 45);
    textStartX = 180;
  }
  
  let scenarioTitle = 'ENTRYNEX Event Entry Confirmation';
  const catName = String(ticketCategory).toLowerCase();
  if (catName.includes('pass') || catName.includes('vip') || catName.includes('sponsor') || catName.includes('access') || catName.includes('staff')) {
    scenarioTitle = 'Your ENTRYNEX Access Details';
  }
  
  doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text(scenarioTitle, textStartX, textY);
  doc.fontSize(10).font('Helvetica').fillColor('#cbd5e1').text('Verified Security Access Pass', textStartX, textY + 22);

  // Main Content
  doc.fillColor(primaryColor).fontSize(20).text(event.name || 'Event Ticket', 0, 135, { width: doc.page.width, align: 'center' });
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

  // Right Column: QR Code Only
  doc.image(qrBuffer, 345, 190, { width: 180 });

  doc.fillColor(secondaryColor).fontSize(9).text('Present this QR at entry for scanning.', 325, 450, {
    align: 'center',
    width: 220,
  });

  // Footer / Instructions
  const footerHeight = 145;
  const footerY = doc.page.height - footerHeight;
  doc.rect(0, footerY, doc.page.width, footerHeight).fill('#f8fafc');
  doc.save();
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(0, footerY).lineTo(doc.page.width, footerY).stroke();
  doc.restore();

  // Left Column: Instructions
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('IMPORTANT INSTRUCTIONS', 50, footerY + 15);
  doc.fillColor(secondaryColor).font('Helvetica').fontSize(8);
  doc.text('- Please present this PDF at the entrance gate.', 50, footerY + 32);
  doc.text('- This ticket is valid only for the confirmed attendee.', 50, footerY + 44);
  doc.text('- Entry is subject to event security and organiser rules.', 50, footerY + 56);
  doc.text('- QR Validation Notice: This QR code is secure and will be validated at the venue gates.', 50, footerY + 68);

  // Divider inside footer
  doc.save();
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, footerY + 88).lineTo(545, footerY + 88).stroke();
  doc.restore();

  // Right/Bottom Column: Brand details
  const orgName = event.organiser?.name || event.organiserName || 'Authorized Event Organizer';
  doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text(`Event Organizer: ${orgName}`, 50, footerY + 98);
  doc.text('Support Contact: support@entrynex.com', 50, footerY + 110);
  
  doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold').text('Powered by ENTRYNEX', doc.page.width - 170, footerY + 98, { align: 'right', width: 120 });
});

const generateOrderSummaryPDF = async (order, event) => buildBuffer(async (doc) => {
  const primaryColor = '#0a1128';
  const secondaryColor = '#64748b';
  const accentColor = '#2684ff';
  const ticketRows = order.tickets || [];

  const path = require('path');
  const fs = require('fs');
  const logoPath = path.resolve(process.cwd(), '../frontend/public/logo.png');
  const hasLogo = fs.existsSync(logoPath);

  // Header Section
  const headerHeight = 120;
  doc.rect(0, 0, doc.page.width, headerHeight).fill(primaryColor);
  
  let textStartX = 50;
  let textY = 45;
  if (hasLogo) {
    // Draw a white rounded box for the logo to stand out against the dark header
    doc.fillColor('#ffffff').roundedRect(40, 20, 80, 80, 20).fill();
    // Draw the logo centered inside the white box
    doc.image(logoPath, 45, 25, { width: 70, height: 70, fit: [70, 70], align: 'center', valign: 'center' });
    textStartX = 140;
  } else {
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('ENTRYNEX', 50, 45);
    textStartX = 180;
  }
  
  doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text('ENTRYNEX Event Confirmation', textStartX, textY);
  doc.fontSize(10).font('Helvetica').fillColor('#cbd5e1').text('Official Purchase & Order Summary', textStartX, textY + 22);

  doc.fillColor(primaryColor).fontSize(20).text(event.name || 'Event', 0, 135, { width: doc.page.width, align: 'center' });
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

  if (y > 720) {
    doc.addPage();
    y = 50;
  }
  doc.save();
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, y + 8).lineTo(545, y + 8).stroke();
  doc.restore();
  
  doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text(`Total: LKR ${Number(order.totalAmount || 0).toLocaleString()}`, 50, y + 24);
  doc.fillColor(secondaryColor).fontSize(9).font('Helvetica').text('Assign attendees to activate each ticket.', 50, y + 46);

  const orgName = event.organiser?.name || event.organiserName || 'Authorized Event Organizer';
  y += 75;
  if (y > 720) {
    doc.addPage();
    y = 50;
  }
  
  // Outer Box
  doc.fillColor('#f8fafc').rect(50, y, 495, 110).fill();
  doc.save();
  doc.strokeColor('#e2e8f0').lineWidth(1).roundedRect(50, y, 495, 110, 8).stroke();
  doc.restore();
  
  doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('ORDER INFORMATION & SUPPORT', 65, y + 15);
  doc.fillColor(secondaryColor).font('Helvetica').fontSize(8);
  doc.text(`Event Organizer: ${orgName}`, 65, y + 34);
  doc.text('Support Contact: support@entrynex.com', 65, y + 48);
  doc.text('QR Validation Notice: Tickets in this order are secure and must be assigned to attendees for gate entry.', 65, y + 62, { width: 465 });
  
  doc.fillColor(accentColor).fontSize(8).font('Helvetica-Bold').text('Powered by ENTRYNEX', 380, y + 15, { align: 'right', width: 150 });
});

module.exports = {
  generateTicketPDF,
  generateOrderSummaryPDF,
};
