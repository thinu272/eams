const QRCode = require('qrcode');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { generateTicketPDF, generateOrderSummaryPDF } = require('./pdfService');
const { sendFinalConfirmation, sendOrderConfirmation } = require('../utils/email');

const requiresPhotoVerification = (event) => !!event?.settings?.requirePhotoVerification;

const normalizePhotoStatus = (status) => String(status || '').toLowerCase();

const isTicketDeliverable = ({ attendee, event }) => {
  if (!attendee || !event) return false;
  if (!attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') return false;

  if (!requiresPhotoVerification(event)) {
    return true;
  }

  return normalizePhotoStatus(attendee.photoVerificationStatus) === 'verified';
};

const resolveConfirmedTicketStatus = ({ attendee, event }) => (
  isTicketDeliverable({ attendee, event }) ? 'CONFIRMED' : 'ASSIGNED'
);

const ensureAttendeeQrAssets = async (attendee) => {
  if (!attendee.qrToken) {
    return attendee;
  }

  attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
  return attendee;
};

const loadAttendeeContext = async (attendeeOrId) => {
  const attendeeId = attendeeOrId?._id || attendeeOrId;
  if (!attendeeId) return null;

  const attendee = await Attendee.findById(attendeeId)
    .populate('event')
    .populate('ticket')
    .populate('order');

  if (!attendee) return null;

  let ticket = attendee.ticket;
  if (!ticket) {
    ticket = await Ticket.findOne({ attendee: attendee._id });
  }

  return {
    attendee,
    event: attendee.event,
    order: attendee.order,
    ticket,
  };
};

const deliverAttendeeTicketEmail = async ({ attendee: attendeeInput, event: eventInput, ticket: ticketInput, force = false }) => {
  let attendee = attendeeInput;
  let event = eventInput;
  let ticket = ticketInput;

  if (!attendee?._id || !event?._id) {
    const context = await loadAttendeeContext(attendeeInput);
    if (!context) {
      return { delivered: false, skipped: true, reason: 'attendee_not_found' };
    }
    attendee = context.attendee;
    event = context.event;
    ticket = ticket || context.ticket;
  }

  if (!attendee.email) {
    return { delivered: false, skipped: true, reason: 'missing_email' };
  }

  if (!isTicketDeliverable({ attendee, event })) {
    return { delivered: false, skipped: true, reason: 'ticket_not_ready' };
  }

  if (attendee.confirmationEmailSent && !force) {
    return { delivered: false, skipped: true, reason: 'already_sent' };
  }

  await ensureAttendeeQrAssets(attendee);

  const pdfBuffer = await generateTicketPDF(attendee, event, ticket);

  await sendFinalConfirmation({
    attendee,
    event,
    ticketCategory: ticket?.categoryName || attendee.categoryName,
    zoneAccessList: attendee.allowedZones || ticket?.allowedZones || [],
    pdfBuffer,
    supportEmail: process.env.EVENT_SUPPORT_EMAIL || 'support@entrynex.com',
    supportPhone: process.env.EVENT_SUPPORT_PHONE || '+94 11 234 5678',
  });

  attendee.confirmationEmailSent = true;
  attendee.confirmationSentAt = new Date();
  await attendee.save();

  return { delivered: true, attendeeId: attendee._id.toString() };
};

const sendBuyerPurchaseSummaryEmail = async ({ order: orderInput, event: eventInput }) => {
  const orderId = orderInput?._id || orderInput;
  const order = orderInput?._id ? orderInput : await Order.findById(orderId).lean();
  if (!order) {
    return { delivered: false, skipped: true, reason: 'order_not_found' };
  }

  const event = eventInput?._id ? eventInput : await Event.findById(eventInput || order.eventId).lean();
  if (!event) {
    return { delivered: false, skipped: true, reason: 'event_not_found' };
  }

  if (order.paymentStatus !== 'success') {
    return { delivered: false, skipped: true, reason: 'payment_not_successful' };
  }

  const pdfBuffer = await generateOrderSummaryPDF(order, event);
  await sendOrderConfirmation(order, event, { pdfBuffer });
  return { delivered: true };
};

const sendBuyerOrderCreatedEmail = async ({ order: orderInput, event: eventInput }) => {
  const orderId = orderInput?._id || orderInput;
  const order = orderInput?._id ? orderInput : await Order.findById(orderId).lean();
  if (!order) {
    return { delivered: false, skipped: true, reason: 'order_not_found' };
  }

  const event = eventInput?._id ? eventInput : await Event.findById(eventInput || order.eventId).lean();
  if (!event) {
    return { delivered: false, skipped: true, reason: 'event_not_found' };
  }

  const pdfBuffer = await generateOrderSummaryPDF(order, event);
  await sendOrderConfirmation(order, event, { pdfBuffer, stage: 'created' });
  return { delivered: true };
};

module.exports = {
  requiresPhotoVerification,
  isTicketDeliverable,
  resolveConfirmedTicketStatus,
  ensureAttendeeQrAssets,
  deliverAttendeeTicketEmail,
  sendBuyerPurchaseSummaryEmail,
  sendBuyerOrderCreatedEmail,
};
