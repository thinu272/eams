'use strict';

const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');

const ATTENDEE_POPULATE_FIELDS =
  'fullName email phone photo confirmationStatus isConfirmed qrToken qrCode allowedZones photoVerificationStatus resubmitToken';

// Returns a rendered QR data URL for the attendee, generating and persisting
// one if it doesn't exist yet. Called once per attendee, not per ticket.
async function getOrCreateQrCode(attendee) {
  if (attendee.qrCode) return attendee.qrCode;
  if (!attendee.qrToken) return null;

  const qrCode = await QRCode.toDataURL(attendee.qrToken);
  await Attendee.updateOne({ _id: attendee._id }, { $set: { qrCode } });
  return qrCode;
}

// qrToken and notes are intentionally excluded — see mapTicket below.
function mapTicket(ticket, qrCode) {
  return {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    categoryName: ticket.categoryName,
    allowedZones: ticket.allowedZones || [],
    event: ticket.event ? {
      _id: ticket.event._id,
      name: ticket.event.name,
      startDate: ticket.event.startDate,
      endDate: ticket.event.endDate,
      venue: ticket.event.venue,
    } : null,
    // notes is staff/admin-internal (flags, verification issues, escalation
    // comments) and must never reach the attendee. qrToken is a sensitive
    // credential — only the rendered qrCode image is exposed.
    attendee: ticket.attendee ? {
      _id: ticket.attendee._id,
      fullName: ticket.attendee.fullName,
      email: ticket.attendee.email,
      phone: ticket.attendee.phone,
      photo: ticket.attendee.photo,
      confirmationStatus: ticket.attendee.confirmationStatus,
      isConfirmed: ticket.attendee.isConfirmed,
      photoVerificationStatus: ticket.attendee.photoVerificationStatus,
      resubmitToken: ticket.attendee.resubmitToken,
      qrCode: qrCode || ticket.attendee.qrCode || null,
      allowedZones: ticket.attendee.allowedZones || ticket.allowedZones || [],
    } : null,
  };
}

const getAttendeeTickets = async (req, res, next) => {
  try {
    const email = req.user.email?.toLowerCase?.() || '';
    const attendees = await Attendee.find({ email });

    if (!attendees.length) {
      return res.json({ success: true, data: { tickets: [] } });
    }

    // Resolve/persist each attendee's QR code once, keyed by attendee id,
    // rather than regenerating it per ticket.
    const qrCodeByAttendeeId = new Map();
    for (const attendee of attendees) {
      qrCodeByAttendeeId.set(String(attendee._id), await getOrCreateQrCode(attendee));
    }

    const tickets = await Ticket.find({ attendee: { $in: attendees.map((a) => a._id) } })
      .populate('event', 'name startDate endDate venue')
      .populate('attendee', ATTENDEE_POPULATE_FIELDS)
      .sort({ createdAt: -1 });

    const mapped = tickets.map((t) =>
      mapTicket(t, t.attendee ? qrCodeByAttendeeId.get(String(t.attendee._id)) : null)
    );

    res.json({ success: true, data: { tickets: mapped } });
  } catch (err) { next(err); }
};

const getAttendeeTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.ticketId)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID.' });
    }

    const email = req.user.email?.toLowerCase?.() || '';
    const attendee = await Attendee.findOne({ email });
    if (!attendee) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const ticket = await Ticket.findOne({ _id: req.params.ticketId, attendee: attendee._id })
      .populate('event', 'name startDate endDate venue')
      .populate('attendee', ATTENDEE_POPULATE_FIELDS);

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    const qrCode = await getOrCreateQrCode(ticket.attendee);

    res.json({ success: true, data: { ticket: mapTicket(ticket, qrCode) } });
  } catch (err) { next(err); }
};

module.exports = {
  getAttendeeTickets,
  getAttendeeTicket,
};