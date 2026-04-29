const mongoose = require('mongoose');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const Order = require('../models/Order');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const { notifyInvite, notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { requiresPhotoVerification, resolveConfirmedTicketStatus } = require('../services/ticketDeliveryService');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const buildTicketSummary = (ticket) => ({
  _id: ticket._id,
  ticketNumber: ticket.ticketNumber,
  status: ticket.status,
  categoryId: ticket.categoryId,
  categoryName: ticket.categoryName,
  allowedZones: ticket.allowedZones || [],
  slotIndex: ticket.slotIndex,
  attendee: ticket.attendee ? {
    _id: ticket.attendee._id,
    fullName: ticket.attendee.fullName,
    email: ticket.attendee.email,
    phone: ticket.attendee.phone,
    qrCode: ticket.attendee.qrCode,
    qrToken: ticket.attendee.qrToken,
    confirmationStatus: ticket.attendee.confirmationStatus,
    isConfirmed: ticket.attendee.isConfirmed,
    photo: ticket.attendee.photo,
  } : null,
});

const getBuyerOrders = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.user.email);
    const orders = await Order.find({ buyerEmail: email })
      .populate('eventId', 'name startDate venue')
      .sort({ createdAt: -1 });

    const orderIds = orders.map((order) => order._id);
    const tickets = await Ticket.find({ order: { $in: orderIds } })
      .populate('attendee', 'fullName email confirmationStatus isConfirmed');

    const ticketGroups = tickets.reduce((acc, ticket) => {
      const key = ticket.order.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(ticket);
      return acc;
    }, {});

    const results = orders.map((order) => {
      const list = ticketGroups[order._id.toString()] || [];
      const confirmed = list.filter((t) => t.status === 'CONFIRMED').length;
      const total = list.length;
      const allConfirmed = total > 0 && confirmed === total;
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        confirmationStatus: allConfirmed ? 'All Confirmed' : 'Pending',
        createdAt: order.createdAt,
        event: order.eventId ? {
          _id: order.eventId._id,
          name: order.eventId.name,
          startDate: order.eventId.startDate,
          venue: order.eventId.venue,
        } : null,
        progress: { confirmed, total },
      };
    });

    res.json({ success: true, data: { orders: results } });
  } catch (err) { next(err); }
};

const getBuyerOrderDetails = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID.' });
    }
    const email = normalizeEmail(req.user.email);
    const order = await Order.findById(req.params.orderId).populate('eventId', 'name startDate venue endDate');
    if (!order || normalizeEmail(order.buyerEmail) !== email) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }
    const tickets = await Ticket.find({ order: order._id })
      .populate('attendee', 'fullName email phone confirmationStatus isConfirmed photo qrCode qrToken')
      .sort({ slotIndex: 1 });

    const confirmed = tickets.filter((t) => t.status === 'CONFIRMED').length;

    res.json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          event: order.eventId ? {
            _id: order.eventId._id,
            name: order.eventId.name,
            startDate: order.eventId.startDate,
            endDate: order.eventId.endDate,
            venue: order.eventId.venue,
          } : null,
          progress: { confirmed, total: tickets.length },
        },
        tickets: tickets.map(buildTicketSummary),
      },
    });
  } catch (err) { next(err); }
};

const assignSelfToTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }
    const email = normalizeEmail(req.user.email);
    const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event');
    if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== email) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
    }

    let attendee = ticket.attendee ? await Attendee.findById(ticket.attendee) : null;
    if (!attendee) {
      attendee = new Attendee({
        order: ticket.order._id,
        event: ticket.event._id,
        ticket: ticket._id,
        categoryId: ticket.categoryId,
        categoryName: ticket.categoryName,
        allowedZones: ticket.allowedZones || [],
        confirmationToken: uuidv4(),
        qrToken: uuidv4(),
        addedVia: 'self_purchase',
      });
    }

    const { fullName, phone, dateOfBirth, nationalId, passportNumber, nationality } = req.body;
    attendee.fullName = fullName;
    attendee.email = email;
    attendee.phone = phone;
    if (dateOfBirth) attendee.dateOfBirth = new Date(dateOfBirth);
    if (nationalId) attendee.nationalId = nationalId;
    if (passportNumber) attendee.passportNumber = passportNumber;
    if (nationality) attendee.nationality = nationality;

    if (req.s3Data) {
      attendee.photo = req.s3Data.url;
      attendee.photoS3Key = req.s3Data.key;
      attendee.photoUploadedAt = new Date();
    }

    attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    attendee.confirmationStatus = 'confirmed';
    attendee.isConfirmed = true;
    attendee.confirmedAt = new Date();
    attendee.confirmedBy = 'self';

    await attendee.save();
    ticket.attendee = attendee._id;
    ticket.status = resolveConfirmedTicketStatus({ attendee, event: ticket.event });
    await ticket.save();

    // Update order confirmation status
    const tickets = await Ticket.find({ order: ticket.order._id });
    const confirmedCount = tickets.filter((t) => t.status === 'CONFIRMED').length;
    const confirmationStatus = confirmedCount === tickets.length ? 'complete' : 'partial';
    await Order.findByIdAndUpdate(ticket.order._id, { confirmationStatus });

    if (requiresPhotoVerification(ticket.event)) {
      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'pending_verification',
      });
    } else {
      await notifyFinalTicket({
        attendee,
        event: ticket.event,
        phone: attendee.phone,
        notificationChannel: 'email',
      });
    }

    res.json({ success: true, data: { attendee }, message: 'Details submitted successfully.' });
  } catch (err) { next(err); }
};

const inviteForTicket = async (req, res, next) => {
  try {
    const { email, phone, notificationChannel } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event');
    if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== normalizeEmail(req.user.email)) {
      return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
    }
    if (ticket.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Ticket already assigned.' });
    }

    const attendee = new Attendee({
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      email,
      phone,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'invited',
      invitedAt: new Date(),
      addedVia: 'invite',
    });
    await attendee.save();

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
      phone,
      email,
      notificationChannel: notificationChannel || 'email',
    });

    await notifyBuyerTicketProgress({
      order: ticket.order,
      attendee,
      event: ticket.event,
      ticket,
      stage: 'invited',
    });

    res.json({ success: true, message: 'Invite sent successfully.' });
  } catch (err) { next(err); }
};

module.exports = {
  getBuyerOrders,
  getBuyerOrderDetails,
  assignSelfToTicket,
  inviteForTicket,
  getBuyerTickets: async (req, res, next) => {
    try {
      const email = normalizeEmail(req.user.email);
      const orders = await Order.find({ buyerEmail: email })
        .populate('eventId', 'name startDate endDate venue coverImage description settings instructions status')
        .sort({ createdAt: -1 });

      const orderIds = orders.map((o) => o._id);
      const tickets = await Ticket.find({ order: { $in: orderIds } })
        .populate('attendee', 'fullName email phone confirmationStatus isConfirmed photo qrCode qrToken')
        .populate('event', 'name startDate endDate venue coverImage settings instructions status')
        .sort({ createdAt: -1 });

      const normalizedOrders = orders.map((order) => {
        const orderTickets = tickets.filter((t) => t.order?.toString?.() === order._id.toString());
        const assigned = orderTickets.filter((t) => ['INVITED', 'PENDING_VERIFICATION', 'ASSIGNED', 'CONFIRMED'].includes(t.status)).length;
        const pending = orderTickets.filter((t) => t.status === 'PENDING').length;

        const byCategory = orderTickets.reduce((acc, ticket) => {
          const key = ticket.categoryId || ticket.categoryName || 'unknown';
          if (!acc[key]) {
            acc[key] = {
              categoryId: ticket.categoryId,
              categoryName: ticket.categoryName,
              quantity: 0,
              assigned: 0,
              pending: 0,
              ticketIds: [],
            };
          }
          acc[key].quantity += 1;
          acc[key].ticketIds.push(ticket._id);
          if (ticket.status === 'PENDING') acc[key].pending += 1;
          else acc[key].assigned += 1;
          return acc;
        }, {});

        return {
          _id: order._id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt,
          buyerName: order.buyerName,
          buyerEmail: order.buyerEmail,
          buyerPhone: order.buyerPhone,
          event: order.eventId ? {
            _id: order.eventId._id,
            name: order.eventId.name,
            startDate: order.eventId.startDate,
            endDate: order.eventId.endDate,
            venue: order.eventId.venue,
            coverImage: order.eventId.coverImage,
            description: order.eventId.description,
            status: order.eventId.status,
            requirePhotoVerification: !!(order.eventId.settings?.requirePhotoVerification),
            instructions: order.eventId.instructions || '',
          } : null,
          stats: {
            total: orderTickets.length,
            assigned,
            pending,
          },
          categories: Object.values(byCategory).sort((a, b) => (a.categoryName || '').localeCompare(b.categoryName || '')),
        };
      });

      res.json({ success: true, data: { orders: normalizedOrders } });
    } catch (err) {
      next(err);
    }
  },
  assignAttendeeToTicket: async (req, res, next) => {
    try {
      const { ticketId, fullName, email, phone, notificationChannel } = req.body;
      if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({ success: false, message: 'Valid ticketId is required.' });
      }
      if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

      const ticket = await Ticket.findById(ticketId).populate('order').populate('event').populate('attendee');
      if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== normalizeEmail(req.user.email)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
      }
      if (ticket.status !== 'PENDING') {
        return res.status(400).json({ success: false, message: 'Ticket already assigned.' });
      }

      const attendee = new Attendee({
        order: ticket.order._id,
        event: ticket.event._id,
        ticket: ticket._id,
        fullName: fullName || '',
        email: String(email).trim().toLowerCase(),
        phone: phone || '',
        categoryId: ticket.categoryId,
        categoryName: ticket.categoryName,
        allowedZones: ticket.allowedZones || [],
        confirmationToken: uuidv4(),
        qrToken: uuidv4(),
        confirmationStatus: 'invited',
        invitedAt: new Date(),
        addedVia: 'invite',
      });
      await attendee.save();

      ticket.attendee = attendee._id;
      ticket.inviteEmail = attendee.email;
      ticket.invitePhone = attendee.phone;
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
        phone: attendee.phone,
        email: attendee.email,
        notificationChannel: notificationChannel || 'email',
      });

      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'invited',
      });

      res.json({ success: true, data: { attendee }, message: 'Invite sent successfully.' });
    } catch (err) {
      next(err);
    }
  },
  getBuyerInvites: async (req, res, next) => {
    try {
      const email = normalizeEmail(req.user.email);
      const orders = await Order.find({ buyerEmail: email }).select('_id');
      const orderIds = orders.map((o) => o._id);

      const tickets = await Ticket.find({ order: { $in: orderIds }, status: { $in: ['INVITED', 'PENDING_VERIFICATION', 'CONFIRMED'] } })
        .populate('event', 'name startDate venue coverImage')
        .populate('attendee', 'fullName email phone confirmationStatus photoVerificationStatus photoRejectionReason confirmationToken');

      const invites = tickets
        .filter((t) => t.attendee)
        .map((t) => ({
          ticketId: t._id,
          status: t.status,
          inviteSentAt: t.inviteSentAt,
          inviteExpiresAt: t.inviteExpiresAt,
          inviteUsedAt: t.inviteUsedAt,
          event: t.event ? {
            _id: t.event._id,
            name: t.event.name,
            startDate: t.event.startDate,
            venue: t.event.venue,
            coverImage: t.event.coverImage,
          } : null,
          attendee: {
            _id: t.attendee._id,
            fullName: t.attendee.fullName || '',
            email: t.attendee.email || '',
            phone: t.attendee.phone || '',
            confirmationStatus: t.attendee.confirmationStatus,
            photoVerificationStatus: t.attendee.photoVerificationStatus,
            photoRejectionReason: t.attendee.photoRejectionReason,
            confirmationToken: t.attendee.confirmationToken,
          },
        }))
        .sort((a, b) => new Date(b.inviteSentAt || 0) - new Date(a.inviteSentAt || 0));

      res.json({ success: true, data: { invites } });
    } catch (err) {
      next(err);
    }
  },
  resendInviteForTicket: async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
        return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
      }
      const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event').populate('attendee');
      if (!ticket || normalizeEmail(ticket.order?.buyerEmail) !== normalizeEmail(req.user.email)) {
        return res.status(403).json({ success: false, message: 'Not authorized for this ticket.' });
      }
      if (!ticket.attendee) {
        return res.status(400).json({ success: false, message: 'No attendee attached to this ticket.' });
      }
      if (!['INVITED', 'PENDING_VERIFICATION'].includes(ticket.status)) {
        return res.status(400).json({ success: false, message: 'Invite can only be resent for invited tickets.' });
      }

      const attendee = await Attendee.findById(ticket.attendee);
      if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

      ticket.inviteSentAt = new Date();
      ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
      await ticket.save();

      await notifyInvite({
        attendee,
        event: ticket.event,
        phone: attendee.phone,
        email: attendee.email,
        notificationChannel: req.body.notificationChannel || 'email',
      });

      await notifyBuyerTicketProgress({
        order: ticket.order,
        attendee,
        event: ticket.event,
        ticket,
        stage: 'invited',
      });

      res.json({ success: true, message: 'Invite resent successfully.' });
    } catch (err) {
      next(err);
    }
  },
  bulkAssignFromSheet: async (req, res, next) => {
    try {
      const { orderId, notificationChannel } = req.body;
      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ success: false, message: 'Valid orderId is required.' });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'Excel/CSV file is required.' });
      }

      const buyerEmail = normalizeEmail(req.user.email);
      const order = await Order.findById(orderId).populate('eventId');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      if (normalizeEmail(order.buyerEmail) !== buyerEmail) {
        return res.status(403).json({ success: false, message: 'You do not have access to this order.' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const pick = (obj, keys) => {
        for (const key of keys) {
          if (obj && Object.prototype.hasOwnProperty.call(obj, key) && String(obj[key]).trim()) return obj[key];
        }
        return '';
      };

      const normalizedRows = rows
        .map((row) => ({
          fullName: pick(row, ['fullName', 'FullName', 'name', 'Name', 'Full Name', 'FULL NAME']),
          email: pick(row, ['email', 'Email', 'E-mail', 'E-Mail', 'EMAIL']),
          phone: pick(row, ['phone', 'Phone', 'Phone Number', 'phoneNumber', 'PhoneNumber', 'MOBILE', 'Mobile']),
        }))
        .filter((r) => String(r.email || '').trim());

      if (normalizedRows.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid rows found. Expect columns: fullName, email, phone.' });
      }

      const pendingTickets = await Ticket.find({ order: order._id, status: 'PENDING' }).populate('event').sort({ slotIndex: 1 });
      if (pendingTickets.length === 0) {
        return res.status(400).json({ success: false, message: 'No pending ticket slots available for this order.' });
      }

      const assignCount = Math.min(pendingTickets.length, normalizedRows.length);
      const results = [];

      for (let i = 0; i < assignCount; i += 1) {
        const ticket = pendingTickets[i];
        const row = normalizedRows[i];

        const attendee = new Attendee({
          order: order._id,
          event: ticket.event?._id || ticket.event,
          ticket: ticket._id,
          fullName: row.fullName || '',
          email: String(row.email).trim().toLowerCase(),
          phone: row.phone || '',
          categoryId: ticket.categoryId,
          categoryName: ticket.categoryName,
          allowedZones: ticket.allowedZones || [],
          confirmationToken: uuidv4(),
          qrToken: uuidv4(),
          confirmationStatus: 'invited',
          invitedAt: new Date(),
          addedVia: 'invite',
        });
        await attendee.save();

        ticket.attendee = attendee._id;
        ticket.inviteEmail = attendee.email;
        ticket.invitePhone = attendee.phone;
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
          phone: attendee.phone,
          email: attendee.email,
          notificationChannel: notificationChannel || 'email',
        });

        await notifyBuyerTicketProgress({
          order,
          attendee,
          event: ticket.event,
          ticket,
          stage: 'invited',
        });

        results.push({ ticketId: ticket._id, attendeeId: attendee._id, email: attendee.email });
      }

      res.json({
        success: true,
        data: {
          assigned: results.length,
          skipped: Math.max(0, normalizedRows.length - results.length),
          results,
        },
        message: `Assigned ${results.length} attendee(s).`,
      });
    } catch (err) {
      next(err);
    }
  },
};
