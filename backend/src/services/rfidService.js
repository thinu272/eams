const RfidTag = require('../models/RfidTag');
const Ticket = require('../models/Ticket');

const normalizeRfidTag = (value) => String(value || '').trim();
const isValidRfidTag = (value) => /^\d{10}$/.test(normalizeRfidTag(value));

const allocateRfid = async ({ eventId, categoryId, attendeeId, ticketId }) => {
  if (!eventId || !categoryId) return null;

  if (ticketId) {
    const ticket = await Ticket.findById(ticketId).populate('order', 'paymentStatus status').lean();
    const order = ticket?.order;
    const isPaid = ['paid', 'success'].includes(String(order?.paymentStatus || '').toLowerCase())
      || order?.status === 'CONFIRMED';
    if (!isPaid) return null;
  }

  const update = {
    $set: { status: 'assigned', ticket: ticketId, assignedAt: new Date() },
  };
  if (attendeeId) update.$set.attendee = attendeeId;

  const tag = await RfidTag.findOneAndUpdate(
    { event: eventId, categoryId, status: 'available' },
    update,
    { sort: { sequence: 1 }, new: true }
  );
  return tag?.rfidTag || null;
};

const linkReservedRfidToAttendee = async ({ ticketId, attendeeId }) => {
  if (!ticketId || !attendeeId) return null;
  const tag = await RfidTag.findOneAndUpdate(
    { ticket: ticketId, status: 'assigned' },
    { $set: { attendee: attendeeId } },
    { new: true }
  );
  return tag?.rfidTag || null;
};

module.exports = {
  allocateRfid,
  linkReservedRfidToAttendee,
  normalizeRfidTag,
  isValidRfidTag,
};