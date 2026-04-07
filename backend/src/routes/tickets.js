const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const QRCode = require('qrcode');
const { notifyInvite, notifyFinalTicket } = require('../services/notificationService');

// Multer configuration for photo upload
const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/tickets/assign - Assign attendee to ticket (self-assignment)
router.post('/assign', upload.single('photo'), [
  body('ticketId').notEmpty().withMessage('Ticket ID is required'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth required'),
  body('nationalId').optional(),
  body('passportNumber').optional(),
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { ticketId, fullName, email, dateOfBirth, nationalId, passportNumber } = req.body;

    // Find ticket
    const ticket = await Ticket.findById(ticketId).populate('order').populate('event');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if ticket is already assigned
    if (ticket.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned or invited'
      });
    }

    // Create attendee
    const attendee = new Attendee({
      fullName,
      email,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      nationalId,
      passportNumber,
      photo: req.file ? `uploads/${req.file.filename}` : undefined,
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'confirmed', // Self-assigned attendees are immediately confirmed
      confirmedAt: new Date(),
      confirmedBy: 'self',
      addedVia: 'self_purchase',
    });

    // Generate QR code
    const qrData = attendee.qrToken;
    attendee.qrCode = await QRCode.toDataURL(qrData);

    await attendee.save();

    // Update ticket
    ticket.attendee = attendee._id;
    ticket.status = 'ASSIGNED';
    await ticket.save();

    // Check if all tickets in the order are now assigned
    const allTickets = await Ticket.find({ order: ticket.order._id });
    const assignedCount = allTickets.filter(t => t.status === 'ASSIGNED' || t.status === 'CONFIRMED').length;

    if (assignedCount === allTickets.length) {
      await Order.findByIdAndUpdate(ticket.order._id, { allAssigned: true });
    }

    await notifyFinalTicket({
      attendee,
      event: ticket.event,
      phone: attendee.phone,
      notificationChannel: 'both',
    });

    res.json({
      success: true,
      data: {
        attendee,
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          categoryName: ticket.categoryName,
          ticketNumber: ticket.ticketNumber
        }
      },
      message: 'Ticket assigned successfully'
    });

  } catch (error) {
    console.error('Ticket assignment error:', error);
    
    // Handle multer file upload errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Photo file is too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Only one photo file is allowed.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}, (err, req, res, next) => {
  // Error handling middleware for multer
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Photo upload failed'
    });
  }
});

// POST /api/tickets/invite - Send invite to ticket (existing functionality, moved here for consistency)
router.post('/invite', [
  body('ticketId').notEmpty().withMessage('Ticket ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional({ checkFalsy: true }).matches(/^\+947\d{8}$/).withMessage('Phone number must be in +947XXXXXXXX format'),
  body('notificationChannel').optional().isIn(['email', 'sms', 'both']).withMessage('Invalid notification channel'),
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { ticketId, email, phone, notificationChannel } = req.body;

    // Find ticket
    const ticket = await Ticket.findById(ticketId).populate('order').populate('event');
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if ticket is already assigned
    if (ticket.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already assigned or invited'
      });
    }

    // Create attendee
    const attendee = new Attendee({
      email,
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'invited',
      addedVia: 'invite',
    });

    await attendee.save();

    // Update ticket
    ticket.attendee = attendee._id;
    ticket.inviteEmail = email;
    ticket.inviteToken = attendee.confirmationToken;
    ticket.status = 'INVITED';
    ticket.inviteSentAt = new Date();
    ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
    ticket.inviteStatus = 'PENDING';
    ticket.inviteRespondedAt = null;
    ticket.inviteUsedAt = null;
    await ticket.save();

    await notifyInvite({
      attendee,
      event: ticket.event,
      phone: phone || attendee.phone,
      email,
      notificationChannel: notificationChannel || 'email',
    });

    res.json({
      success: true,
      data: {
        ticket: {
          _id: ticket._id,
          status: ticket.status,
          inviteEmail: ticket.inviteEmail
        }
      },
      message: 'Invite sent successfully'
    });

  } catch (error) {
    console.error('Ticket invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
