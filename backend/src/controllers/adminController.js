const mongoose = require('mongoose');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Attendee = require('../models/Attendee');
const User = require('../models/User');
const { normalizeRole } = require('../utils/rbac');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

const getStats = async (req, res, next) => {
  try {
    const [totalEvents, totalAttendees, revenueRows, totalUsers, revenuePerOrganiser] = await Promise.all([
      Event.countDocuments(),
      Attendee.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'success' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      User.countDocuments({ status: 'Active' }),
      Event.aggregate([
        { $match: { revenue: { $gt: 0 } } },
        { $group: { _id: '$mainOrganiser', totalRevenue: { $sum: '$revenue' } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'organiser' } },
        { $unwind: { path: '$organiser', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, name: { $ifNull: ['$organiser.name', 'Unknown'] }, totalRevenue: 1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalAttendees,
        totalRevenue: revenueRows[0]?.totalRevenue || 0,
        totalUsers,
        revenuePerOrganiser
      },
    });
  } catch (err) { next(err); }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalEvents, totalAttendees, revenueRows, usersByRole, revenuePerEvent] = await Promise.all([
      Event.countDocuments(),
      Attendee.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'success' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } },
      ]),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Event.find({ revenue: { $gt: 0 } }).select('name revenue').sort({ revenue: -1 }).limit(10)
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalAttendees,
        totalRevenue: revenueRows[0]?.totalRevenue || 0,
        usersByRole,
        revenuePerEvent
      },
    });
  } catch (err) { next(err); }
};

const listEvents = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: 'i' };
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [events, total] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, data: { events, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const createEvent = async (req, res, next) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const getEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${req.params.id})` });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const updateEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${req.params.id})` });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
};

const deleteEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) { next(err); }
};

const listUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = normalizeRole(role);
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').populate('assignedEvents', 'name').skip(skip).limit(parseInt(limit, 10)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { users, total, page: parseInt(page, 10), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const createUser = async (req, res, next) => {
  try {
    const payload = { ...req.body, role: normalizeRole(req.body.role) };
    
    let tempPassword = payload.password;
    if (!tempPassword) {
      tempPassword = crypto.randomBytes(8).toString('hex');
      payload.password = tempPassword;
    }
    
    payload.isTempPassword = true;
    payload.isVerified = true;

    const user = await User.create(payload);

    await notificationService.notifyUserCredentials(user, tempPassword);

    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }
    const payload = { ...req.body };
    if (payload.role) payload.role = normalizeRole(payload.role);
    if (payload.password && String(payload.password).trim() !== '') {
      payload.password = await bcrypt.hash(payload.password, 12);
    } else {
      delete payload.password;
    }
    const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true }).select('-password').populate('assignedEvents', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Notify if critical permissions changed
    if (req.body.role || req.body.assignedEvent || req.body.assignedEvents) {
      await notificationService.notifyRoleAssignment(user, user.role, user.assignedEvents);
    }

    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

module.exports = {
  getStats,
  getDashboardStats,
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  listUsers,
  createUser,
  updateUser,
};
