const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const { protect, requireEventAccess } = require('../middleware/auth');
const { sendOrderConfirmation } = require('../utils/email');
const { v4: uuidv4 } = require('uuid');

// POST /api/orders - create order (public)
router.post('/', [
  body('eventId').notEmpty().withMessage('Event ID required'),
  body('buyerName').notEmpty().withMessage('Buyer name required'),
  body('buyerEmail').isEmail().withMessage('Valid buyer email required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item required'),
  body('items.*.categoryId').notEmpty().withMessage('Category ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { eventId, buyerName, buyerEmail, buyerPhone, items } = req.body;

    const event = await Event.findById(eventId);
    if (!event || event.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Event not found or not available.' });
    }

    // Validate items and calculate totals
    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const category = event.categories.find(c => c.id === item.categoryId);
      if (!category) {
        return res.status(400).json({ success: false, message: `Category ${item.categoryId} not found.` });
      }
      const remaining = category.capacity - category.sold;
      if (item.quantity > remaining) {
        return res.status(400).json({
          success: false,
          message: `Only ${remaining} tickets remaining for ${category.name}.`,
        });
      }
      const subtotal = category.price * item.quantity;
      totalAmount += subtotal;
      orderItems.push({ categoryId: category.id, categoryName: category.name, quantity: item.quantity, unitPrice: category.price, subtotal });
    }

    // Create buyer as attendee record
    const buyer = await Attendee.create({
      fullName: buyerName,
      email: buyerEmail,
      phone: buyerPhone,
      event: eventId,
      addedVia: 'self_purchase',
      confirmationStatus: 'confirmed',
    });

    const confirmationToken = uuidv4();
    const order = await Order.create({
      event: eventId,
      buyer: buyer._id,
      buyerEmail,
      buyerName,
      buyerPhone,
      items: orderItems,
      totalAmount,
      paymentStatus: 'pending',
      confirmationLink: confirmationToken,
      confirmationLinkExpires: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });

    // Update buyer with order reference
    buyer.order = order._id;
    await buyer.save();

    // Create individual ticket slots
    const ticketsData = [];
    let ticketIndex = 1;
    for (const item of orderItems) {
      for (let i = 1; i <= item.quantity; i++) {
        let attendeeId;
        const isFirstTicket = ticketsData.length === 0;

        if (isFirstTicket) {
          // Assign first ticket to the buyer
          attendeeId = buyer._id;
          buyer.categoryId = item.categoryId;
          buyer.categoryName = item.categoryName;
          const category = event.categories.find(c => c.id === item.categoryId);
          buyer.allowedZones = category?.allowedZones || [];
          await buyer.save();
        } else {
          // Create a pending attendee for other tickets
          const attendee = await Attendee.create({
            event: eventId,
            order: order._id,
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            addedVia: 'self_purchase',
            confirmationStatus: 'pending',
          });
          attendeeId = attendee._id;
        }

        ticketsData.push({
          event: eventId,
          order: order._id,
          attendee: attendeeId,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          price: item.unitPrice,
          slotIndex: ticketIndex++,
          ticketNumber: `TKT-${order.orderNumber.split('-')[1]}-${item.categoryId.toUpperCase()}-${uuidv4().substring(0, 4).toUpperCase()}`,
        });
      }
      // Update sold count
      await Event.updateOne(
        { _id: eventId, 'categories.id': item.categoryId },
        { $inc: { 'categories.$.sold': item.quantity } }
      );
    }
    await Ticket.create(ticketsData);

    // Send confirmation email (non-blocking)
    sendOrderConfirmation(order, event).catch(console.error);

    res.status(201).json({
      success: true,
      data: {
        order: { ...order.toObject(), confirmationLink: confirmationToken },
        message: 'Order created. Check your email for confirmation link.',
      },
    });
  } catch (err) { next(err); }
});

// GET /api/orders/confirm/:token - get order by confirmation token (public)
router.get('/confirm/:token', async (req, res, next) => {
  try {
    const order = await Order.findOne({ confirmationLink: req.params.token })
      .populate('event', 'name venue startDate categories zones settings')
      .populate('buyer', 'fullName email');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.confirmationLinkExpires && order.confirmationLinkExpires < new Date()) {
      return res.status(410).json({ success: false, message: 'Confirmation link has expired.' });
    }
    const tickets = await Ticket.find({ order: order._id }).populate('attendee');
    res.json({ success: true, data: { order, tickets } });
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id/mark-paid - simulate payment completion (hook for payment gateway)
router.patch('/:id/mark-paid', async (req, res, next) => {
  try {
    const { paymentReference, paymentMethod } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, {
      paymentStatus: 'paid',
      paymentReference,
      paymentMethod,
      paidAt: new Date(),
    }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, data: { order } });
  } catch (err) { next(err); }
});

// GET /api/orders - list orders for event (organiser)
router.get('/', protect, async (req, res, next) => {
  try {
    const { eventId, page = 1, limit = 20 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find({ event: eventId }).populate('buyer', 'fullName email').sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Order.countDocuments({ event: eventId }),
    ]);
    res.json({ success: true, data: { orders, total } });
  } catch (err) { next(err); }
});

module.exports = router;
