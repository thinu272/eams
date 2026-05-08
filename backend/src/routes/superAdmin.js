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
const AuditLog = require('../models/AuditLog');
const { protect, checkRole } = require('../middleware/auth');
const crypto = require('crypto');
const notificationService = require('../services/notificationService');

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
  description: event.description || '',
  eventType: event.eventType || 'cricket',
  organiser: event.mainOrganiser ? { _id: event.mainOrganiser._id, name: event.mainOrganiser.name, email: event.mainOrganiser.email } : null,
  date: event.startDate,
  endDate: event.endDate,
  venue: event.venue?.name || '',
  status: getEventStatusLabel(event),
  lifecycleStatus: event.status,
  ticketsSold: Array.isArray(event.categories) ? event.categories.reduce((sum, category) => sum + (category.sold || 0), 0) : 0,
  ticketCapacity: Array.isArray(event.categories) ? event.categories.reduce((sum, category) => sum + (category.capacity || 0), 0) : 0,
  settings: event.settings || {},
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
  general: {
    platformName: config.general?.platformName || 'ENTRYNEX',
    supportEmail: config.general?.supportEmail || 'support@entrynex.com',
    systemStatus: config.general?.systemStatus || 'Active',
    defaultRoles: config.general?.defaultRoles || ['Attendee'],
  },
  branding: {
    logoUrl: config.branding?.logoUrl || '',
    faviconUrl: config.branding?.faviconUrl || '',
    primaryColor: config.branding?.primaryColor || '#2563eb',
    secondaryColor: config.branding?.secondaryColor || '#4f46e5',
    applyToEmails: config.branding?.applyToEmails ?? true,
    applyToTickets: config.branding?.applyToTickets ?? true,
    applyToUi: config.branding?.applyToUi ?? true,
  },
  email: {
    provider: config.email?.provider || 'smtp',
    templateMode: config.email?.templateMode || 'code',
    smtpHost: config.email?.smtpHost || '',
    smtpPort: config.email?.smtpPort || 587,
    smtpUser: config.email?.smtpUser || '',
    smtpPassword: config.email?.smtpPassword || '',
    sendgridApiKey: config.email?.sendgridApiKey || '',
    senderName: config.email?.senderName || 'ENTRYNEX',
    templates: {
      inviteSubject: config.email?.templates?.inviteSubject || "You're Invited - {{eventName}}",
      ticketSubject: config.email?.templates?.ticketSubject || 'Confirmed - Your ticket for {{eventName}}',
      resetSubject: config.email?.templates?.resetSubject || 'Password Reset Request',
    },
  },
  sms: {
    provider: config.sms?.provider || 'mock',
    apiKey: config.sms?.apiKey || '',
    apiSecret: config.sms?.apiSecret || '',
    enabled: config.sms?.enabled ?? false,
  },
  payment: {
    gateway: config.payment?.gateway || 'none',
    publishableKey: config.payment?.publishableKey || '',
    secretKey: config.payment?.secretKey || '',
    defaultCurrency: config.payment?.defaultCurrency || 'LKR',
    enabled: config.payment?.enabled ?? false,
  },
  security: {
    jwtTtlHours: config.security?.jwtTtlHours || 24,
    minPasswordLength: config.security?.minPasswordLength || 8,
    requirePasswordComplexity: config.security?.requirePasswordComplexity ?? false,
    loginRateLimit: config.security?.loginRateLimit || 5,
    emailVerificationRequired: config.security?.emailVerificationRequired ?? false,
    twoFactorEnabled: config.security?.twoFactorEnabled ?? false,
  },
  ticketing: {
    qrEnabled: config.ticketing?.qrEnabled ?? true,
    pdfEnabled: config.ticketing?.pdfEnabled ?? true,
    autoSendOnConfirm: config.ticketing?.autoSendOnConfirm ?? true,
    accessCodeToggle: config.ticketing?.accessCodeToggle ?? true,
  },
  regional: {
    defaultCurrency: config.regional?.defaultCurrency || 'LKR',
    timezone: config.regional?.timezone || 'Asia/Colombo',
    dateFormat: config.regional?.dateFormat || 'MM/DD/YYYY',
    multiCurrency: config.regional?.multiCurrency ?? false,
  },
  integrations: {
    storageProvider: config.integrations?.storageProvider || 'local',
    awsAccessKey: config.integrations?.awsAccessKey || '',
    awsSecretKey: config.integrations?.awsSecretKey || '',
    awsBucket: config.integrations?.awsBucket || '',
    mapsApiKey: config.integrations?.mapsApiKey || '',
    aiServiceKey: config.integrations?.aiServiceKey || '',
  },
});

router.use(protect, checkRole('SUPER_ADMIN'));

const getOverviewData = async () => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  const [totalEvents, totalUsers, totalTicketsSold, revenueRows, verifiedAttendees, totalAttendees, activeEvents, ticketSalesOverTime, entryLogs, zoneLogs, requestLogs] = await Promise.all([
    Event.countDocuments(),
    User.countDocuments(),
    Ticket.countDocuments({ status: { $ne: 'CANCELLED' } }),
    Order.aggregate([{ $match: { paymentStatus: 'success' } }, { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }]),
    Attendee.countDocuments({ isActive: true, photoVerificationStatus: 'verified' }),
    Attendee.countDocuments({ isActive: true }),
    Event.countDocuments({ $or: [{ status: 'ongoing' }, { startDate: { $lte: now }, endDate: { $gte: now } }] }),
    Order.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, paymentStatus: 'success' } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, d: { $dayOfMonth: '$createdAt' } }, ticketsSold: { $sum: { $sum: '$tickets.quantity' } }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]),
    EntryLog.find({}).populate('event', 'name').populate('attendee', 'fullName').sort({ timestamp: -1 }).limit(5).lean(),
    ZoneLog.find({}).populate('eventId', 'name').populate('attendeeId', 'fullName').sort({ timestamp: -1 }).limit(5).lean(),
    RequestLog.find({}).populate('userId', 'name role').sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  const totalRevenue = revenueRows[0]?.totalRevenue || 0;
  const verificationRate = totalAttendees > 0 ? ((verifiedAttendees / totalAttendees) * 100).toFixed(1) : 0;
  const avgTicketPrice = totalTicketsSold > 0 ? (totalRevenue / totalTicketsSold).toFixed(2) : 0;

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
    metrics: { 
      totalEvents, 
      totalUsers, 
      totalTicketsSold, 
      totalRevenue, 
      activeEvents,
      verificationRate,
      avgTicketPrice
    },
    ticketSalesOverTime: ticketSalesOverTime.map((row) => ({ label: `${row._id.y}-${String(row._id.m).padStart(2, '0')}-${String(row._id.d).padStart(2, '0')}`, ticketsSold: row.ticketsSold, revenue: row.revenue })),
    activity,
  };
};

const getEventsData = async (query) => {
  const events = await Event.find(buildEventFilter(query)).populate('mainOrganiser', 'name email').sort({ startDate: -1 }).limit(parsePositiveInt(query.limit, 10)).lean();
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
  const organisers = await User.find(filter).populate('assignedEvents', 'name').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 10)).lean();
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
  const users = await User.find(filter).populate('assignedEvents', 'name').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 10)).lean();
  return { rows: users.map(serializeUser), roles: USER_ROLES };
};

const getTicketsData = async (query) => {
  const filter = {};
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ ticketNumber: regex }, { categoryName: regex }];
  }
  const tickets = await Ticket.find(filter).populate('event', 'name').populate('attendee', 'fullName email').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 10)).lean();
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
    Attendee.find(filter).populate('event', 'name').populate('photoVerifiedBy', 'name').sort({ updatedAt: -1 }).limit(parsePositiveInt(query.limit, 10)).lean(),
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
  const logs = await EntryLog.find(filter).populate('event', 'name').populate('attendee', 'fullName').sort({ timestamp: -1 }).limit(parsePositiveInt(query.limit, 10)).lean();
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
    ZoneLog.find(filter).populate('eventId', 'name').populate('attendeeId', 'fullName').sort({ timestamp: -1 }).limit(parsePositiveInt(query.limit, 10)).lean(),
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
  const notifications = await Notification.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).limit(parsePositiveInt(query.limit, 10)).lean();
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
    const { 
      name, startDate, endDate, organiserId, venueName, 
      status = 'draft', description = '', eventType = 'cricket',
      requirePhotoVerification = true, allowSelfConfirmation = true, rfidEnabled = true,
      currency = 'LKR', paymentCard = true, paymentBank = true, paymentCash = true,
      communicationEmail = true, communicationSms = false 
    } = req.body;

    const event = await Event.create({ 
      name, 
      description, 
      startDate, 
      endDate, 
      status, 
      eventType,
      venue: { name: venueName || 'TBD' }, 
      mainOrganiser: organiserId || undefined, 
      createdBy: req.user._id, 
      categories: [], 
      zones: [],
      settings: {
        requirePhotoVerification,
        allowSelfConfirmation,
        rfidEnabled,
        currency,
        communicationChannels: {
          email: communicationEmail,
          sms: communicationSms,
        },
        paymentMethods: {
          card: paymentCard,
          bank_transfer: paymentBank,
          cash: paymentCash
        }
      }
    });

    if (organiserId && mongoose.Types.ObjectId.isValid(organiserId)) {
      await User.findByIdAndUpdate(organiserId, { $addToSet: { assignedEvents: event._id } });
    }

    const hydrated = await Event.findById(event._id).populate('mainOrganiser', 'name email');
    res.status(201).json({ success: true, data: { event: serializeEvent(hydrated) } });
  } catch (error) {
    next(error);
  }
});

router.patch('/events/:id', async (req, res, next) => {
  try {
    const updates = {};
    ['name', 'description', 'startDate', 'endDate', 'status', 'eventType'].forEach((field) => { 
      if (req.body[field] !== undefined) updates[field] = req.body[field]; 
    });

    if (req.body.venueName !== undefined) updates['venue.name'] = req.body.venueName;
    if (req.body.organiserId !== undefined) updates.mainOrganiser = req.body.organiserId || null;

    // Handle nested settings
    if (req.body.requirePhotoVerification !== undefined) updates['settings.requirePhotoVerification'] = req.body.requirePhotoVerification;
    if (req.body.allowSelfConfirmation !== undefined) updates['settings.allowSelfConfirmation'] = req.body.allowSelfConfirmation;
    if (req.body.rfidEnabled !== undefined) updates['settings.rfidEnabled'] = req.body.rfidEnabled;
    if (req.body.currency !== undefined) updates['settings.currency'] = req.body.currency;
    if (req.body.paymentCard !== undefined) updates['settings.paymentMethods.card'] = req.body.paymentCard;
    if (req.body.paymentBank !== undefined) updates['settings.paymentMethods.bank_transfer'] = req.body.paymentBank;
    if (req.body.paymentCash !== undefined) updates['settings.paymentMethods.cash'] = req.body.paymentCash;
    if (req.body.communicationEmail !== undefined) updates['settings.communicationChannels.email'] = req.body.communicationEmail;
    if (req.body.communicationSms !== undefined) updates['settings.communicationChannels.sms'] = req.body.communicationSms;

    const event = await Event.findByIdAndUpdate(req.params.id, updates, { new: true }).populate('mainOrganiser', 'name email');
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${req.params.id})` });

    if (req.body.organiserId && mongoose.Types.ObjectId.isValid(req.body.organiserId)) {
      await User.findByIdAndUpdate(req.body.organiserId, { $addToSet: { assignedEvents: event._id } });
    }

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
    const payload = { ...req.body, role: req.body.role || 'MainOrganiser', createdBy: req.user._id };
    
    let tempPassword = payload.password;
    if (!tempPassword) {
      tempPassword = crypto.randomBytes(8).toString('hex');
      payload.password = tempPassword;
    }
    payload.isTempPassword = true;
    payload.isVerified = true;

    console.log('CREATE ORGANISER: Attempting to create user with payload:', { ...payload, password: '[REDACTED]' });
    const organiser = await User.create(payload);
    console.log('CREATE ORGANISER: User created successfully. ID:', organiser._id);
    
    console.log('CREATE ORGANISER: Triggering notification for credentials...');
    await notificationService.notifyUserCredentials(organiser, tempPassword);
    console.log('CREATE ORGANISER: Notification triggered.');

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
    
    // Notify if critical permissions changed
    if (req.body.role || req.body.assignedEvents) {
      await notificationService.notifyRoleAssignment(organiser, organiser.role, organiser.assignedEvents);
    }

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
    const payload = { ...req.body, createdBy: req.user._id };
    
    let tempPassword = payload.password;
    if (!tempPassword) {
      tempPassword = crypto.randomBytes(8).toString('hex');
      payload.password = tempPassword;
    }
    payload.isTempPassword = true;
    payload.isVerified = true;

    console.log('CREATE USER: Attempting to create user with payload:', { ...payload, password: '[REDACTED]' });
    const user = await User.create(payload);
    console.log('CREATE USER: User created successfully. ID:', user._id);

    console.log('CREATE USER: Triggering notification for credentials...');
    await notificationService.notifyUserCredentials(user, tempPassword);
    console.log('CREATE USER: Notification triggered.');

    const hydrated = await User.findById(user._id).populate('assignedEvents', 'name');
    res.status(201).json({ success: true, data: { user: serializeUser(hydrated) } });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (req.body.password && String(req.body.password).trim() !== '') {
      updates.password = await bcrypt.hash(req.body.password, 12);
    } else {
      delete updates.password;
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true, context: 'query' }).populate('assignedEvents', 'name');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Notify if critical permissions changed
    if (req.body.role || req.body.assignedEvents) {
      await notificationService.notifyRoleAssignment(user, user.role, user.assignedEvents);
    }

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
    const previous = await SystemConfig.findOne({ key: 'global' }).lean();
    
    const setQuery = {};
    if (req.body.general) {
      if (req.body.general.platformName !== undefined) setQuery['general.platformName'] = req.body.general.platformName;
      if (req.body.general.supportEmail !== undefined) setQuery['general.supportEmail'] = req.body.general.supportEmail;
      if (req.body.general.systemStatus !== undefined) setQuery['general.systemStatus'] = req.body.general.systemStatus;
      if (req.body.general.defaultRoles !== undefined) setQuery['general.defaultRoles'] = req.body.general.defaultRoles;
    }
    if (req.body.branding) {
      if (req.body.branding.logoUrl !== undefined) setQuery['branding.logoUrl'] = req.body.branding.logoUrl;
      if (req.body.branding.faviconUrl !== undefined) setQuery['branding.faviconUrl'] = req.body.branding.faviconUrl;
      if (req.body.branding.primaryColor !== undefined) setQuery['branding.primaryColor'] = req.body.branding.primaryColor;
      if (req.body.branding.secondaryColor !== undefined) setQuery['branding.secondaryColor'] = req.body.branding.secondaryColor;
      if (req.body.branding.applyToEmails !== undefined) setQuery['branding.applyToEmails'] = req.body.branding.applyToEmails;
      if (req.body.branding.applyToTickets !== undefined) setQuery['branding.applyToTickets'] = req.body.branding.applyToTickets;
      if (req.body.branding.applyToUi !== undefined) setQuery['branding.applyToUi'] = req.body.branding.applyToUi;
    }
    if (req.body.email) {
      if (req.body.email.provider !== undefined) setQuery['email.provider'] = req.body.email.provider;
      if (req.body.email.templateMode !== undefined) setQuery['email.templateMode'] = req.body.email.templateMode;
      if (req.body.email.smtpHost !== undefined) setQuery['email.smtpHost'] = req.body.email.smtpHost;
      if (req.body.email.smtpPort !== undefined) setQuery['email.smtpPort'] = req.body.email.smtpPort;
      if (req.body.email.smtpUser !== undefined) setQuery['email.smtpUser'] = req.body.email.smtpUser;
      if (req.body.email.smtpPassword !== undefined) setQuery['email.smtpPassword'] = req.body.email.smtpPassword;
      if (req.body.email.sendgridApiKey !== undefined) setQuery['email.sendgridApiKey'] = req.body.email.sendgridApiKey;
      if (req.body.email.senderName !== undefined) setQuery['email.senderName'] = req.body.email.senderName;
      if (req.body.email.templates) {
        if (req.body.email.templates.inviteSubject !== undefined) setQuery['email.templates.inviteSubject'] = req.body.email.templates.inviteSubject;
        if (req.body.email.templates.ticketSubject !== undefined) setQuery['email.templates.ticketSubject'] = req.body.email.templates.ticketSubject;
        if (req.body.email.templates.resetSubject !== undefined) setQuery['email.templates.resetSubject'] = req.body.email.templates.resetSubject;
      }
    }
    if (req.body.sms) {
      if (req.body.sms.provider !== undefined) setQuery['sms.provider'] = req.body.sms.provider;
      if (req.body.sms.apiKey !== undefined) setQuery['sms.apiKey'] = req.body.sms.apiKey;
      if (req.body.sms.apiSecret !== undefined) setQuery['sms.apiSecret'] = req.body.sms.apiSecret;
      if (req.body.sms.enabled !== undefined) setQuery['sms.enabled'] = req.body.sms.enabled;
    }
    if (req.body.payment) {
      if (req.body.payment.gateway !== undefined) setQuery['payment.gateway'] = req.body.payment.gateway;
      if (req.body.payment.publishableKey !== undefined) setQuery['payment.publishableKey'] = req.body.payment.publishableKey;
      if (req.body.payment.secretKey !== undefined) setQuery['payment.secretKey'] = req.body.payment.secretKey;
      if (req.body.payment.defaultCurrency !== undefined) setQuery['payment.defaultCurrency'] = req.body.payment.defaultCurrency;
      if (req.body.payment.enabled !== undefined) setQuery['payment.enabled'] = req.body.payment.enabled;
    }
    if (req.body.security) {
      if (req.body.security.jwtTtlHours !== undefined) setQuery['security.jwtTtlHours'] = req.body.security.jwtTtlHours;
      if (req.body.security.minPasswordLength !== undefined) setQuery['security.minPasswordLength'] = req.body.security.minPasswordLength;
      if (req.body.security.requirePasswordComplexity !== undefined) setQuery['security.requirePasswordComplexity'] = req.body.security.requirePasswordComplexity;
      if (req.body.security.loginRateLimit !== undefined) setQuery['security.loginRateLimit'] = req.body.security.loginRateLimit;
      if (req.body.security.emailVerificationRequired !== undefined) setQuery['security.emailVerificationRequired'] = req.body.security.emailVerificationRequired;
      if (req.body.security.twoFactorEnabled !== undefined) setQuery['security.twoFactorEnabled'] = req.body.security.twoFactorEnabled;
    }
    if (req.body.ticketing) {
      if (req.body.ticketing.qrEnabled !== undefined) setQuery['ticketing.qrEnabled'] = req.body.ticketing.qrEnabled;
      if (req.body.ticketing.pdfEnabled !== undefined) setQuery['ticketing.pdfEnabled'] = req.body.ticketing.pdfEnabled;
      if (req.body.ticketing.autoSendOnConfirm !== undefined) setQuery['ticketing.autoSendOnConfirm'] = req.body.ticketing.autoSendOnConfirm;
      if (req.body.ticketing.accessCodeToggle !== undefined) setQuery['ticketing.accessCodeToggle'] = req.body.ticketing.accessCodeToggle;
    }
    if (req.body.regional) {
      if (req.body.regional.defaultCurrency !== undefined) setQuery['regional.defaultCurrency'] = req.body.regional.defaultCurrency;
      if (req.body.regional.timezone !== undefined) setQuery['regional.timezone'] = req.body.regional.timezone;
      if (req.body.regional.dateFormat !== undefined) setQuery['regional.dateFormat'] = req.body.regional.dateFormat;
      if (req.body.regional.multiCurrency !== undefined) setQuery['regional.multiCurrency'] = req.body.regional.multiCurrency;
    }
    if (req.body.integrations) {
      if (req.body.integrations.storageProvider !== undefined) setQuery['integrations.storageProvider'] = req.body.integrations.storageProvider;
      if (req.body.integrations.awsAccessKey !== undefined) setQuery['integrations.awsAccessKey'] = req.body.integrations.awsAccessKey;
      if (req.body.integrations.awsSecretKey !== undefined) setQuery['integrations.awsSecretKey'] = req.body.integrations.awsSecretKey;
      if (req.body.integrations.awsBucket !== undefined) setQuery['integrations.awsBucket'] = req.body.integrations.awsBucket;
      if (req.body.integrations.mapsApiKey !== undefined) setQuery['integrations.mapsApiKey'] = req.body.integrations.mapsApiKey;
      if (req.body.integrations.aiServiceKey !== undefined) setQuery['integrations.aiServiceKey'] = req.body.integrations.aiServiceKey;
    }

    const current = await SystemConfig.findOneAndUpdate(
      { key: 'global' },
      { $setOnInsert: { key: 'global' }, $set: setQuery },
      { new: true, upsert: true },
    );
    
    // Log the audit event
    await AuditLog.create({
      adminId: req.user._id,
      adminEmail: req.user.email,
      action: 'SETTINGS_UPDATED',
      details: {
        fieldsUpdated: Object.keys(setQuery),
        previous: previous || {},
        new: req.body
      },
      ipAddress: req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown'
    });

    res.json({ success: true, data: { settings: serializeSettings(current) } });
  } catch (error) {
    next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { type = 'all', from, to, statusCode, path, page = 1, limit = 10 } = req.query;
    const safeLimit = Math.min(parseInt(limit, 10) || 10, 100);
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
