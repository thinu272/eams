const crypto = require('crypto');
const QRCode = require('qrcode');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { sendFinalConfirmation, sendBuyerFinalSummary } = require('../utils/email');

const getQrSigningSecret = () => process.env.QR_SIGNING_SECRET || process.env.JWT_SECRET || 'eams-dev-secret';

const signQrPayload = (payload) => {
  const secret = getQrSigningSecret();
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

const getPackageDescription = (event, categoryName) => {
  const category = (event?.categories || []).find((item) => item.name === categoryName);
  return category?.description || category?.benefits?.join(', ') || 'Standard access package';
};

const getZoneNames = (event, attendee) => {
  const zoneIdList = attendee.allowedZones || [];
  const zoneMap = new Map((event?.zones || []).map((zone) => [zone.id, zone.name]));
  const mapped = zoneIdList.map((zoneId) => zoneMap.get(zoneId) || zoneId).filter(Boolean);
  return mapped.length ? mapped : ['General Access'];
};

const buildQrPayload = ({ attendeeId, eventId }) => {
  const nonce = crypto.randomBytes(12).toString('hex');
  const issuedAt = Date.now();
  const basePayload = JSON.stringify({ attendeeId, eventId, nonce, issuedAt });
  const signedToken = signQrPayload(basePayload);
  return { attendeeId, eventId, nonce, issuedAt, signedToken };
};

const sendAttendeeFinalEmail = async ({ attendee, ticket, event }) => {
  const qrPayload = buildQrPayload({
    attendeeId: attendee._id.toString(),
    eventId: event._id.toString(),
  });
  const qrPayloadString = JSON.stringify(qrPayload);
  const qrToken = `${qrPayload.nonce}.${qrPayload.signedToken}`;
  const qrImageBuffer = await QRCode.toBuffer(qrPayloadString, { type: 'png', width: 360, margin: 1 });

  await sendFinalConfirmation({
    attendee,
    event,
    ticketCategory: ticket.categoryName,
    packageDescription: getPackageDescription(event, ticket.categoryName),
    zoneAccessList: getZoneNames(event, attendee),
    qrPayloadString,
    qrImageBuffer,
    supportEmail: process.env.EVENT_SUPPORT_EMAIL || 'support@eams.com',
    supportPhone: process.env.EVENT_SUPPORT_PHONE || '+94 11 234 5678',
  });

  attendee.qrToken = qrToken;
  attendee.qrCode = await QRCode.toDataURL(qrPayloadString);
  attendee.confirmationEmailSent = true;
  attendee.confirmationSentAt = new Date();
  attendee.confirmationStatus = 'confirmed';
  attendee.isConfirmed = true;
  attendee.confirmedAt = attendee.confirmedAt || new Date();
  await attendee.save();
};

const processOrderFinalConfirmation = async ({ orderId }) => {
  if (!orderId) return { sentCount: 0, skipped: true, reason: 'missing_order' };

  const order = await Order.findById(orderId).lean();
  if (!order) return { sentCount: 0, skipped: true, reason: 'order_not_found' };

  const tickets = await Ticket.find({ order: orderId }).populate('attendee');
  if (!tickets.length) return { sentCount: 0, skipped: true, reason: 'no_tickets' };

  const allVerified = tickets.every((ticket) => {
    if (!ticket.attendee) return false;
    return ticket.attendee.photoVerificationStatus === 'verified';
  });
  if (!allVerified) return { sentCount: 0, skipped: true, reason: 'not_all_verified' };

  const event = await Event.findById(order.eventId).lean();
  if (!event) return { sentCount: 0, skipped: true, reason: 'event_not_found' };

  let sentCount = 0;
  const summaryRows = [];

  for (const ticket of tickets) {
    const attendee = ticket.attendee;
    if (!attendee || !attendee.email) continue;

    summaryRows.push({
      fullName: attendee.fullName || 'N/A',
      email: attendee.email || 'N/A',
      categoryName: ticket.categoryName || attendee.categoryName || 'N/A',
      verificationStatus: attendee.photoVerificationStatus || 'pending',
    });

    if (attendee.confirmationSentAt) continue;

    await sendAttendeeFinalEmail({ attendee, ticket, event });
    sentCount += 1;
  }

  if (sentCount > 0 && order.buyerEmail) {
    await sendBuyerFinalSummary({
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      orderNumber: order.orderNumber,
      event,
      attendees: summaryRows,
      supportEmail: process.env.EVENT_SUPPORT_EMAIL || 'support@eams.com',
      supportPhone: process.env.EVENT_SUPPORT_PHONE || '+94 11 234 5678',
    });
  }

  return { sentCount, skipped: false };
};

module.exports = {
  processOrderFinalConfirmation,
};
