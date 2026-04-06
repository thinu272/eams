const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const Order = require('../models/Order');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const QRCode = require('qrcode');
const { notifyOrderConfirmation, notifyFinalTicket } = require('../services/notificationService');

// POST /api/orders - Create new order
router.post('/', [
  body('eventId').notEmpty().withMessage('Event ID is required'),
  body('buyerName').notEmpty().withMessage('Buyer name is required'),
  body('buyerEmail').isEmail().withMessage('Valid email is required'),
  body('buyerPhone').optional({ checkFalsy: true }).matches(/^\+947\d{8}$/).withMessage('Phone number must be in +947XXXXXXXX format'),
  body('notificationChannel').optional().isIn(['email', 'sms', 'both']).withMessage('Invalid notification channel'),
  body('tickets').isArray({ min: 1 }).withMessage('At least one ticket is required'),
  body('tickets.*.categoryName').notEmpty().withMessage('Category name is required'),
  body('tickets.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('tickets.*.price').isNumeric().withMessage('Price must be a number'),
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

    const { eventId, buyerName, buyerEmail, buyerPhone, tickets, notificationChannel } = req.body;

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
      buyerName,
      buyerEmail,
      buyerPhone,
      tickets: validatedTickets,
      totalAmount,
      status: 'PENDING',
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

    // Update sold counts for each category using MongoDB $inc
    for (const ticket of validatedTickets) {
      await Event.updateOne(
        { _id: eventId, 'categories.name': ticket.categoryName },
        { $inc: { 'categories.$.sold': ticket.quantity } }
      );
    }

    await notifyOrderConfirmation({
      order,
      event,
      buyerPhone,
      notificationChannel,
    });

    res.status(201).json({
      success: true,
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        confirmationToken: order.confirmationToken,
        totalAmount: order.totalAmount
      },
      message: 'Order created successfully'
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

      // Generate secure qrToken if missing
      if (!attendee.qrToken) {
        attendee.qrToken = uuidv4();
      }

      // Compose QR payload (no raw DB IDs)
      const payload = {
        attendeeToken: attendee.qrToken,
        eventToken: event?._id?.toString?.() || '',
        ticketNumber: ticket.ticketNumber,
        generatedAt: new Date().toISOString(),
      };
      const qrData = JSON.stringify(payload);

      attendee.qrCode = await QRCode.toDataURL(qrData);
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

      // Update ticket status to CONFIRMED (safe idempotence)
      ticket.status = 'CONFIRMED';
      await ticket.save();
    }

    order.status = 'CONFIRMED';
    order.allAssigned = true;
    await order.save();

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

// GET /api/orders/confirm/:token - Get order by confirmation token
router.get('/confirm/:token', async (req, res) => {
  try {
    const order = await Order.findOne({ confirmationToken: req.params.token })
      .populate('eventId', 'name venue startDate endDate status categories');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get individual tickets for this order
    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee', 'fullName email confirmationToken')
      .sort({ slotIndex: 1 });

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
        tickets
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
});

module.exports = router;
