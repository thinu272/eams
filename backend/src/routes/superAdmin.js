const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Order = require('../models/Order');
const RequestLog = require('../models/RequestLog');
const User = require('../models/User');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');
const Notification = require('../models/Notification');
const SystemConfig = require('../models/SystemConfig');
const { protect, checkRole } = require('../middleware/auth');

const router = express.Router();
const USER_ROLES = ['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Attendee'];

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const parseDateRange = (from, to, field = 'createdAt') => {
  const filter = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) filter.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      filter.$lte = toDate;
    }
  }
  return Object.keys(filter).length ? { [field]: filter } : {};
};

const getEventStatusLabel = (event) => {
  const now = new Date();
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;
  if (event.status === 'completed' || (end && end < now)) return 'Completed';
  if (event.status === 'ongoing' || (start && end && start <= now && end >= now)) return 'Live';
  return 'Upcoming';
};

const buildEventFilter = ({ status, organiser, from, to, search }) => {
  const filter = { ...parseDateRange(from, to, 'startDate') };
  if (organiser && mongoose.Types.ObjectId.isValid(organiser)) filter.mainOrganiser = organiser;
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { 'venue.name': regex }, { slug: regex }];
  }
  if (!status) return filter;
  const normalized = String(status).toLowerCase();
  const now = new Date();
  if (normalized === 'live') filter.$or = [...(filter.$or || []), { status: 'ongoing' }, { startDate: { $lte: now }, endDate: { $gte: now } }];
  else if (normalized === 'upcoming') filter.$and = [{ startDate: { $gt: now } }, { status: { $nin: ['completed', 'cancelled'] } }];
  else if (normalized === 'completed') filter.$or = [...(filter.$or || []), { status: 'completed' }, { endDate: { $lt: now } }];
  else filter.status = normalized;
  return filter;
};

const serializeEvent = (event) => ({
  _id: event._id,
  name: event.name,
  organiser: event.mainOrganiser ? { _id: event.mainOrganiser._id, name: event.mainOrganiser.name, email: event.mainOrganiser.email } : null,
  date: event.startDate,
  endDate: event.endDate,
  venue: event.venue?.name || '',
  status: getEventStatusLabel(event),
  lifecycleStatus: event.status,
  ticketsSold: Array.isArray(event.categories) ? event.categories.reduce((sum, category) => sum + (category.sold || 0), 0) : 0,
  ticketCapacity: Array.isArray(event.categories) ? event.categories.reduce((sum, category) => sum + (category.capacity || 0), 0) : 0,
  createdAt: event.createdAt,
});

const serializeOrganiser = (user, stats = {}) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  status: user.status,
  role: user.role,
  assignedEvents: Array.isArray(user.assignedEvents) ? user.assignedEvents : [],
  stats: { eventsCreated: stats.eventsCreated || 0, ticketsSold: stats.ticketsSold || 0, liveEvents: stats.liveEvents || 0 },
  createdAt: user.createdAt,
});

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  assignedEvents: Array.isArray(user.assignedEvents) ? user.assignedEvents.map((event) => ({ _id: event._id, name: event.name })) : [],
  createdAt: user.createdAt,
  lastLogin: user.lastLogin,
});

const serializeSettings = (config) => ({
  communication: {
    emailProvider: config.communication?.emailProvider || 'smtp',
    senderEmail: config.communication?.senderEmail || '',
    smsProvider: config.communication?.smsProvider || 'mock',
    smsSender: config.communication?.smsSender || '',
  },
  templates: {
    inviteSubject: config.templates?.invite?.subject || '',
    inviteSms: config.templates?.invite?.sms || '',
    confirmationSubject: config.templates?.confirmation?.subject || '',
    confirmationSms: config.templates?.confirmation?.sms || '',
    rejectionSubject: config.templates?.rejection?.subject || '',
    rejectionSms: config.templates?.rejection?.sms || '',
  },
  limits: {
    logsDays: config.retention?.logsDays || 365,
    notificationsDays: config.retention?.notificationsDays || 90,
    jwtTtlHours: config.security?.jwtTtlHours || 24,
  },
  featureToggles: {
    requirePhotoVerification: Boolean(config.security?.requirePhotoVerification),
    darkModeDefault: config.theme?.defaultMode === 'dark',
    balancedSecurity: config.security?.mode === 'balanced',
  },
});

router.use(protect, checkRole('SUPER_ADMIN'));

const getOverviewData = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const [totalEvents, totalUsers, totalTicketsSold, revenueRows, activeEvents, ticketSalesOverTime, entryLogs, zoneLogs, requestLogs] = await Promise.all([
    Event.countDocuments(),
    User.countDocuments(),
    Ticket.countDocuments({ status: { $ne: 'CANCELLED' } }),
    Order.aggregate([{ $match: { status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }]),
    Event.countDocuments({ $or: [{ status: 'ongoing' }, { startDate: { $lte: now }, endDate: { $gte: now } }] }),
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, d: { $dayOfMonth: '$createdAt' } }, ticketsSold: { $sum: { $sum: '$tickets.quantity' } }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]),
    EntryLog.find({}).populate('event', 'name').populate('attendee', 'fullName').sort({ timestamp: -1 }).limit(5).lean(),
    ZoneLog.find({}).populate('eventId', 'name').populate('attendeeId', 'fullName').sort({ timestamp: -1 }).limit(5).lean(),
    RequestLog.find({}).populate('userId', 'name role').sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const activity = [
    ...entryLogs.map((item) => ({
      _id: item._id, type: 'entry', title: `${item.attendee?.fullName || item.snapshot?.fullName || 'Attendee'} ${item.accessGranted ? 'scanned in' : 'was denied'}`, subtitle: `${item.event?.name || 'Event'} • ${item.gateName || item.zoneName || item.gateId || 'Gate'}`, createdAt: item.timestamp,
    })),
    ...zoneLogs.map((item) => ({
      _id: item._id, type: 'zone', title: `${item.attendeeId?.fullName || item.attendeeSnapshot?.fullName || 'Attendee'} ${item.action === 'ENTRY' ? 'entered' : 'left'} ${item.zoneName}`, subtitle: item.eventId?.name || 'Event', createdAt: item.timestamp,
    })),
    ...requestLogs.map((item) => ({
      _id: item._id, type: 'request', title: `${item.method} ${item.path}`, subtitle: `${item.statusCode} • ${item.userId?.name || 'System'}`, createdAt: item.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

  return {
    metrics: { totalEvents, totalUsers, totalTicketsSold, totalRevenue: revenueRows[0]?.totalRevenue || 0, activeEvents },
    ticketSalesOverTime: ticketSalesOverTime.map((row) => ({ label: `${row._id.y}-${String(row._id.m).padStart(2, '0')}-${String(row._id.d).padStart(2, '0')}`, ticketsSold: row.ticketsSold, revenue: row.revenue })),
    activity,
  };
};

const getEventsData = async (query) => {
  const events = await Event.find(buildEventFilter(query)).populate('mainOrganiser', 'name email').sort({ startDate: -1 }).limit(parsePositiveInt(query.limit, 50)).lean();
  const organiserOptions = await User.find({ role: { $in: ['MainOrganiser', 'SubOrganiser'] } }).select('name email').sort({ name: 1 }).lean();
  return { rows: events.map(serializeEvent), filters: { organiserOptions } };
};

const getOrganisersData = async (query) => {
  const filter = { role: { $in: ['MainOrganiser', 'SubOrganiser'] } };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  const organisers = await User.find(filter).populate('assignedEvents', 'name').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 50)).lean();
  const organiserIds = organisers.map((organiser) => organiser._id);
  const eventStats = await Event.aggregate([
    { $match: { mainOrganiser: { $in: organiserIds } } },
    { $group: { _id: '$mainOrganiser', eventsCreated: { $sum: 1 }, liveEvents: { $sum: { $cond: [{ $eq: ['$status', 'ongoing'] }, 1, 0] } }, ticketsSold: { $sum: { $reduce: { input: '$categories', initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.sold', 0] }] } } } } } },
  ]);
  const statsMap = new Map(eventStats.map((item) => [String(item._id), item]));
  return { rows: organisers.map((organiser) => serializeOrganiser(organiser, statsMap.get(String(organiser._id)))) };
};

const getUsersData = async (query) => {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }
  const users = await User.find(filter).populate('assignedEvents', 'name').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 75)).lean();
  return { rows: users.map(serializeUser), roles: USER_ROLES };
};

const getTicketsData = async (query) => {
  const filter = {};
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ ticketNumber: regex }, { categoryName: regex }];
  }
  const tickets = await Ticket.find(filter).populate('event', 'name').populate('attendee', 'fullName email').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 100)).lean();
  const [overbookedEvents, unassignedTickets] = await Promise.all([
    Event.aggregate([
      { $project: { name: 1, overbookedCategories: { $filter: { input: '$categories', as: 'category', cond: { $gt: ['$$category.sold', '$$category.capacity'] } } } } },
      { $match: { 'overbookedCategories.0': { $exists: true } } },
      { $limit: 10 },
    ]),
    Ticket.countDocuments({ attendee: { $exists: false }, status: { $in: ['PENDING', 'INVITED', 'PENDING_VERIFICATION'] } }),
  ]);
  return {
    rows: tickets.map((ticket) => ({ _id: ticket._id, ticketNumber: ticket.ticketNumber, event: ticket.event?.name || 'Unknown event', attendee: ticket.attendee?.fullName || 'Unassigned', attendeeEmail: ticket.attendee?.email || '', categoryName: ticket.categoryName, price: ticket.price, status: ticket.status, inviteStatus: ticket.inviteStatus })),
    anomalySummary: {
      overbookedEvents: overbookedEvents.map((event) => ({ event: event.name, categories: event.overbookedCategories.map((category) => `${category.name} (${category.sold}/${category.capacity})`) })),
      unassignedTickets,
    },
  };
};

const getVerificationData = async (query) => {
  const filter = {};
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ fullName: regex }, { email: regex }];
  }
  if (query.status) filter.photoVerificationStatus = new RegExp(`^${escapeRegex(query.status)}$`, 'i');
  const [summary, rows] = await Promise.all([
    Attendee.aggregate([{ $group: { _id: { $toLower: '$photoVerificationStatus' }, count: { $sum: 1 } } }]),
    Attendee.find(filter).populate('event', 'name').populate('photoVerifiedBy', 'name').sort({ updatedAt: -1 }).limit(parsePositiveInt(query.limit, 100)).lean(),
  ]);
  const summaryMap = summary.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  return {
    summary: { pending: summaryMap.pending || 0, rejected: summaryMap.rejected || 0, verified: summaryMap.verified || 0 },
    rows: rows.map((row) => ({ _id: row._id, attendee: row.fullName, email: row.email, event: row.event?.name || 'Unknown event', status: String(row.photoVerificationStatus || '').toLowerCase(), rejectionReason: row.photoRejectionReason || '', verifiedBy: row.photoVerifiedBy?.name || '', updatedAt: row.updatedAt })),
  };
};

const getEntryLogsData = async (query) => {
  const filter = { ...parseDateRange(query.from, query.to, 'timestamp') };
  if (query.event && mongoose.Types.ObjectId.isValid(query.event)) filter.event = query.event;
  if (query.gate) filter.$or = [{ gateName: new RegExp(escapeRegex(query.gate), 'i') }, { gateId: new RegExp(escapeRegex(query.gate), 'i') }];
  const logs = await EntryLog.find(filter).populate('event', 'name').populate('attendee', 'fullName').sort({ timestamp: -1 }).limit(parsePositiveInt(query.limit, 100)).lean();
  return { rows: logs.map((log) => ({ _id: log._id, attendee: log.attendee?.fullName || log.snapshot?.fullName || 'Unknown attendee', event: log.event?.name || 'Unknown event', gate: log.gateName || log.gateId || '-', time: log.timestamp, status: log.accessGranted ? 'Allowed' : 'Denied', action: log.action, denialReason: log.denialReason || '' })) };
};

const getZoneActivityData = async (query) => {
  const filter = { ...parseDateRange(query.from, query.to, 'timestamp') };
  if (query.event && mongoose.Types.ObjectId.isValid(query.event)) filter.eventId = query.event;
  if (query.search) filter.zoneName = new RegExp(escapeRegex(query.search), 'i');
  const [occupancy, movements] = await Promise.all([
    ZoneLog.aggregate([
      { $match: filter },
      { $group: { _id: { eventId: '$eventId', zoneName: '$zoneName' }, entries: { $sum: { $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, 0] } }, exits: { $sum: { $cond: [{ $eq: ['$action', 'EXIT'] }, 1, 0] } }, denied: { $sum: { $cond: [{ $eq: ['$accessGranted', false] }, 1, 0] } } } },
      { $lookup: { from: 'events', localField: '_id.eventId', foreignField: '_id', as: 'event' } },
      { $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
      { $sort: { entries: -1 } },
      { $limit: 50 },
    ]),
    ZoneLog.find(filter).populate('eventId', 'name').populate('attendeeId', 'fullName').sort({ timestamp: -1 }).limit(parsePositiveInt(query.limit, 50)).lean(),
  ]);
  return {
    occupancy: occupancy.map((row) => ({ event: row.event?.name || 'Unknown event', zoneName: row._id.zoneName, occupancy: Math.max((row.entries || 0) - (row.exits || 0), 0), entries: row.entries || 0, exits: row.exits || 0, denied: row.denied || 0 })),
    movements: movements.map((log) => ({ _id: log._id, attendee: log.attendeeId?.fullName || log.attendeeSnapshot?.fullName || 'Unknown attendee', event: log.eventId?.name || 'Unknown event', zoneName: log.zoneName, action: log.action, status: log.accessGranted ? 'Allowed' : 'Denied', timestamp: log.timestamp })),
  };
};

const getNotificationsData = async (query) => {
  const filter = {};
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ title: regex }, { message: regex }];
  }
  if (query.type) {
    filter.$or = [...(filter.$or || []), { 'metadata.notificationType': new RegExp(escapeRegex(query.type), 'i') }, { type: new RegExp(escapeRegex(query.type), 'i') }];
  }
  const notifications = await Notification.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 100)).lean();
  return { rows: notifications.map((notification) => ({ _id: notification._id, user: notification.user?.name || 'System', email: notification.user?.email || '', title: notification.title, message: notification.message, channel: notification.metadata?.channel || 'email', type: notification.metadata?.notificationType || notification.type, eventName: notification.metadata?.eventName || '', read: notification.read, createdAt: notification.createdAt })) };
};

const getReportsData = async (query) => {
  const eventFilter = buildEventFilter(query);
  const orderDateFilter = parseDateRange(query.from, query.to, 'createdAt');
  const entryDateFilter = parseDateRange(query.from, query.to, 'timestamp');
  const [revenue, attendance, organisers] = await Promise.all([
    Order.aggregate([
      { $match: { ...orderDateFilter, status: { $ne: 'CANCELLED' } } },
      { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: eventFilter },
      { $group: { _id: '$event._id', eventName: { $first: '$event.name' }, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 }, ticketsSold: { $sum: { $sum: '$tickets.quantity' } } } },
      { $sort: { revenue: -1 } },
    ]),
    EntryLog.aggregate([
      { $match: entryDateFilter },
      { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: eventFilter },
      { $group: { _id: '$event._id', eventName: { $first: '$event.name' }, allowedEntries: { $sum: { $cond: [{ $eq: ['$accessGranted', true] }, 1, 0] } }, deniedEntries: { $sum: { $cond: [{ $eq: ['$accessGranted', false] }, 1, 0] } } } },
      { $sort: { allowedEntries: -1 } },
    ]),
    Event.aggregate([
      { $match: eventFilter },
      { $group: { _id: '$mainOrganiser', events: { $sum: 1 }, ticketsSold: { $sum: { $reduce: { input: '$categories', initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.sold', 0] }] } } } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'organiser' } },
      { $unwind: { path: '$organiser', preserveNullAndEmptyArrays: true } },
      { $sort: { ticketsSold: -1 } },
    ]),
  ]);
  return { revenue, attendance, organisers: organisers.map((row) => ({ organiser: row.organiser?.name || 'Unassigned', events: row.events, ticketsSold: row.ticketsSold })) };
};

const getSettingsData = async () => {
  const config = await SystemConfig.findOne({ key: 'global' }).lean();
  return serializeSettings(config || new SystemConfig({ key: 'global' }));
};

router.get('/overview', async (req, res, next) => {
  try {
    res.json({ success: true, data: await getOverviewData() });
  } catch (error) {
    next(error);
  }
});

router.get('/workspace', async (req, res, next) => {
  try {
    const section = String(req.query.section || 'overview');
    const data = { overview: await getOverviewData() };
    if (section === 'events') data.events = await getEventsData(req.query);
    if (section === 'organisations') data.organisations = await getOrganisersData(req.query);
    if (section === 'users') data.users = await getUsersData(req.query);
    if (section === 'tickets') data.tickets = await getTicketsData(req.query);
    if (section === 'verification') data.verification = await getVerificationData(req.query);
    if (section === 'entry-logs') data.entryLogs = await getEntryLogsData(req.query);
    if (section === 'zone-activity') data.zoneActivity = await getZoneActivityData(req.query);
    if (section === 'notifications') data.notifications = await getNotificationsData(req.query);
    if (section === 'reports') data.reports = await getReportsData(req.query);
    if (section === 'settings') data.settings = await getSettingsData();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: { events: [], users: [] } });
    const regex = new RegExp(escapeRegex(q), 'i');
    const [events, users] = await Promise.all([
      Event.find({ $or: [{ name: regex }, { slug: regex }] }).select('name slug startDate status').limit(8).lean(),
      User.find({ $or: [{ name: regex }, { email: regex }] }).select('name email role status').limit(8).lean(),
    ]);
    res.json({ success: true, data: { events, users } });
  } catch (error) {
    next(error);
  }
});

router.post('/events', async (req, res, next) => {
  try {
    const { name, startDate, endDate, organiserId, venueName, status = 'draft', description = '' } = req.body;
    const event = await Event.create({ name, description, startDate, endDate, status, venue: { name: venueName || 'TBD' }, mainOrganiser: organiserId || undefined, createdBy: req.user._id, categories: [], zones: [] });
    if (organiserId && mongoose.Types.ObjectId.isValid(organiserId)) await User.findByIdAndUpdate(organiserId, { $addToSet: { assignedEvents: event._id } });
    const hydrated = await Event.findById(event._id).populate('mainOrganiser', 'name email');
    res.status(201).json({ success: true, data: { event: serializeEvent(hydrated) } });
  } catch (error) {
    next(error);
  }
});

router.patch('/events/:id', async (req, res, next) => {
  try {
    const updates = {};
    ['name', 'description', 'startDate', 'endDate', 'status'].forEach((field) => { if (req.body[field] !== undefined) updates[field] = req.body[field]; });
    if (req.body.venueName !== undefined) updates['venue.name'] = req.body.venueName;
    if (req.body.organiserId !== undefined) updates.mainOrganiser = req.body.organiserId || null;
    const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true }).populate('mainOrganiser', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    if (req.body.organiserId && mongoose.Types.ObjectId.isValid(req.body.organiserId)) await User.findByIdAndUpdate(req.body.organiserId, { $addToSet: { assignedEvents: event._id } });
    res.json({ success: true, data: { event: serializeEvent(event) } });
  } catch (error) {
    next(error);
  }
});

router.delete('/events/:id', async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    await User.updateMany({}, { $pull: { assignedEvents: event._id } });
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/organisers', async (req, res, next) => {
  try {
    const organiser = await User.create({ ...req.body, role: req.body.role || 'MainOrganiser', createdBy: req.user._id });
    const hydrated = await User.findById(organiser._id).populate('assignedEvents', 'name');
    res.status(201).json({ success: true, data: { organiser: serializeOrganiser(hydrated) } });
  } catch (error) {
    next(error);
  }
});

router.patch('/organisers/:id', async (req, res, next) => {
  try {
    const organiser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('assignedEvents', 'name');
    if (!organiser) return res.status(404).json({ success: false, message: 'Organiser not found' });
    res.json({ success: true, data: { organiser: serializeOrganiser(organiser) } });
  } catch (error) {
    next(error);
  }
});

router.delete('/organisers/:id', async (req, res, next) => {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account from this dashboard.' });
    }
    const organiser = await User.findOneAndDelete({ _id: req.params.id, role: { $in: ['MainOrganiser', 'SubOrganiser'] } });
    if (!organiser) return res.status(404).json({ success: false, message: 'Organiser not found' });
    await Event.updateMany(
      { $or: [{ mainOrganiser: organiser._id }, { createdBy: organiser._id }] },
      { $unset: { mainOrganiser: '' } },
    );
    res.json({ success: true, message: 'Organiser deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const user = await User.create({ ...req.body, createdBy: req.user._id });
    const hydrated = await User.findById(user._id).populate('assignedEvents', 'name');
    res.status(201).json({ success: true, data: { user: serializeUser(hydrated) } });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 12);
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true, context: 'query' }).populate('assignedEvents', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user: serializeUser(user) } });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account from this dashboard.' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await Event.updateMany({ mainOrganiser: user._id }, { $unset: { mainOrganiser: '' } });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).populate('assignedEvents', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: { user: serializeUser(user) } });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/resend', async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    notification.metadata = { ...(notification.metadata || {}), resentAt: new Date(), resentBy: req.user._id };
    await notification.save();
    res.json({ success: true, message: 'Notification queued for resend' });
  } catch (error) {
    next(error);
  }
});

router.get('/reports/export', async (req, res, next) => {
  try {
    const type = String(req.query.type || 'revenue');
    const reports = await getReportsData(req.query);
    const rows = type === 'attendance' ? reports.attendance : reports.revenue;
    const headers = Object.keys(rows[0] || { message: 'No data' });
    const bodyRows = rows.length ? rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')) : ['"No data available"'];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send([headers.join(','), ...bodyRows].join('\n'));
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    res.json({ success: true, data: { settings: await getSettingsData() } });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const current = await SystemConfig.findOneAndUpdate(
      { key: 'global' },
      {
        $setOnInsert: { key: 'global' },
        $set: {
          'communication.emailProvider': req.body.communication?.emailProvider || 'smtp',
          'communication.senderEmail': req.body.communication?.senderEmail || '',
          'communication.smsProvider': req.body.communication?.smsProvider || 'mock',
          'communication.smsSender': req.body.communication?.smsSender || '',
          'templates.invite.subject': req.body.templates?.inviteSubject || '',
          'templates.invite.sms': req.body.templates?.inviteSms || '',
          'templates.confirmation.subject': req.body.templates?.confirmationSubject || '',
          'templates.confirmation.sms': req.body.templates?.confirmationSms || '',
          'templates.rejection.subject': req.body.templates?.rejectionSubject || '',
          'templates.rejection.sms': req.body.templates?.rejectionSms || '',
          'retention.logsDays': req.body.limits?.logsDays || 365,
          'retention.notificationsDays': req.body.limits?.notificationsDays || 90,
          'security.jwtTtlHours': req.body.limits?.jwtTtlHours || 24,
          'security.requirePhotoVerification': Boolean(req.body.featureToggles?.requirePhotoVerification),
          'security.mode': req.body.featureToggles?.balancedSecurity ? 'balanced' : 'strict',
          'theme.defaultMode': req.body.featureToggles?.darkModeDefault ? 'dark' : 'light',
        },
      },
      { new: true, upsert: true },
    );
    res.json({ success: true, data: { settings: serializeSettings(current) } });
  } catch (error) {
    next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { type = 'all', from, to, statusCode, path, page = 1, limit = 25 } = req.query;
    const safeLimit = Math.min(parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;
    const filter = { ...parseDateRange(from, to) };
    if (type === 'errors') filter.statusCode = { $gte: 400 };
    if (statusCode) filter.statusCode = parseInt(statusCode, 10);
    if (path) filter.path = { $regex: path, $options: 'i' };
    const [logs, total] = await Promise.all([
      RequestLog.find(filter).populate('userId', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      RequestLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { logs, total, page: Math.floor(skip / safeLimit) + 1, pages: Math.ceil(total / safeLimit) } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
