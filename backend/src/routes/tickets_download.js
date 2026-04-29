const express = require('express');
const router = express.Router();
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const { generateTicketPDF } = require('../services/pdfService');
const { protect } = require('../middleware/auth');

/**
 * GET /api/tickets/download/:token
 * Protected endpoint to download the PDF ticket using attendee qrToken / confirmationToken
 */
router.get('/download/:token', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ 
      $or: [
        { qrToken: req.params.token },
        { confirmationToken: req.params.token }
      ]
    }).populate('event');

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (!attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      return res.status(403).json({ success: false, message: 'Ticket identity is not yet confirmed or approved.' });
    }

    const requesterEmail = req.user?.email?.toLowerCase?.() || '';
    let isAllowed = attendee.email?.toLowerCase?.() === requesterEmail;

    if (!isAllowed && attendee.order) {
      const order = await Order.findById(attendee.order).select('buyerEmail');
      isAllowed = order?.buyerEmail?.toLowerCase?.() === requesterEmail;
    }

    if (!isAllowed) {
      return res.status(403).json({ success: false, message: 'You are not authorised to download this ticket.' });
    }

    const pdfBuffer = await generateTicketPDF(attendee, attendee.event);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ENTRYNEX-Ticket-${attendee.fullName.replace(/\s+/g, '-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('TICKET DOWNLOAD ERROR:', err);
    next(err);
  }
});

module.exports = router;
