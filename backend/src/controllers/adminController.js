'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Attendee = require('../models/Attendee');
const User = require('../models/User');
const { normalizeRole } = require('../utils/rbac');
const notificationService = require('../services/notificationService');

// Fields an admin is allowed to set directly when creating/updating a user.
// Anything not listed here is silently dropped from req.body.
const USER_WRITABLE_FIELDS = [
  'name', 'email', 'phone', 'role', 'password',
  'assignedEvents', 'company', 'status',
];

// Fields an admin is allowed to set directly when creating/updating an event.
// Computed/relational fields (revenue, slug, publishedAt, organiser lists,
// per-category sold counts, etc.) are intentionally excluded.
const EVENT_WRITABLE_FIELDS = [
  'name', 'description', 'startDate', 'endDate', 'venue', 'status',
  'categories', 'settings', 'company', 'bannerImage',
];

function pick(source, fields) {
  const result = {};
  for (const field of fields) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  return result;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

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
        // NOTE: mainOrganisers[] is the current field; mainOrganiser (singular) is
        // legacy and being backfilled by scripts/sync_legacy_data.js. Unwinding
        // mainOrganisers covers both post-migration events and multi-organiser
        // events. Events not yet migrated and missing mainOrganisers will be
        // excluded until the migration script has been run.
        { $unwind: '$mainOrganisers' },
        { $group: { _id: '$mainOrganisers', totalRevenue: { $sum: '$revenue' } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'organiser' } },
        { $unwind: { path: '$organiser', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, name: { $ifNull: ['$organiser.name', 'Unknown'] }, totalRevenue: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalAttendees,
        totalRevenue: revenueRows[0]?.totalRevenue || 0,
        totalUsers,
        revenuePerOrganiser,
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
      Event.find({ revenue: { $gt: 0 } }).select('name revenue').sort({ revenue: -1 }).limit(10),
    ]);

    res.json({
      success: true,
      data: {
        totalEvents,
        totalAttendees,
        totalRevenue: revenueRows[0]?.totalRevenue || 0,
        usersByRole,
        revenuePerEvent,
      },
    });
  } catch (err) { next(err); }
};

const listEvents = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };

    const [events, total] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Event.countDocuments(filter),
    ]);

    res.json({ success: true, data: { events, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const createEvent = async (req, res, next) => {
  try {
    const payload = pick(req.body, EVENT_WRITABLE_FIELDS);
    const event = await Event.create(payload);
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
    const payload = pick(req.body, EVENT_WRITABLE_FIELDS);
    const event = await Event.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
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
    const { role } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const filter = {};
    if (role) filter.role = normalizeRole(role);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('assignedEvents', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.json({ success: true, data: { users, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

const createUser = async (req, res, next) => {
  try {
    const payload = pick(req.body, USER_WRITABLE_FIELDS);
    payload.role = normalizeRole(payload.role);

    let tempPassword = payload.password;
    if (!tempPassword) {
      tempPassword = crypto.randomBytes(8).toString('hex');
    }
    payload.password = await bcrypt.hash(tempPassword, 12);
    payload.isTempPassword = true;
    payload.isVerified = true;

    // Enforce phone/email if assigned events require SMS/Email
    if (Array.isArray(payload.assignedEvents) && payload.assignedEvents.length > 0) {
      const events = await Event.find({ _id: { $in: payload.assignedEvents } }).lean();
      const smsRequired = events.some((e) => e.settings?.communicationChannels?.sms === true);
      const emailRequired = events.some((e) => e.settings?.communicationChannels?.email === true);

      if (smsRequired && !String(payload.phone || '').trim()) {
        return res.status(400).json({ success: false, message: 'Phone number is required for users assigned to these events.' });
      }
      if (emailRequired && !String(payload.email || '').trim()) {
        return res.status(400).json({ success: false, message: 'Email is required for users assigned to these events.' });
      }
    }

    const user = await User.create(payload);

    // Creation already succeeded at this point — a notification failure
    // should not make the API report failure for a user that now exists.
    try {
      await notificationService.notifyUserCredentials(user, tempPassword);
    } catch (notifyErr) {
      req.app?.get('logger')?.error?.(`Failed to send credentials to user ${user._id}: ${notifyErr.message}`);
    }

    const { password, ...userResponse } = user.toObject();
    res.status(201).json({ success: true, data: { user: userResponse } });
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const payload = pick(req.body, USER_WRITABLE_FIELDS);
    if (payload.role) payload.role = normalizeRole(payload.role);

    if (payload.password && String(payload.password).trim() !== '') {
      payload.password = await bcrypt.hash(payload.password, 12);
    } else {
      delete payload.password;
    }

    const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
      .select('-password')
      .populate('assignedEvents', 'name');

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (req.body.role || req.body.assignedEvent || req.body.assignedEvents) {
      await notificationService.notifyRoleAssignment(user, user.role, user.assignedEvents);
    }

    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

const duplicateEvent = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    const { newName, newStartDate, newEndDate, status = 'draft' } = req.body;
    if (!newName || !newStartDate || !newEndDate) {
      return res.status(400).json({ success: false, message: 'New name, start date, and end date are required.' });
    }

    const sourceEvent = await Event.findById(req.params.id).lean();
    if (!sourceEvent) return res.status(404).json({ success: false, message: 'Event not found.' });

    const clonedFields = pick(sourceEvent, EVENT_WRITABLE_FIELDS);

    if (Array.isArray(clonedFields.categories)) {
      clonedFields.categories = clonedFields.categories.map((cat) => ({ ...cat, sold: 0, usageCount: 0 }));
    }

    const newEvent = await Event.create({
      ...clonedFields,
      name: newName,
      startDate: newStartDate,
      endDate: newEndDate,
      status,
      mainOrganisers: [],
      subOrganisers: [],
      staff: [],
      volunteers: [],
      auditors: [],
    });

    res.status(201).json({ success: true, data: { event: newEvent }, message: 'Event duplicated successfully.' });
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
  duplicateEvent,
};