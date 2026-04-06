const express = require('express');
const mongoose = require('mongoose');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const { protect, checkRole } = require('../middleware/auth');

const router = express.Router();

const buildAssetUrl = (value) => value || '';

const mapTicket = (ticket) => {
  const event = ticket.event || {};
  const attendee = ticket.attendee || {};
  const order = ticket.order || {};

  return {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    categoryId: ticket.categoryId,
    categoryName: ticket.categoryName,
    allowedZones: ticket.allowedZones || [],
    price: ticket.price,
    orderNumber: order.orderNumber,
    event: event?._id ? {
      _id: event._id,
      name: event.name,
      slug: event.slug,
      description: event.description,
      coverImage: buildAssetUrl(event.coverImage),
      startDate: event.startDate,
      endDate: event.endDate,
      venue: event.venue,
    } : null,
    attendee: attendee?._id ? {
      _id: attendee._id,
      fullName: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      qrCode: attendee.qrCode,
      qrToken: attendee.qrToken,
      confirmationStatus: attendee.confirmationStatus,
      isConfirmed: attendee.isConfirmed,
      checkedIn: attendee.checkedIn,
      allowedZones: attendee.allowedZones || ticket.allowedZones || [],
    } : null,
  };
};

const getUserScopedTickets = async (user) => {
  const email = user.email?.toLowerCase?.() || '';

  const [orders, attendees] = await Promise.all([
    Order.find({ buyerEmail: email }).select('_id'),
    Attendee.find({ email }).select('_id ticket'),
  ]);

  const orderIds = orders.map((order) => order._id);
  const attendeeIds = attendees.map((attendee) => attendee._id);
  const attendeeTicketIds = attendees.map((attendee) => attendee.ticket).filter(Boolean);

  const query = {
    $or: [
      orderIds.length ? { order: { $in: orderIds } } : null,
      attendeeIds.length ? { attendee: { $in: attendeeIds } } : null,
      attendeeTicketIds.length ? { _id: { $in: attendeeTicketIds } } : null,
    ].filter(Boolean),
  };

  if (!query.$or.length) {
    return [];
  }

  return Ticket.find(query)
    .populate('event', 'name slug description coverImage startDate endDate venue zones categories')
    .populate('attendee', 'fullName email phone qrCode qrToken confirmationStatus isConfirmed checkedIn allowedZones')
    .populate('order', 'orderNumber buyerName buyerEmail buyerPhone totalAmount status createdAt')
    .sort({ createdAt: -1 });
};

router.use(protect, checkRole(['BUYER']));

// GET /api/user/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const tickets = await getUserScopedTickets(req.user);
    const now = new Date();

    const normalizedTickets = tickets.map(mapTicket);
    const upcomingEvents = normalizedTickets
      .filter((ticket) => ticket.event?.startDate && new Date(ticket.event.startDate) >= now)
      .sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate));

    const pastEvents = normalizedTickets
      .filter((ticket) => ticket.event?.endDate && new Date(ticket.event.endDate) < now)
      .sort((a, b) => new Date(b.event.endDate) - new Date(a.event.endDate));

    const notifications = normalizedTickets
      .map((ticket) => {
        if (ticket.status === 'PENDING' || ticket.status === 'INVITED') {
          return {
            id: `${ticket._id}-pending`,
            type: 'action_required',
            message: `${ticket.event?.name || 'Your event'} ticket still needs confirmation.`,
          };
        }
        if (ticket.status === 'CONFIRMED' && ticket.event?.startDate) {
          return {
            id: `${ticket._id}-confirmed`,
            type: 'ticket_ready',
            message: `Your ticket for ${ticket.event.name} is ready to use.`,
          };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 6);

    res.json({
      success: true,
      data: {
        upcomingEvents,
        pastEvents,
        tickets: normalizedTickets,
        notifications,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/tickets
router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await getUserScopedTickets(req.user);
    res.json({
      success: true,
      data: {
        tickets: tickets.map(mapTicket),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/user/ticket/:id
router.get('/ticket/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const tickets = await getUserScopedTickets(req.user);
    const ticket = tickets.find((item) => item._id.toString() === req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    res.json({
      success: true,
      data: {
        ticket: mapTicket(ticket),
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/user/profile
router.put('/profile', async (req, res, next) => {
  try {
    const previousEmail = req.user.email;
    const updateData = {
      name: req.body.name?.trim(),
      email: req.body.email?.trim()?.toLowerCase?.(),
      phone: req.body.phone?.trim(),
    };

    Object.keys(updateData).forEach((key) => {
      if (!updateData[key]) delete updateData[key];
    });

    const user = await req.user.constructor.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (previousEmail && user.email && previousEmail !== user.email) {
      await Promise.all([
        Order.updateMany(
          { buyerEmail: previousEmail },
          {
            $set: {
              buyerEmail: user.email,
              ...(user.name ? { buyerName: user.name } : {}),
              ...(user.phone ? { buyerPhone: user.phone } : {}),
            },
          }
        ),
        Attendee.updateMany(
          { email: previousEmail },
          {
            $set: {
              email: user.email,
              ...(user.phone ? { phone: user.phone } : {}),
            },
          }
        ),
      ]);
    } else {
      await Order.updateMany(
        { buyerEmail: user.email },
        {
          $set: {
            ...(user.name ? { buyerName: user.name } : {}),
            ...(user.phone ? { buyerPhone: user.phone } : {}),
          },
        }
      );
    }

    res.json({
      success: true,
      data: {
        user,
      },
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
