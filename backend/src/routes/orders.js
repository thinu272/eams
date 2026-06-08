const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const { notifyFinalTicket, notifyBuyerFinalSummary } = require('../services/notificationService');
const { generatePayHereData } = require('../services/paymentService');
const { sendBuyerOrderCreatedEmail } = require('../services/ticketDeliveryService');
const SystemConfig = require('../models/SystemConfig');
const { optionalProtect } = require('../middleware/auth'); // I'll assume optionalProtect might be useful or I'll just use req.user if present

// POST /api/orders - Create new order
router.post('/', [
  body('eventId').notEmpty().withMessage('Event ID is required'),
  body('buyerName').notEmpty().withMessage('Buyer name is required'),
  body('buyerEmail').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required'),
  body('buyerPhone').optional({ checkFalsy: true }).matches(/^\+?[1-9]\d{1,14}$/).withMessage('Phone number is invalid'),
  body('notificationChannel').optional().isIn(['email', 'sms', 'both']).withMessage('Invalid notification channel'),
  body('tickets').isArray({ min: 1 }).withMessage('At least one ticket is required'),
  body('tickets.*.categoryName').notEmpty().withMessage('Category name is required'),
  body('tickets.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('tickets.*.price').isNumeric().withMessage('Price must be a number'),
  body('buyerId').optional().isMongoId().withMessage('Invalid buyer ID'),
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

    const { eventId, buyerName, buyerEmail, buyerPhone, tickets, notificationChannel, buyerId } = req.body;

    // Validate event exists
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Check if event is published
    if (event.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Event is not available for ticket purchase'
      });
    }

    // Enforce communication-channel-based requirements configured on the event
    const smsRequired = !!(event.settings?.communicationChannels?.sms);
    const emailRequired = !!(event.settings?.communicationChannels?.email);

    if (smsRequired && !buyerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required for this event because SMS notifications are enabled'
      });
    }

    if (emailRequired && !buyerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email is required for this event because email notifications are enabled'
      });
    }

    // Calculate total on backend (don't trust frontend)
    let totalAmount = 0;
    const validatedTickets = [];

    for (const ticket of tickets) {
      // Find matching category in event
      const category = event.categories.find(cat => cat.name === ticket.categoryName);
      if (!category) {
        return res.status(400).json({
          success: false,
          message: `Category "${ticket.categoryName}" not found in event`
        });
      }

      // Check availability
      const remaining = category.capacity - category.sold;
      if (ticket.quantity > remaining) {
        return res.status(400).json({
          success: false,
          message: `Only ${remaining} tickets remaining for ${ticket.categoryName}`
        });
      }

      // Use backend price (don't trust frontend)
      const backendPrice = category.price;
      totalAmount += backendPrice * ticket.quantity;

      validatedTickets.push({
        categoryName: ticket.categoryName,
        quantity: ticket.quantity,
        price: backendPrice
      });
    }

    // Generate unique confirmation token
    const confirmationToken = uuidv4();

    // Create order
    const order = new Order({
      eventId,
      buyerId: buyerId || (req.user ? req.user._id : undefined),
      buyerName,
      buyerEmail,
      buyerPhone,
      notificationChannel: notificationChannel || 'email',
      tickets: validatedTickets,
      totalAmount,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'pending',
      confirmationToken
    });

    await order.save();

    // Create individual ticket documents
    const ticketPromises = [];
    let slotIndex = 1;
    for (const ticketSummary of validatedTickets) {
      // Find the category to get its ID
      const category = event.categories.find(cat => cat.name === ticketSummary.categoryName);
      
      for (let i = 0; i < ticketSummary.quantity; i++) {
        const ticket = new Ticket({
          order: order._id,
          event: eventId,
          categoryId: category.id,
          categoryName: ticketSummary.categoryName,
          allowedZones: category.allowedZones || [],
          price: ticketSummary.price,
          status: 'PENDING',
          slotIndex: slotIndex,
          ticketNumber: `${order.orderNumber}-${slotIndex}`,
        });
        ticketPromises.push(ticket.save());
        slotIndex++;
      }
    }
    await Promise.all(ticketPromises);

    // Update sold counts and usage counts for each category using MongoDB $inc
    for (const ticket of validatedTickets) {
      const category = event.categories.find(c => c.name === ticket.categoryName);
      const updateData = { 'categories.$.sold': ticket.quantity };
      
      if (category.isPrivate) {
        updateData['categories.$.usageCount'] = ticket.quantity;
      }

      await Event.updateOne(
        { _id: eventId, 'categories.name': ticket.categoryName },
        { $inc: updateData }
      );
    }

    // BROADCAST REAL-TIME AVAILABILITY UPDATE
    const { emitDashboardEvent } = require('../utils/socket');
    const io = req.app.get('io');
    emitDashboardEvent(io, 'event_update', eventId, {
      type: 'TICKET_PURCHASED',
      eventId,
      tickets: validatedTickets
    });

    await sendBuyerOrderCreatedEmail({
      order,
      event,
    }).catch((error) => {
      console.error('ORDER CREATED EMAIL ERROR:', error);
    });

    // Generate Payment Data (PayHere)
    const paymentData = await generatePayHereData(order, event);

    res.status(201).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        confirmationToken: order.confirmationToken,
        totalAmount: order.totalAmount,
        paymentData // Frontend will use this to auto-submit form to PayHere
      },
      message: 'Order created. Proceed to payment.'
    });

  } catch (error) {
    console.error('Order creation error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/orders/finalize/:orderId - finalize all tickets + QR + email
router.post('/finalize/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate('eventId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const tickets = await Ticket.find({ order: order._id }).populate('attendee');
    if (!tickets.length) {
      return res.status(400).json({ success: false, message: 'No tickets found for this order' });
    }

    const unassigned = tickets.filter(t => !['ASSIGNED', 'CONFIRMED'].includes(t.status));
    if (unassigned.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All tickets must be assigned before finalizing.',
        unassignedCount: unassigned.length
      });
    }

    const event = order.eventId;
    const finalizedAttendees = [];

    for (const ticket of tickets) {
      if (!ticket.attendee) continue;
      const attendee = await Attendee.findById(ticket.attendee);
      if (!attendee) continue;

      // Ensure ticket status is at least ASSIGNED
      if (ticket.status === 'PENDING' || ticket.status === 'INVITED') {
        ticket.status = 'ASSIGNED';
        await ticket.save();
      }

      // ONLY generate QR and send final ticket if photo is VERIFIED
      // If it's still pending or rejected, we skip this part for now.
      if (attendee.photoVerificationStatus === 'verified' || attendee.photoVerificationStatus === 'Verified') {
        // Generate secure qrToken if missing
        if (!attendee.qrToken) {
          attendee.qrToken = uuidv4();
        }

        attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
        attendee.confirmationStatus = 'confirmed';
        attendee.isConfirmed = true;
        attendee.confirmedAt = attendee.confirmedAt || new Date();
        attendee.confirmedBy = attendee.confirmedBy || 'order_finalize';
        attendee.categoryId = attendee.categoryId || ticket.categoryId;
        attendee.categoryName = attendee.categoryName || ticket.categoryName;
        attendee.allowedZones = Array.isArray(attendee.allowedZones) && attendee.allowedZones.length
          ? attendee.allowedZones
          : (ticket.allowedZones || []);
        await attendee.save();

        finalizedAttendees.push(attendee);

        await notifyFinalTicket({
          attendee,
          event,
          phone: attendee.phone,
          notificationChannel: 'both',
        });

        // Update ticket status to CONFIRMED
        ticket.status = 'CONFIRMED';
        await ticket.save();
      } else {
        // If not verified, we still add it to finalizedAttendees for the summary (as pending)
        finalizedAttendees.push(attendee);
      }
    }

    order.status = 'CONFIRMED';
    order.allAssigned = true;
    await order.save();

    await notifyBuyerFinalSummary({
      order,
      event,
      attendees: finalizedAttendees,
    }).catch(console.error);

    return res.json({
      success: true,
      data: {
        orderId: order._id,
        confirmedTickets: finalizedAttendees.length,
        totalTickets: tickets.length
      },
      message: 'Order finalized, attendees confirmed, QR codes generated and notifications sent.'
    });
  } catch (error) {
    console.error('Order finalization error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const getOrderByTokenHandler = async (req, res) => {
  try {
    console.log('[GET /api/orders/:token] Received request for token:', req.params.token);
    const order = await Order.findOne({ confirmationToken: req.params.token })
      .populate('eventId', 'name venue startDate endDate status categories');

    console.log('[GET /api/orders/:token] Query result:', order ? 'Found' : 'Not Found');

    if (!order) {
      console.log('[GET /api/orders/:token] Order NOT FOUND in database for token:', req.params.token);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get individual tickets for this order
    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee', 'fullName email confirmationToken')
      .sort({ slotIndex: 1 });

    const config = await SystemConfig.findOne({ key: 'global' });
    const smsEnabled = config ? !!config.sms?.enabled : false;

    // Format response with proper event structure
    const response = {
      success: true,
      data: {
        order: {
          ...order.toObject(),
          event: order.eventId ? {
            _id: order.eventId._id,
            name: order.eventId.name,
            startDate: order.eventId.startDate,
            endDate: order.eventId.endDate,
            status: order.eventId.status,
            venue: order.eventId.venue,
            categories: order.eventId.categories
          } : null
        },
        tickets,
        smsEnabled
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/orders/confirm/:token - Get order by confirmation token (legacy)
router.get('/confirm/:token', getOrderByTokenHandler);

// GET /api/orders/:token - Get order by confirmation token (buyer portal)
router.get('/:token', getOrderByTokenHandler);

module.exports = router;
