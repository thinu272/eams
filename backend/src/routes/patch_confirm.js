const fs = require('fs');

const file = 'c:/Users/ThinuUpadya/Downloads/EAMS_Full_Project/eams/backend/src/routes/confirm.js';
let data = fs.readFileSync(file, 'utf8');

const target = `        if (allSlotsSubmitted && requiresPhotoVerification(ticket.event)) {
          const allAttendees = await Attendee.find({ order: orderId });
          const event = ticket.event;
          await Promise.all(
            allAttendees.map((a) =>
              notifyFinalTicket({
                attendee: a,
                event,
                phone: a.phone,
                notificationChannel: 'both',
              }).catch((err) => {
                console.error('FINAL CONFIRMATION NOTIFY ERROR:', err);
              })
            )
          );
          await Order.findByIdAndUpdate(orderId, { allAssigned: true });
        }`;

const replacement = `        const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
        await processOrderFinalConfirmation({ orderId }).catch((err) => console.error('FINAL CONFIRMATION ERROR:', err));

        if (allSlotsSubmitted) {
          await Order.findByIdAndUpdate(orderId, { allAssigned: true });
        }`;

// Try exact match
if (data.includes(target)) {
  fs.writeFileSync(file, data.replace(target, replacement));
  console.log('Replaced exact match');
} else {
  // Try CRLF to LF normalization
  const targetLF = target.replace(/\r\n/g, '\n');
  const targetCRLF = target.replace(/\n/g, '\r\n');
  
  if (data.includes(targetLF)) {
    fs.writeFileSync(file, data.replace(targetLF, replacement.replace(/\r\n/g, '\n')));
    console.log('Replaced LF match');
  } else if (data.includes(targetCRLF)) {
    fs.writeFileSync(file, data.replace(targetCRLF, replacement.replace(/\n/g, '\r\n')));
    console.log('Replaced CRLF match');
  } else {
    console.log('Target not found!');
  }
}
