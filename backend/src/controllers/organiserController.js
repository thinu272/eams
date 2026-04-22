const mongoose = require('mongoose');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const EntryLog = require('../models/EntryLog');
const User = require('../models/User');
const { normalizeRole } = require('../utils/rbac');
const { notifySubOrganiserInvite, notifyInvite } = require('../services/notificationService');

const resolveEventId = (user) => (user.assignedEvents && user.assignedEvents[0]);

const getOrganiserEvent = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const [totalAttendees, confirmed, checkedIn, revenueRows] = await Promise.all([
      Attendee.countDocuments({ event: eventId }),
      Attendee.countDocuments({ event: eventId, isConfirmed: true }),
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true }),
      Order.aggregate([
        { $match: { eventId: new mongoose.Types.ObjectId(eventId), status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        totalAttendees,
        confirmed,
        checkedIn,
        revenue: revenueRows[0]?.totalRevenue || 0,
      },
    });
  } catch (err) { next(err); }
};

const getAttendees = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const { search = '', status, category, photoStatus, page = 1, limit = 20 } = req.query;
    const filter = { event: eventId, isActive: true };
    if (status) filter.confirmationStatus = status;
    if (category) filter.categoryName = category;
    if (photoStatus) filter.photoVerificationStatus = photoStatus;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [attendees, total] = await Promise.all([
      Attendee.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit, 10)),
      Attendee.countDocuments(filter),
    ]);
    res.json({ success: true, data: { attendees, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const getEntryLogs = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const { limit = 50, gate, zone, from, to, attendeeId } = req.query;
    const filter = { event: eventId };
    if (gate) filter.gateId = gate;
    if (zone) filter.zoneId = zone;
    if (attendeeId && mongoose.Types.ObjectId.isValid(attendeeId)) {
      filter.attendee = attendeeId;
    }
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to) filter.timestamp.$lte = new Date(to);
    }
    const logs = await EntryLog.find(filter)
      .populate('attendee', 'fullName categoryName')
      .populate('processedBy', 'name')
      .sort('-timestamp')
      .limit(parseInt(limit, 10));
    res.json({ success: true, data: { logs } });
  } catch (err) { next(err); }
};

const listSubOrganisers = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const users = await User.find({ role: normalizeRole('SubOrganiser'), assignedEvents: eventId })
      .select('-password')
      .sort('-createdAt');
    res.json({ success: true, data: { users } });
  } catch (err) { next(err); }
};

const createSubOrganiser = async (req, res, next) => {
  try {
    const eventId = resolveEventId(req.user);
    const payload = {
      ...req.body,
      role: normalizeRole('SubOrganiser'),
      assignedEvents: [eventId],
      status: 'Active',
    };
    const user = await User.create(payload);
    await notifySubOrganiserInvite({ user, event: null, phone: user.phone, email: user.email });
    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const updateSubOrganiserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive', 'active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const eventId = resolveEventId(req.user);
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, assignedEvents: eventId },
      { status: status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : status },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'Sub organiser not found.' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const sendInvite = async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    await notifyInvite({
      attendee,
      event: attendee.event,
      email: attendee.email,
      phone: attendee.phone,
      notificationChannel: 'both',
    });
    res.json({ success: true, message: 'Invite sent.' });
  } catch (err) { next(err); }
};

module.exports = {
  getOrganiserEvent,
  getDashboardStats,
  getAttendees,
  getEntryLogs,
  listSubOrganisers,
  createSubOrganiser,
  updateSubOrganiserStatus,
  sendInvite,
};
