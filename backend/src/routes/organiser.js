const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');
const Notification = require('../models/Notification');
const Role = require('../models/Role');
const Order = require('../models/Order');
const { protect, checkRole, requireEventAccess, requirePermission } = require('../middleware/auth');
const { notifyInvite, notifyPhotoRejectionNotification, notifyStatusChange, notifySubOrganiserInvite, notifyUserCredentials } = require('../services/notificationService');
const { upload, handleS3Upload } = require('../middleware/s3Upload');
const { ROLES, ROLE_LEVELS, normalizeRole, hasRolePower } = require('../utils/rbac');
const Sponsor = require('../models/Sponsor');
const { logActivity } = require('../utils/logger');

const router = express.Router();
const ORGANISER_ROLES = ['sub_organiser', 'main_organiser', 'main_admin', 'super_admin'];

// Local storage for event images
const uploadDir = path.join(__dirname, '../../uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const localUpload = multer({ storage });

const toObjectId = (value) => new mongoose.Types.ObjectId(value);
const normalizeSearch = (value) => String(value || '').trim();
const clamp = (value, min, max, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const buildActivityNotification = async ({ userId, eventId, title, message, type = 'info', metadata = {} }) => {
  if (!userId) return null;

  return Notification.create({
    user: userId,
    title,
    message,
    type,
    metadata: {
      eventId: String(eventId),
      ...metadata,
    },
  });
};

const slugify = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const resolveEventId = (req) => {
  if (req.resolvedEventId) {
    console.log(`[resolveEventId] Using middleware resolved event ID: ${req.resolvedEventId}`);
    return req.resolvedEventId;
  }
  const id = req.params.eventId || req.body.eventId || req.query.eventId;
  console.log(`[resolveEventId] Resolved from params/body/query: ${id}`);
  if (id && id !== 'undefined') return id;
  const fallback = req.user?.assignedEvents?.[0];
  console.log(`[resolveEventId] Fallback to assignedEvents[0]: ${fallback}`);
  return fallback;
};

const getScopedEvent = async (req) => {
  let eventId = resolveEventId(req);
  let event = null;

  // 1. Try to find the event by identified ID
  if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
    event = await Event.findById(eventId)
      .populate('mainOrganisers', 'name email phone')
      .populate({
        path: 'subOrganisers',
        select: 'name email phone status permissions assignedEvents assignedGates assignedZones customRole responsibilities',
        populate: { path: 'customRole', select: 'name slug permissions zoneIds' },
      })
      .lean();
  }

  // 2. If not found or no ID provided, fallback for high-level roles
  if (!event && req.user) {
    const role = normalizeRole(req.user.role);
    if (role === ROLES.MAIN_ADMIN || role === ROLES.MAIN_ORGANISER) {
      // Pick the most recent event
      event = await Event.findOne()
        .sort({ createdAt: -1 })
        .populate('mainOrganisers', 'name email phone')
        .populate({
          path: 'subOrganisers',
          select: 'name email phone status permissions assignedEvents assignedGates assignedZones customRole responsibilities',
          populate: { path: 'customRole', select: 'name slug permissions zoneIds' },
        })
        .lean();
    }
  }

  return event;
};

const getWritableScopedEvent = async (req) => {
  const requestedId = resolveEventId(req);
  let event = null;

  if (requestedId && mongoose.Types.ObjectId.isValid(requestedId)) {
    event = await Event.findById(requestedId);
  }

  if (event || !req.user) return { event, requestedId };

  const role = normalizeRole(req.user.role);
  if (![ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) {
    return { event: null, requestedId };
  }

  const assignedEventIds = (req.user.assignedEvents || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (assignedEventIds.length) {
    event = await Event.findOne({ _id: { $in: assignedEventIds } }).sort({ createdAt: -1 });
  }

  if (!event && role === ROLES.MAIN_ORGANISER) {
    event = await Event.findOne({
      $or: [{ createdBy: req.user._id }, { mainOrganisers: req.user._id }],
    }).sort({ createdAt: -1 });
  }

  if (!event && role === ROLES.MAIN_ADMIN) {
    event = await Event.findOne().sort({ createdAt: -1 });
  }

  if (event) {
    req.resolvedEventId = event._id;
    req.body.eventId = String(event._id);
    req.query.eventId = String(event._id);
    console.log(`[getWritableScopedEvent] Recovered stale event ID ${requestedId} -> ${event._id}`);
  }

  return { event, requestedId };
};

const buildAttendeeFilter = ({ eventId, query = {} }) => {
  const {
    search = '',
    status = '',
    category = '',
    ticketCategory = '',
    photoStatus = '',
  } = query;

  const filter = { event: eventId, isActive: true };
  const trimmedSearch = normalizeSearch(search);

  if (trimmedSearch) {
    filter.$or = [
      { fullName: { $regex: trimmedSearch, $options: 'i' } },
      { email: { $regex: trimmedSearch, $options: 'i' } },
      { phone: { $regex: trimmedSearch, $options: 'i' } },
      { nationalId: { $regex: trimmedSearch, $options: 'i' } },
    ];
  }

  if (category || ticketCategory) filter.categoryName = category || ticketCategory;
  if (status) filter.confirmationStatus = status;
  if (photoStatus) filter.photoVerificationStatus = photoStatus;

  return filter;
};

const mapInviteRow = (ticket) => ({
  _id: ticket._id,
  inviteStatus: ticket.inviteStatus || 'PENDING',
  ticketStatus: ticket.status,
  inviteSentAt: ticket.inviteSentAt,
  inviteRespondedAt: ticket.inviteRespondedAt,
  inviteExpiresAt: ticket.inviteExpiresAt,
  categoryId: ticket.categoryId,
  categoryName: ticket.categoryName,
  slotIndex: ticket.slotIndex,
  attendee: ticket.attendee ? {
    _id: ticket.attendee._id,
    fullName: ticket.attendee.fullName,
    email: ticket.attendee.email,
    phone: ticket.attendee.phone,
    confirmationStatus: ticket.attendee.confirmationStatus,
    confirmationToken: ticket.attendee.confirmationToken,
  } : null,
  inviteHistory: [
    ticket.inviteSentAt ? { type: 'sent', at: ticket.inviteSentAt } : null,
    ticket.inviteRespondedAt ? { type: String(ticket.inviteStatus || '').toLowerCase(), at: ticket.inviteRespondedAt } : null,
  ].filter(Boolean),
});

const getTicketCategorySummary = async (event) => {
  const ticketSummary = await Ticket.aggregate([
    { $match: { event: toObjectId(event._id) } },
    {
      $group: {
        _id: '$categoryId',
        categoryName: { $first: '$categoryName' },
        soldCount: { $sum: 1 },
        assignedCount: {
          $sum: {
            $cond: [{ $ifNull: ['$attendee', false] }, 1, 0],
          },
        },
      },
    },
  ]);

  const summaryByCategory = new Map(ticketSummary.map((item) => [item._id, item]));

  return (event.categories || []).map((category) => {
    const live = summaryByCategory.get(category.id) || {};
    const soldCount = live.soldCount || category.sold || 0;
    const assignedCount = live.assignedCount || 0;

    return {
      id: category.id,
      name: category.name,
      description: category.description || '',
      price: category.price,
      capacity: category.capacity,
      soldCount,
      assignedCount,
      unassignedCount: Math.max(soldCount - assignedCount, 0),
      remainingCapacity: Math.max(category.capacity - soldCount, 0),
      allowedZones: category.allowedZones || [],
      color: category.color || '#3B82F6',
      isPrivate: !!category.isPrivate,
      accessCode: category.accessCode || '',
      maxUsage: category.maxUsage || null,
      assignedSubOrganisers: category.assignedSubOrganisers || [],
      createdBy: category.createdBy || null,
      isVisible: category.isVisible !== false,
    };
  });
};

const requireScopedEvent = async (req, res, next) => {
  const event = await getScopedEvent(req);

  if (!event) {
    const resolvedId = resolveEventId(req);
    return res.status(404).json({ success: false, message: `Scoped event not found. (ID: ${resolvedId})` });
  }

  req.scopedEvent = event;
  return next();
};

router.use(protect, checkRole(ORGANISER_ROLES));

router.get('/workspace', requireEventAccess, requirePermission('canViewDashboard'), requireScopedEvent, async (req, res, next) => {
  try {
    const eventId = String(req.scopedEvent._id);
    const page = clamp(req.query.page, 1, 9999, 1);
    const invitesPage = clamp(req.query.invitesPage, 1, 9999, 1);
    const entryLogsPage = clamp(req.query.entryLogsPage, 1, 9999, 1);
    const notificationsPage = clamp(req.query.notificationsPage, 1, 9999, 1);
    const zoneLogsPage = clamp(req.query.zoneLogsPage, 1, 9999, 1);
    const teamPage = clamp(req.query.teamPage, 1, 9999, 1);
    const verificationPage = clamp(req.query.verificationPage, 1, 9999, 1);

    const limit = clamp(req.query.limit, 1, 50, 10);
    const logsLimit = limit;

    const attendeeSkip = (page - 1) * limit;
    const invitesSkip = (invitesPage - 1) * limit;
    const entryLogsSkip = (entryLogsPage - 1) * logsLimit;
    const notificationsSkip = (notificationsPage - 1) * limit;
    const zoneLogsSkip = (zoneLogsPage - 1) * limit;
    const teamSkip = (teamPage - 1) * limit;
    const verificationSkip = (verificationPage - 1) * limit;

    const attendeeFilter = buildAttendeeFilter({ eventId, query: req.query });

    const [
      totalTickets,
      ticketsSold,
      confirmedAttendees,
      checkedInCount,
      entryLogTotal,
      zoneOccupancyRows,
      hourlyCheckins,
      recentEntries,
      recentNotifications,
      attendeeRows,
      attendeeTotal,
      pendingVerificationRows,
      pendingVerificationTotal,
      inviteRows,
      inviteTotal,
      zoneRows,
      zoneTotal,
      notificationRows,
      notificationTotal,
      ticketCategories,
      customRoles,
      teamMembers,
      teamTotal,
      revenueByCategory,
      sponsors,
    ] = await Promise.all([
      Ticket.countDocuments({ event: eventId }),
      Ticket.countDocuments({ event: eventId, status: { $ne: 'CANCELLED' } }),
      Attendee.countDocuments({ event: eventId, isActive: true, confirmationStatus: 'confirmed' }),
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true }),
      EntryLog.countDocuments({ event: eventId }),
      ZoneLog.aggregate([
        { $match: { eventId: toObjectId(eventId), accessGranted: true } },
        { $group: { _id: { zoneName: '$zoneName', action: '$action' }, count: { $sum: 1 } } },
      ]),
      EntryLog.aggregate([
        { $match: { event: toObjectId(eventId), action: 'check_in', accessGranted: true } },
        { $group: { _id: { $hour: '$timestamp' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            hour: '$_id',
            label: { $concat: [{ $toString: '$_id' }, ':00'] },
            count: 1,
          },
        },
      ]),
      EntryLog.find({ event: eventId }).populate('attendee', 'fullName categoryName').sort({ timestamp: -1 }).skip(entryLogsSkip).limit(logsLimit).lean(),
      Notification.find({ 'metadata.eventId': eventId }).sort({ createdAt: -1 }).limit(5).lean(),
      Attendee.find(attendeeFilter).sort({ createdAt: -1 }).skip(attendeeSkip).limit(limit).lean(),
      Attendee.countDocuments(attendeeFilter),
      Attendee.find({ event: eventId, isActive: true, photoVerificationStatus: { $in: ['pending', 'Pending'] } }).sort({ createdAt: -1 }).skip(verificationSkip).limit(limit).lean(),
      Attendee.countDocuments({ event: eventId, isActive: true, photoVerificationStatus: { $in: ['pending', 'Pending'] } }),
      Ticket.find({ event: eventId }).populate('attendee', 'fullName email phone confirmationStatus confirmationToken').sort({ inviteSentAt: -1, createdAt: -1 }).skip(invitesSkip).limit(limit).lean(),
      Ticket.countDocuments({ event: eventId }),
      ZoneLog.find({ eventId }).populate('attendeeId', 'fullName categoryName').populate('scannedBy', 'name').sort({ timestamp: -1 }).skip(zoneLogsSkip).limit(limit).lean(),
      ZoneLog.countDocuments({ eventId }),
      Notification.find({ 'metadata.eventId': eventId }).sort({ createdAt: -1 }).skip(notificationsSkip).limit(limit).lean(),
      Notification.countDocuments({ 'metadata.eventId': eventId }),
      getTicketCategorySummary(req.scopedEvent),
      Role.find({ event: eventId }).sort({ createdAt: -1 }).lean(),
      User.find({
        assignedEvents: toObjectId(eventId),
        role: { $in: [ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR, ROLES.NONE] },
      })
        .select('name email phone role status permissions assignedEvents assignedGates assignedZones customRole responsibilities createdBy')
        .populate('customRole')
        .populate('createdBy', 'name email role')
        .sort({ role: 1, createdAt: -1 })
        .skip(teamSkip)
        .limit(limit)
        .lean(),
      User.countDocuments({
        assignedEvents: toObjectId(eventId),
        role: { $in: [ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR, ROLES.NONE] },
      }),
      Ticket.aggregate([
        { $match: { event: toObjectId(eventId), status: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$categoryName', revenue: { $sum: '$price' }, count: { $sum: 1 } } },
        { $project: { name: '$_id', value: '$revenue', count: 1, _id: 0 } },
      ]),
      Sponsor.find({ eventId: toObjectId(eventId) }).lean(),
    ]);

    const zoneOccupancy = {};
    zoneOccupancyRows.forEach((row) => {
      const current = zoneOccupancy[row._id.zoneName] || { zoneName: row._id.zoneName, entries: 0, exits: 0, occupancy: 0 };
      if (row._id.action === 'ENTRY') current.entries = row.count;
      if (row._id.action === 'EXIT') current.exits = row.count;
      current.occupancy = Math.max(current.entries - current.exits, 0);
      zoneOccupancy[row._id.zoneName] = current;
    });
    const topZoneOccupancy = Object.values(zoneOccupancy).sort((a, b) => b.occupancy - a.occupancy)[0]?.occupancy || 0;

    const activityFeed = [...recentEntries.map((row) => ({
      id: `entry-${row._id}`,
      type: 'entry',
      title: row.accessGranted ? 'Entry activity' : 'Denied access',
      message: `${row.attendee?.fullName || row.snapshot?.fullName || 'Attendee'} ${row.accessGranted ? row.action.replace('_', ' ') : 'denied'} at ${row.gateName || row.zoneName || 'gate'}`,
      timestamp: row.timestamp,
    })), ...recentNotifications.map((row) => ({
      id: `notification-${row._id}`,
      type: row.metadata?.actionType || 'notification',
      title: row.title,
      message: row.message,
      timestamp: row.createdAt,
    }))]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    const totalRevenue = (revenueByCategory || []).reduce((acc, curr) => acc + curr.value, 0);

    res.json({
      success: true,
      data: {
        event: {
          _id: req.scopedEvent._id,
          name: req.scopedEvent.name,
          description: req.scopedEvent.description || '',
          eventType: req.scopedEvent.eventType || '',
          startDate: req.scopedEvent.startDate,
          endDate: req.scopedEvent.endDate,
          timezone: req.scopedEvent.timezone || 'Asia/Colombo',
          venue: req.scopedEvent.venue,
          status: req.scopedEvent.status,
          zones: req.scopedEvent.zones || [],
          settings: req.scopedEvent.settings || {},
          branding: req.scopedEvent.branding || {},
          coverImage: req.scopedEvent.coverImage || '',
          logoImage: req.scopedEvent.logoImage || '',
          bannerImage: req.scopedEvent.bannerImage || '',
          matchDetails: req.scopedEvent.matchDetails || {},
          concertDetails: req.scopedEvent.concertDetails || {},
          conferenceDetails: req.scopedEvent.conferenceDetails || {},
          sponsorPackages: req.scopedEvent.sponsorPackages || [],
          customEventType: req.scopedEvent.customEventType || '',
        },
        overview: { totalTickets, ticketsSold, confirmedAttendees, checkedInCount, totalRevenue, zoneOccupancy: topZoneOccupancy },
        charts: { 
          checkinsOverTime: hourlyCheckins,
          revenueByCategory: revenueByCategory,
        },
        activityFeed,
        attendees: {
          rows: attendeeRows,
          total: attendeeTotal,
          page,
          pages: Math.ceil(attendeeTotal / limit) || 1,
        },
        tickets: ticketCategories,
        subOrganisers: req.scopedEvent.subOrganisers || [],
        teamMembers,
        teamPage,
        teamPages: Math.ceil(teamTotal / limit) || 1,
        teamTotal,
        customRoles,
        verificationQueue: pendingVerificationRows,
        verificationPage,
        verificationPages: Math.ceil(pendingVerificationTotal / limit) || 1,
        verificationTotal: pendingVerificationTotal,
        invites: inviteRows.map(mapInviteRow),
        invitesPage,
        invitesPages: Math.ceil(inviteTotal / limit) || 1,
        entryLogs: recentEntries,
        entryLogsPage,
        entryLogsPages: Math.ceil(entryLogTotal / logsLimit) || 1,
        zoneLogs: zoneRows,
        zoneLogsPage,
        zoneLogsPages: Math.ceil(zoneTotal / limit) || 1,
        zoneOccupancy: Object.values(zoneOccupancy),
        notifications: notificationRows,
        notificationsPage,
        notificationsPages: Math.ceil(notificationTotal / limit) || 1,
        sponsors: sponsors || [],
        reports: {
          available: [
            { id: 'attendees', label: 'Attendee List', exportType: 'attendees' },
            { id: 'tickets', label: 'Ticket Categories', exportType: 'tickets' },
            { id: 'logs', label: 'Entry Logs', exportType: 'logs' },
          ],
        },
        settings: req.scopedEvent.settings || {},
        customization: {
          basicInfo: {
            name: req.scopedEvent.name,
            description: req.scopedEvent.description || '',
            startDate: req.scopedEvent.startDate,
            endDate: req.scopedEvent.endDate,
            venue: req.scopedEvent.venue || {},
            currency: req.scopedEvent.settings?.currency || 'LKR',
          },
          branding: {
            bannerImage: req.scopedEvent.bannerImage || req.scopedEvent.branding?.bannerImage || '',
            logoImage: req.scopedEvent.logoImage || req.scopedEvent.branding?.logoImage || '',
            themeColor: req.scopedEvent.branding?.themeColor || '#2563EB',
          },
          customFields: req.scopedEvent.customFields || [],
          accessRules: req.scopedEvent.settings?.accessRules || {},
          confirmationFlow: {
            inviteSystemEnabled: req.scopedEvent.settings?.inviteSystemEnabled !== false,
            manualApprovalEnabled: !!req.scopedEvent.settings?.manualApprovalEnabled,
            autoConfirmEnabled: !!req.scopedEvent.settings?.autoConfirmEnabled,
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/attendees', requireEventAccess, requirePermission('canViewAttendees'), async (req, res, next) => {
  try {
    const eventId = resolveEventId(req);
    const page = clamp(req.query.page, 1, 9999, 1);
    const limit = clamp(req.query.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const filter = buildAttendeeFilter({ eventId, query: req.query });

    // ENFORCE SCOPING: Sub-organisers only see attendees in categories they are assigned to
    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole === ROLES.SUB_ORGANISER) {
      const event = await Event.findById(eventId).select('categories');
      if (event) {
        const myCategoryNames = (event.categories || [])
          .filter(cat => (cat.assignedSubOrganisers || []).some(id => String(id) === String(req.user._id)))
          .map(cat => cat.name);
        
        if (myCategoryNames.length > 0) {
          // If a specific category was requested, ensure it's one they have access to
          if (filter.categoryName) {
            if (!myCategoryNames.includes(filter.categoryName)) {
              return res.json({ success: true, data: { attendees: [], total: 0, page, pages: 0 } });
            }
          } else {
            // Otherwise, filter by all their assigned categories
            filter.categoryName = { $in: myCategoryNames };
          }
        } else {
          // If not assigned to ANY category, they see nothing (or maybe everything? 
          // Usually better to be restrictive if "private tickets" are involved)
          // But if they are a sub-organiser, they might have general event access.
          // The user said "with for that ticket can assign sub organizers to the if wanted".
          // This implies delegation.
          // However, if we don't find any assignments, we might want to check if they have general event access.
          // For now, let's be restrictive to the categories they are assigned to if they ARE assigned to some.
          // If they aren't assigned to ANY, we'll let them see all UNLESS there are private categories.
        }
      }
    }

    const [attendees, total] = await Promise.all([
      Attendee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Attendee.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        attendees,
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/attendees',
  requirePermission(['canAddAttendees', 'canEditAttendees']),
  upload.single('photo'),
  handleS3Upload('attendee-photos'),
  [
    body('eventId').notEmpty().withMessage('eventId is required'),
    body('fullName').notEmpty().withMessage('Name is required'),
    body('categoryId').notEmpty().withMessage('Category is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { eventId, fullName, nationalId, dateOfBirth, email, phone, categoryId } = req.body;
      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

      const category = (event.categories || []).find((item) => item.id === categoryId);
      if (!category) return res.status(400).json({ success: false, message: 'Invalid category for this event.' });

      const confirmationToken = uuidv4();
      const attendee = await Attendee.create({
        fullName,
        nationalId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        email,
        phone,
        event: eventId,
        categoryId,
        categoryName: category.name,
        allowedZones: category.allowedZones || [],
        addedBy: req.user._id,
        addedVia: 'manual',
        confirmationStatus: 'pending',
        photoVerificationStatus: 'pending',
        photo: req.s3Data?.url,
        photoS3Key: req.s3Data?.key,
        photoUploadedAt: req.s3Data ? new Date() : undefined,
        confirmationToken
      });

      await logActivity({
        req,
        action: 'ticket_creation',
        eventId,
        details: { message: `Attendee created manually: ${fullName} (${category.name})` }
      });

      // Create a complimentary ticket for the manual attendee
      const orderCount = await Order.countDocuments({ eventId });
      const order = new Order({
        eventId,
        buyerName: fullName,
        buyerEmail: email || 'manual@entrynex.com',
        buyerPhone: phone || '',
        totalAmount: 0,
        status: 'CONFIRMED',
        paymentStatus: 'success',
        orderNumber: `MAN-${Date.now()}-${orderCount + 1}`,
        confirmationToken: uuidv4()
      });
      await order.save();
      
      // Update sold count in Event categories
      const updateData = { 'categories.$.sold': 1 };
      if (category.isPrivate) {
        updateData['categories.$.usageCount'] = 1;
      }

      await Event.updateOne(
        { _id: eventId, 'categories.id': categoryId },
        { $inc: updateData }
      );

      const ticket = new Ticket({
        event: eventId,
        order: order._id,
        attendee: attendee._id,
        categoryId,
        categoryName: category.name,
        allowedZones: category.allowedZones || [],
        price: 0,
        slotIndex: 1,
        status: 'ASSIGNED',
        inviteToken: confirmationToken,
        inviteEmail: email,
        invitePhone: phone
      });
      await ticket.save();

      await buildActivityNotification({
        userId: req.user._id,
        eventId,
        title: 'Attendee created',
        message: `${attendee.fullName} was added to ${event.name}.`,
        type: 'success',
        metadata: { actionType: 'attendee_create', attendeeId: String(attendee._id) },
      });

      // UPDATE SOLD COUNT AND BROADCAST
      await Event.updateOne(
        { _id: eventId, 'categories.id': categoryId },
        { $inc: { 'categories.$.sold': 1 } }
      );

      const { emitDashboardEvent } = require('../utils/socket');
      const io = req.app.get('io');
      emitDashboardEvent(io, 'event_update', eventId, {
        type: 'MANUAL_ADDITION',
        eventId,
        categoryId
      });

      res.status(201).json({ success: true, data: { attendee }, message: 'Attendee added.' });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/attendees/bulk', requirePermission('canBulkUpload'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file is required.' });

    const { eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const docs = [];
    const errors = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2;
      const fullName = String(row['Full Name'] || '').trim();
      const categoryId = String(row['Category ID'] || '').trim();
      const category = (event.categories || []).find((item) => item.id === categoryId);

      if (!fullName) {
        errors.push({ row: rowNum, message: 'Full Name is required.' });
        return;
      }

      if (!category) {
        errors.push({ row: rowNum, message: `Invalid category id: ${categoryId || '(empty)'}` });
        return;
      }

      const confirmationToken = uuidv4();
      docs.push({
        fullName,
        nationalId: String(row['National ID'] || '').trim(),
        dateOfBirth: row['Date of Birth (YYYY-MM-DD)'] ? new Date(row['Date of Birth (YYYY-MM-DD)']) : undefined,
        email: String(row.Email || '').trim(),
        phone: String(row.Phone || '').trim(),
        event: eventId,
        categoryId: category.id,
        categoryName: category.name,
        allowedZones: category.allowedZones || [],
        confirmationStatus: 'pending',
        photoVerificationStatus: 'pending',
        addedVia: 'bulk_upload',
        addedBy: req.user._id,
        confirmationToken
      });
    });

    if (docs.length) {
      const createdAttendees = await Attendee.insertMany(docs);
      
      // Create a single order for this bulk batch
      const bulkOrder = new Order({
        eventId,
        buyerName: `Bulk Upload (${req.user.name})`,
        buyerEmail: req.user.email,
        totalAmount: 0,
        status: 'CONFIRMED',
        paymentStatus: 'success',
        orderNumber: `BULK-${Date.now()}`,
        confirmationToken: uuidv4()
      });
      await bulkOrder.save();

      // Create tickets for bulk attendees
      const ticketDocs = createdAttendees.map((attendee, idx) => ({
        event: eventId,
        order: bulkOrder._id,
        attendee: attendee._id,
        categoryId: attendee.categoryId,
        categoryName: attendee.categoryName,
        allowedZones: attendee.allowedZones || [],
        price: 0,
        slotIndex: idx + 1,
        status: 'ASSIGNED',
        inviteToken: attendee.confirmationToken,
        inviteEmail: attendee.email,
        invitePhone: attendee.phone,
        ticketNumber: `TKT-BULK-${Date.now()}-${idx + 1}`
      }));
      
      if (ticketDocs.length) {
        await Ticket.insertMany(ticketDocs);
      }

      // Send confirmation invites for bulk-uploaded attendees that have an email address
      const inviteTasks = createdAttendees.map((attendee) => {
        if (!attendee.email) return Promise.resolve({ skipped: true, reason: 'No email provided', attendeeId: attendee._id });
        return notifyInvite({
          attendee,
          event,
          email: attendee.email,
          phone: attendee.phone,
        }).then(() => ({ skipped: false, attendeeId: attendee._id }))
          .catch((error) => {
            console.error('BULK INVITE ERROR:', error, 'attendeeId:', attendee._id);
            return { skipped: false, attendeeId: attendee._id, error: error.message || 'invite failed' };
          });
      });
      const inviteResults = await Promise.all(inviteTasks);
      const invitesSent = inviteResults.filter((result) => !result.skipped && !result.error).length;
      const invitesSkipped = inviteResults.filter((result) => result.skipped).length;
      const inviteFailures = inviteResults.filter((result) => result.error).length;

      // Update Event Sold Counts
      const categoryCounts = {};
      docs.forEach(d => {
        categoryCounts[d.categoryId] = (categoryCounts[d.categoryId] || 0) + 1;
      });
      
      const updatePromises = Object.entries(categoryCounts).map(([catId, count]) => {
        const category = (event.categories || []).find(c => c.id === catId);
        const updateData = { 'categories.$.sold': count };
        if (category?.isPrivate) {
          updateData['categories.$.usageCount'] = count;
        }

        return Event.updateOne(
          { _id: eventId, 'categories.id': catId },
          { $inc: updateData }
        );
      });
      await Promise.all(updatePromises);

      await logActivity({
        req,
        action: 'ticket_creation',
        eventId,
        details: { message: `Bulk uploaded ${docs.length} attendees / tickets` }
      });
    }

    await buildActivityNotification({
      userId: req.user._id,
      eventId,
      title: 'Bulk attendee upload complete',
      message: `${docs.length} attendee records imported${errors.length ? ` with ${errors.length} row issues` : ''}.`,
      type: errors.length ? 'warning' : 'success',
      metadata: {
        actionType: 'attendee_bulk_upload',
        created: docs.length,
        errorCount: errors.length,
        invitesSent,
        invitesSkipped,
        inviteFailures,
      },
    });

    res.json({
      success: true,
      data: {
        created: docs.length,
        errors,
        invitesSent,
        invitesSkipped,
        inviteFailures,
      },
      message: `${docs.length} attendees created. ${invitesSent} invite emails sent${inviteFailures ? `, ${inviteFailures} failed` : ''}${invitesSkipped ? `, ${invitesSkipped} skipped due to missing email` : ''}.`,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/attendee/:id', requireEventAccess, requirePermission(['canAddAttendees', 'canEditAttendees']), async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id);
    if (!attendee || !attendee.isActive) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    const event = await Event.findById(attendee.event);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const nextCategoryId = req.body.categoryId;
    let oldCategoryId = attendee.categoryId;
    let newCategoryId = attendee.categoryId;

    if (nextCategoryId) {
      const category = (event.categories || []).find((item) => item.id === nextCategoryId);
      if (!category) {
        return res.status(400).json({ success: false, message: 'Invalid category for attendee.' });
      }
      newCategoryId = category.id;
      attendee.categoryId = newCategoryId;
      attendee.categoryName = category.name;
      attendee.allowedZones = category.allowedZones || [];
    }

    attendee.fullName = req.body.fullName ?? attendee.fullName;
    attendee.email = req.body.email ?? attendee.email;
    attendee.phone = req.body.phone ?? attendee.phone;
    attendee.nationalId = req.body.nationalId ?? attendee.nationalId;
    attendee.notes = req.body.notes ?? attendee.notes;
    attendee.isDisabled = req.body.isDisabled ?? attendee.isDisabled;
    await attendee.save();

    // If category changed, sync Event sold counts
    if (nextCategoryId && oldCategoryId && oldCategoryId !== newCategoryId) {
      const event = await Event.findById(attendee.event);
      const oldCat = (event?.categories || []).find(c => c.id === oldCategoryId);
      const newCat = (event?.categories || []).find(c => c.id === newCategoryId);

      // Decrement old
      const decData = { 'categories.$.sold': -1 };
      if (oldCat?.isPrivate) decData['categories.$.usageCount'] = -1;
      await Event.updateOne({ _id: attendee.event, 'categories.id': oldCategoryId }, { $inc: decData });

      // Increment new
      const incData = { 'categories.$.sold': 1 };
      if (newCat?.isPrivate) incData['categories.$.usageCount'] = 1;
      await Event.updateOne({ _id: attendee.event, 'categories.id': newCategoryId }, { $inc: incData });
    }

    await buildActivityNotification({
      userId: req.user._id,
      eventId: attendee.event,
      title: 'Attendee updated',
      message: `${attendee.fullName} details were updated.`,
      type: 'info',
      metadata: { actionType: 'attendee_update', attendeeId: String(attendee._id) },
    });

    res.json({ success: true, data: { attendee }, message: 'Attendee updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/attendee/:id', requireEventAccess, requirePermission(['canAddAttendees', 'canEditAttendees']), async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id);
    if (!attendee || !attendee.isActive) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    if (attendee.addedVia === 'self_purchase' || attendee.addedVia === 'invite') {
      return res.status(400).json({ success: false, message: 'Public portal buyers cannot be deleted.' });
    }

    attendee.isActive = false;
    await attendee.save();

    // Decrement sold count in Event categories
    const updateData = { 'categories.$.sold': -1 };
    const event = await Event.findById(attendee.event);
    const category = (event?.categories || []).find(c => c.id === attendee.categoryId);
    
    if (category?.isPrivate) {
      updateData['categories.$.usageCount'] = -1;
    }

    await Event.updateOne(
      { _id: attendee.event, 'categories.id': attendee.categoryId },
      { $inc: updateData }
    );

    await buildActivityNotification({
      userId: req.user._id,
      eventId: attendee.event,
      title: 'Attendee removed',
      message: `${attendee.fullName} was removed from the event roster.`,
      type: 'warning',
      metadata: { actionType: 'attendee_delete', attendeeId: String(attendee._id) },
    });

    res.json({ success: true, message: 'Attendee removed.' });
  } catch (err) {
    next(err);
  }
});

router.post('/attendees/:id/invite', requireEventAccess, requirePermission('canInviteAttendees'), async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!attendee.email) return res.status(400).json({ success: false, message: 'Attendee email is required to send invite.' });

    if (!attendee.confirmationToken) attendee.confirmationToken = uuidv4();
    attendee.confirmationStatus = 'invited';
    attendee.inviteEmailSent = true;
    attendee.confirmationSentAt = new Date();
    await attendee.save();

    await Ticket.findOneAndUpdate(
      { attendee: attendee._id, event: attendee.event._id },
      {
        inviteStatus: 'PENDING',
        inviteSentAt: new Date(),
        inviteExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        inviteToken: attendee.confirmationToken,
      }
    );

    await notifyInvite({
      attendee,
      event: attendee.event,
      email: attendee.email,
      phone: attendee.phone,
      notificationChannel: 'both',
    });

    await buildActivityNotification({
      userId: req.user._id,
      eventId: attendee.event._id,
      title: 'Invite sent',
      message: `Invite sent to ${attendee.fullName}.`,
      type: 'success',
      metadata: { actionType: 'invite_send', attendeeId: String(attendee._id), channel: 'email_sms' },
    });

    res.json({ success: true, message: 'Invite sent successfully.' });
  } catch (err) {
    next(err);
  }
});

router.get('/ticket-categories', requireEventAccess, requirePermission('canManageTickets'), requireScopedEvent, async (req, res, next) => {
  try {
    const categories = await getTicketCategorySummary(req.scopedEvent);
    res.json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
});

router.post('/ticket-categories', requireEventAccess, requirePermission('canManageTickets'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = {
      id: req.body.id || uuidv4(),
      name: req.body.name,
      description: req.body.description || '',
      price: Number(req.body.price || 0),
      capacity: Number(req.body.capacity || 0),
      sold: 0,
      allowedZones: req.body.allowedZones || [],
      color: req.body.color || '#2563EB',
      benefits: req.body.benefits || [],
      isPrivate: !!req.body.isPrivate,
      maxUsage: req.body.maxUsage ? Number(req.body.maxUsage) : undefined,
      assignedSubOrganisers: req.body.assignedSubOrganisers || [],
      createdBy: req.user._id,
      isVisible: req.body.isVisible !== false,
    };

    if (category.isPrivate) {
      const prefix = category.name.substring(0, 3).toUpperCase();
      const random = crypto.randomBytes(3).toString('hex').toUpperCase();
      category.accessCode = `${prefix}-${random}`;
      category.accessCodeHash = await bcrypt.hash(category.accessCode, 10);
    }

    event.categories.push(category);
    await event.save();

    res.status(201).json({ success: true, data: { category }, message: 'Ticket category created.' });
  } catch (err) {
    next(err);
  }
});

router.put('/ticket-categories/:categoryId', requireEventAccess, requirePermission('canManageTickets'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = (event.categories || []).find((item) => item.id === req.params.categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

    category.name = req.body.name ?? category.name;
    category.description = req.body.description ?? category.description;
    category.price = req.body.price != null ? Number(req.body.price) : category.price;
    category.capacity = req.body.capacity != null ? Number(req.body.capacity) : category.capacity;
    category.color = req.body.color ?? category.color;
    category.allowedZones = req.body.allowedZones || category.allowedZones;
    category.benefits = req.body.benefits || category.benefits;
    category.maxUsage = req.body.maxUsage !== undefined ? (req.body.maxUsage ? Number(req.body.maxUsage) : undefined) : category.maxUsage;
    category.assignedSubOrganisers = req.body.assignedSubOrganisers || category.assignedSubOrganisers;
    if (req.body.isVisible !== undefined) category.isVisible = !!req.body.isVisible;

    if (req.body.isPrivate !== undefined && req.body.isPrivate !== category.isPrivate) {
      category.isPrivate = !!req.body.isPrivate;
      if (category.isPrivate && !category.accessCode) {
        const prefix = category.name.substring(0, 3).toUpperCase();
        const random = crypto.randomBytes(3).toString('hex').toUpperCase();
        category.accessCode = `${prefix}-${random}`;
        category.accessCodeHash = await bcrypt.hash(category.accessCode, 10);
      }
    }

    event.markModified('categories');
    await event.save();

    res.json({ success: true, data: { category }, message: 'Ticket category updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/ticket-categories/:categoryId', requireEventAccess, requirePermission('canManageTickets'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const liveTickets = await Ticket.countDocuments({ event: event._id, categoryId: req.params.categoryId });
    if (liveTickets > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete a category that already has issued tickets.' });
    }

    event.categories = (event.categories || []).filter((item) => item.id !== req.params.categoryId);
    await event.save();

    res.json({ success: true, message: 'Ticket category deleted.' });
  } catch (err) {
    next(err);
  }
});

router.get('/sub-organisers', requireEventAccess, requireScopedEvent, async (req, res, next) => {
  try {
    const isMainOrganiser = hasRolePower(req.user.role, ROLES.MAIN_ORGANISER);
    let users = [];
    
    const query = {
      assignedEvents: req.scopedEvent._id,
      role: { $in: [ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR, ROLES.NONE] }
    };

    if (isMainOrganiser) {
      // Main Organisers see everyone assigned to this event
      users = await User.find(query)
        .select('name email phone role status permissions assignedEvents assignedGates assignedZones customRole responsibilities createdBy')
        .populate('customRole')
        .lean();
    } else {
      // Sub-Organisers see:
      // 1. team members they created for this event
      // 2. existing members assigned to the event that share their zone scope
      const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);

      if (myZoneIds.length > 0) {
        query.$or = [
          { createdBy: req.user._id },
          { 'responsibilities.zoneIds': { $in: myZoneIds } }
        ];
      }
      // If global (no zones), they see all members assigned to the event with these roles

      users = await User.find(query)
        .select('name email phone role status permissions assignedEvents assignedGates assignedZones customRole responsibilities createdBy')
        .populate('customRole')
        .lean();
    }
      
      res.json({ success: true, data: { users } });
    } catch (err) {
    next(err);
  }
});

router.post('/sub-organiser', requireEventAccess, async (req, res, next) => {
  try {
    const resolvedId = resolveEventId(req);
    const event = await Event.findById(resolvedId);
    if (!event) return res.status(404).json({ success: false, message: `Event not found for ID: ${resolvedId}` });

      const targetRole = normalizeRole(req.body.role || ROLES.SUB_ORGANISER);
      const requesterRole = normalizeRole(req.user.role);
      const canHaveCheckpoints = [ROLES.STAFF, ROLES.VOLUNTEER].includes(targetRole);

    // 1. Role level check: Cannot create a user with equal or higher role
    if (ROLE_LEVELS[targetRole] >= ROLE_LEVELS[requesterRole]) {
      return res.status(403).json({ 
        success: false, 
        message: `You do not have permission to create a user with the role: ${targetRole}` 
      });
    }

    // 2. Zone scoping check for Sub-Organisers
      if (requesterRole === ROLES.SUB_ORGANISER) {
        const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);
        const requestedZoneIds = (req.body.responsibilities?.zoneIds || []).map(String);
        const unauthorizedZones = requestedZoneIds.filter(id => !myZoneIds.includes(id));
      
      if (unauthorizedZones.length > 0) {
        return res.status(403).json({ 
          success: false, 
          message: `You cannot assign zones outside your own scope: ${unauthorizedZones.join(', ')}` 
        });
        }
      }

      const requestedAssignedZones = canHaveCheckpoints ? (req.body.assignedZones || []).map(String).filter(Boolean) : [];
      const requestedAssignedGates = canHaveCheckpoints ? (req.body.assignedGates || []).map(String).filter(Boolean) : [];

      if (requesterRole === ROLES.SUB_ORGANISER && requestedAssignedZones.length > 0) {
        const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);
        const unauthorizedAssignedZones = requestedAssignedZones.filter(id => !myZoneIds.includes(id));
        if (unauthorizedAssignedZones.length > 0) {
          return res.status(403).json({
            success: false,
            message: `You cannot assign checkpoint zones outside your own scope: ${unauthorizedAssignedZones.join(', ')}`,
          });
        }
      }

      let existing = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
    let isNewUser = false;
    let tempPassword = null;
    let user;

    // Enforce contact requirements based on event settings
    const emailRequired = event.settings?.communicationChannels?.email === true;
    const smsRequired = event.settings?.communicationChannels?.sms === true;

    if (existing) {
      // 1. Role level check: Cannot re-assign a user with equal or higher role than yours
      const existingRole = normalizeRole(existing.role);
      if (ROLE_LEVELS[existingRole] >= ROLE_LEVELS[requesterRole]) {
         return res.status(403).json({ 
           success: false, 
           message: `You do not have permission to manage this existing user (${existingRole}).` 
         });
      }
      // Validate existing contact details satisfy event requirements
      if (emailRequired && (!existing.email || String(existing.email).trim() === '')) {
        return res.status(400).json({ success: false, message: 'The existing user does not have an email address required for this event.' });
      }
      if (smsRequired && (!existing.phone || String(existing.phone).trim() === '')) {
        return res.status(400).json({ success: false, message: 'The existing user does not have a phone number required for this event.' });
      }

      user = existing;

      // 2. Add as assigned event if not already
      const userIdStr = String(user._id);
      const alreadyAssigned = (user.assignedEvents || []).map(String).includes(String(event._id));
      if (!alreadyAssigned) {
        user.assignedEvents = Array.from(new Set([...(user.assignedEvents || []).map(String), String(event._id)])).map(toObjectId);
      }

      // 3. Update permissions and merge responsibilities
        if (req.body.permissions) {
          user.permissions = { ...(user.permissions || {}), ...req.body.permissions };
        }

        user.assignedGates = Array.from(new Set(requestedAssignedGates));
        user.assignedZones = Array.from(new Set(requestedAssignedZones));

        if (req.body.responsibilities) {
        // Merge strategy: Preserve zones that do NOT belong to the current event
        const currentEventZoneIds = (event.zones || []).map(z => String(z.id || z.name)).filter(Boolean);
        const existingZonesFromOtherEvents = (user.responsibilities?.zoneIds || []).filter(zid => !currentEventZoneIds.includes(String(zid)));
        
        const newZonesFromThisEvent = req.body.responsibilities.zoneIds || [];
        
        user.responsibilities = {
          ...(user.responsibilities?.toObject ? user.responsibilities.toObject() : user.responsibilities || {}),
          ...req.body.responsibilities,
          zoneIds: Array.from(new Set([...existingZonesFromOtherEvents, ...newZonesFromThisEvent]))
        };
      }
      
      await user.save();
    } else {
      isNewUser = true;
      tempPassword = req.body.password || crypto.randomBytes(8).toString('hex');
      // Validate incoming payload satisfies event requirements
      if (emailRequired && (!req.body.email || String(req.body.email).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Email is required for team members on this event.' });
      }
      if (smsRequired && (!req.body.phone || String(req.body.phone).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Phone number is required for team members on this event.' });
      }

      user = await User.create({
        name: req.body.name,
        email: String(req.body.email || '').toLowerCase().trim(),
        phone: req.body.phone,
        password: tempPassword,
        role: targetRole,
        status: req.body.status || 'Active',
        isTempPassword: true,
        isVerified: true,
          assignedEvents: [event._id],
          assignedGates: Array.from(new Set(requestedAssignedGates)),
          assignedZones: Array.from(new Set(requestedAssignedZones)),
          permissions: {
          canAddAttendees: !!req.body.permissions?.canAddAttendees,
          canVerifyPhotos: !!req.body.permissions?.canVerifyPhotos,
          canInviteAttendees: !!req.body.permissions?.canInviteAttendees,
          canBulkUpload: !!req.body.permissions?.canBulkUpload,
          canEntryAccess: !!req.body.permissions?.canEntryAccess,
        },
        customRole: req.body.customRole || undefined,
        responsibilities: {
          zoneIds: req.body.responsibilities?.zoneIds || [],
          verificationAccess: !!req.body.responsibilities?.verificationAccess,
          entryAccess: !!req.body.responsibilities?.entryAccess,
        },
        createdBy: req.user._id,
      });
    }

    // Add to event personnel collections
    const userIdStr = String(user._id);
    if (targetRole === ROLES.SUB_ORGANISER || targetRole === ROLES.NONE) {
      event.subOrganisers = Array.from(new Set([...(event.subOrganisers || []).map(String), userIdStr])).map(toObjectId);
    } else if (targetRole === ROLES.STAFF) {
      event.staff = Array.from(new Set([...(event.staff || []).map(String), userIdStr])).map(toObjectId);
    } else if (targetRole === ROLES.VOLUNTEER) {
      event.volunteers = Array.from(new Set([...(event.volunteers || []).map(String), userIdStr])).map(toObjectId);
    } else if (targetRole === ROLES.AUDITOR) {
      event.auditors = Array.from(new Set([...(event.auditors || []).map(String), userIdStr])).map(toObjectId);
    }
    await event.save();

    if (isNewUser) {
      await notifyUserCredentials(user, tempPassword);
      await notifySubOrganiserInvite({ user, event, phone: user.phone, email: user.email });
    }

    await buildActivityNotification({
      userId: req.user._id,
      eventId: event._id,
      title: isNewUser ? 'Team member created' : 'Team member reassigned',
      message: `${user.name} (${targetRole}) was ${isNewUser ? 'created and ' : ''}assigned to ${event.name}.`,
      type: 'success',
      metadata: { actionType: isNewUser ? 'team_member_create' : 'team_member_assign', subOrganiserId: String(user._id) },
    });

    res.status(isNewUser ? 201 : 200).json({ 
      success: true, 
      data: { user }, 
      message: isNewUser ? 'Team member created.' : 'Access granted to existing team member.' 
    });
  } catch (err) {
    next(err);
  }
});

router.put('/sub-organiser/:id', requireEventAccess, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Team member not found.' });

    const requesterRole = normalizeRole(req.user.role);
    
    // Authorization check: Sub-organisers can only edit users they created or those in their zones
    if (requesterRole === ROLES.SUB_ORGANISER) {
      const createdByMe = String(user.createdBy) === String(req.user._id);
      const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);
      const userZoneIds = (user.responsibilities?.zoneIds || []).map(String);
      const inMyZone = myZoneIds.length > 0 && userZoneIds.some(id => myZoneIds.includes(id));

      if (!createdByMe && !inMyZone) {
        return res.status(403).json({ success: false, message: 'You can only manage team members you created or who are assigned to your zones.' });
      }
    }

    // Role level check if role is being changed
      if (req.body.role) {
        const targetRole = normalizeRole(req.body.role);
        if (ROLE_LEVELS[targetRole] >= ROLE_LEVELS[requesterRole]) {
           return res.status(403).json({ success: false, message: 'Cannot assign a role equal to or higher than your own.' });
        }
        user.role = targetRole;
      }
      const effectiveRole = normalizeRole(req.body.role || user.role);
      const canHaveCheckpoints = [ROLES.STAFF, ROLES.VOLUNTEER].includes(effectiveRole);

    const eventId = req.body.eventId || req.query.eventId || req.params.eventId || (user.assignedEvents && user.assignedEvents[0]) || (req.user.assignedEvents && req.user.assignedEvents[0]);
    const event = eventId && mongoose.Types.ObjectId.isValid(eventId) ? await Event.findById(eventId) : null;

    // Zone scoping check for Sub-Organisers
    if (requesterRole === ROLES.SUB_ORGANISER && req.body.responsibilities?.zoneIds) {
      // Logic for zone check remains same but we'll use 'event' if available for merging
      const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);
      const requestedZoneIds = req.body.responsibilities.zoneIds.map(String);
      const unauthorizedZones = requestedZoneIds.filter(id => !myZoneIds.includes(id));
      
      if (unauthorizedZones.length > 0) {
        return res.status(403).json({ 
          success: false, 
          message: `You cannot assign zones outside your own scope: ${unauthorizedZones.join(', ')}` 
        });
      }
    }

    user.name = req.body.name ?? user.name;
    user.phone = req.body.phone ?? user.phone;
    user.status = req.body.status ?? user.status;
    user.permissions = {
      ...(user.permissions || {}),
      ...(req.body.permissions || {}),
    };
    user.assignedGates = canHaveCheckpoints && Array.isArray(req.body.assignedGates)
      ? Array.from(new Set(req.body.assignedGates.map(String).filter(Boolean)))
      : [];
    user.assignedZones = canHaveCheckpoints && Array.isArray(req.body.assignedZones)
      ? Array.from(new Set(req.body.assignedZones.map(String).filter(Boolean)))
      : [];
    user.customRole = req.body.customRole ?? user.customRole;
    user.responsibilities = {
      ...(user.responsibilities?.toObject ? user.responsibilities.toObject() : user.responsibilities || {}),
      ...(req.body.responsibilities || {}),
    };

    if (event && req.body.responsibilities?.zoneIds) {
      const currentEventZoneIds = (event.zones || []).map(z => String(z.id || z.name)).filter(Boolean);
      const existingZonesFromOtherEvents = (user.responsibilities?.zoneIds || []).filter(zid => !currentEventZoneIds.includes(String(zid)));
      const newZonesFromThisEvent = req.body.responsibilities.zoneIds || [];
      user.responsibilities.zoneIds = Array.from(new Set([...existingZonesFromOtherEvents, ...newZonesFromThisEvent]));
    }

    if (event && req.body.role) {
      const targetRole = normalizeRole(req.body.role);
      const userIdStr = String(user._id);
      event.subOrganisers = (event.subOrganisers || []).filter(id => String(id) !== userIdStr);
      event.staff = (event.staff || []).filter(id => String(id) !== userIdStr);
      event.volunteers = (event.volunteers || []).filter(id => String(id) !== userIdStr);
      event.auditors = (event.auditors || []).filter(id => String(id) !== userIdStr);

      if (targetRole === ROLES.SUB_ORGANISER || targetRole === ROLES.NONE) {
        event.subOrganisers.push(toObjectId(userIdStr));
      } else if (targetRole === ROLES.STAFF) {
        event.staff.push(toObjectId(userIdStr));
      } else if (targetRole === ROLES.VOLUNTEER) {
        event.volunteers.push(toObjectId(userIdStr));
      } else if (targetRole === ROLES.AUDITOR) {
        event.auditors.push(toObjectId(userIdStr));
      }
      await event.save();
    }

    await user.save();
    res.json({ success: true, data: { user }, message: 'Sub-organiser updated.' });

    // Create notification for team member update
    await buildActivityNotification({
      userId: req.user._id,
      eventId: eventId || req.user.assignedEvents?.[0],
      title: 'Team member updated',
      message: `${user.name} (${user.role}) details were updated.`,
      type: 'info',
      metadata: { actionType: 'team_member_update', subOrganiserId: String(user._id) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/verification', requireEventAccess, async (req, res, next) => {
  try {
    const eventId = resolveEventId(req);
    const page = clamp(req.query.page, 1, 9999, 1);
    const limit = clamp(req.query.limit, 1, 50, 12);
    const skip = (page - 1) * limit;

    const filter = {
      event: eventId,
      isActive: true,
      photoVerificationStatus: req.query.status || { $in: ['pending', 'Pending'] },
    };

    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [attendees, total] = await Promise.all([
      Attendee.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Attendee.countDocuments(filter),
    ]);

    res.json({ success: true, data: { attendees, total, page, pages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    next(err);
  }
});

router.post('/verification/:attendeeId', requireEventAccess, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { status, reason = '' } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected.' });
    }

    const attendee = await Attendee.findById(req.params.attendeeId).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

    attendee.photoVerificationStatus = status;
    attendee.photoVerifiedAt = new Date();
    attendee.photoVerifiedBy = req.user._id;
    attendee.photoRejectionReason = status === 'rejected' ? reason : null;
    attendee.confirmationStatus = status === 'verified' ? 'confirmed' : attendee.confirmationStatus;
    attendee.isConfirmed = status === 'verified' ? true : attendee.isConfirmed;

    if (status === 'rejected') {
      attendee.resubmitToken = attendee.resubmitToken || uuidv4();
      attendee.resubmitCount = (attendee.resubmitCount || 0) + 1;
    }

    await attendee.save();

    if (status === 'rejected') {
      await notifyPhotoRejectionNotification({ attendee, event: attendee.event, reason });
    } else {
      const { deliverAttendeeTicketEmail } = require('../services/ticketDeliveryService');
      await deliverAttendeeTicketEmail({ attendee, event: attendee.event }).catch(err => console.error('AUTO_TICKET_DELIVERY_ERROR:', err));

      await notifyStatusChange({
        attendee,
        event: attendee.event,
        status: 'Photo approved',
        message: 'Your attendee verification was approved.',
      });
    }

    await buildActivityNotification({
      userId: req.user._id,
      eventId: attendee.event._id,
      title: status === 'verified' ? 'Photo approved' : 'Photo rejected',
      message: status === 'verified' ? `${attendee.fullName} was approved.` : `${attendee.fullName} was rejected. Reason: ${reason || 'No reason provided.'}`,
      type: status === 'verified' ? 'success' : 'warning',
      metadata: { actionType: 'verification', attendeeId: String(attendee._id), outcome: status, channel: 'email_sms' },
    });

    res.json({ success: true, data: { attendee }, message: 'Verification updated.' });
  } catch (err) {
    next(err);
  }
});

router.get('/invites', requireEventAccess, async (req, res, next) => {
  try {
    const eventId = resolveEventId(req);
    const tickets = await Ticket.find({ event: eventId })
      .populate('attendee', 'fullName email phone confirmationStatus confirmationToken')
      .sort({ inviteSentAt: -1, createdAt: -1 });

    res.json({ success: true, data: { invites: tickets.map(mapInviteRow) } });
  } catch (err) {
    next(err);
  }
});

router.post('/invites/:ticketId/resend', requireEventAccess, requirePermission('canInviteAttendees'), async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).populate('attendee').populate('event');
    if (!ticket || !ticket.attendee) {
      return res.status(404).json({ success: false, message: 'Invite ticket not found.' });
    }

    if (!ticket.attendee.email) {
      return res.status(400).json({ success: false, message: 'Attendee email is required to resend invite.' });
    }

    ticket.inviteStatus = 'PENDING';
    ticket.inviteSentAt = new Date();
    ticket.inviteExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await ticket.save();

    await notifyInvite({
      attendee: ticket.attendee,
      event: ticket.event,
      email: ticket.attendee.email,
      phone: ticket.attendee.phone,
      notificationChannel: 'both',
    });

    await buildActivityNotification({
      userId: req.user._id,
      eventId: ticket.event._id,
      title: 'Invite resent',
      message: `Invite resent to ${ticket.attendee.fullName}.`,
      type: 'info',
      metadata: { actionType: 'invite_resend', attendeeId: String(ticket.attendee._id), ticketId: String(ticket._id), channel: 'email_sms' },
    });

    res.json({ success: true, message: 'Invite resent.' });
  } catch (err) {
    next(err);
  }
});

router.patch('/invites/:ticketId/cancel', requireEventAccess, requirePermission('canInviteAttendees'), async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId).populate('attendee');
    if (!ticket) return res.status(404).json({ success: false, message: 'Invite ticket not found.' });

    ticket.inviteStatus = 'DECLINED';
    ticket.inviteRespondedAt = new Date();
    await ticket.save();

    await buildActivityNotification({
      userId: req.user._id,
      eventId: ticket.event,
      title: 'Invite cancelled',
      message: `Invite cancelled for ${ticket.attendee?.fullName || 'attendee'}.`,
      type: 'warning',
      metadata: { actionType: 'invite_cancel', ticketId: String(ticket._id) },
    });

    res.json({ success: true, message: 'Invite cancelled.' });
  } catch (err) {
    next(err);
  }
});

router.get('/event/:eventId/stats', requireEventAccess, requirePermission('canViewDashboard'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const [totalTickets, confirmedAttendees, checkedInCount, totalRevenue] = await Promise.all([
      Ticket.countDocuments({ event: event._id }),
      Attendee.countDocuments({ event: event._id, confirmationStatus: 'confirmed', isActive: true }),
      EntryLog.countDocuments({ event: event._id, action: 'check_in', accessGranted: true }),
      Ticket.aggregate([
        { $match: { event: event._id, status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalTickets,
        totalAttendees: totalTickets,
        confirmedAttendees,
        checkedInCount,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/event/:eventId/entry-logs', requireEventAccess, requirePermission('canViewLogs'), async (req, res, next) => {
  try {
    const page = clamp(req.query.page, 1, 9999, 1);
    const limit = clamp(req.query.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const filter = { event: req.params.eventId };

    if (req.query.gate) filter.gateName = req.query.gate;
    if (req.query.status === 'allowed') filter.accessGranted = true;
    if (req.query.status === 'denied') filter.accessGranted = false;
    if (req.query.from || req.query.to) {
      filter.timestamp = {};
      if (req.query.from) filter.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) filter.timestamp.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      EntryLog.find(filter)
        .populate('attendee', 'fullName categoryName')
        .populate('processedBy', 'name')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      EntryLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: { logs, total, page, pages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    next(err);
  }
});

router.get('/event/:eventId/zones/report', requireEventAccess, requirePermission('canViewReports'), async (req, res, next) => {
  try {
    const zoneLogs = await ZoneLog.find({ eventId: req.params.eventId })
      .populate('attendeeId', 'fullName categoryName')
      .populate('scannedBy', 'name')
      .sort({ timestamp: -1 })
      .limit(100);

    const occupancy = await ZoneLog.aggregate([
      { $match: { eventId: toObjectId(req.params.eventId), accessGranted: true } },
      { $group: { _id: { zoneName: '$zoneName', action: '$action' }, count: { $sum: 1 } } },
    ]);

    const zoneMap = new Map();
    occupancy.forEach((row) => {
      const current = zoneMap.get(row._id.zoneName) || { zoneName: row._id.zoneName, entries: 0, exits: 0, occupancy: 0 };
      if (row._id.action === 'ENTRY') current.entries = row.count;
      if (row._id.action === 'EXIT') current.exits = row.count;
      current.occupancy = Math.max(current.entries - current.exits, 0);
      zoneMap.set(row._id.zoneName, current);
    });

    res.json({ success: true, data: { zoneOccupancy: Array.from(zoneMap.values()), logs: zoneLogs } });
  } catch (err) {
    next(err);
  }
});

router.get('/zones', requireEventAccess, requirePermission('canManageZones'), requireScopedEvent, async (req, res, next) => {
  try {
    res.json({ success: true, data: { zones: req.scopedEvent.zones || [] } });
  } catch (err) {
    next(err);
  }
});

router.post('/zones', requireEventAccess, requirePermission('canManageZones'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const zone = {
      id: req.body.id || uuidv4(),
      name: req.body.name,
      description: req.body.description || '',
      capacity: Number(req.body.capacity || 0),
      color: req.body.color || '#0F766E',
      assignedSubOrganiser: req.body.assignedSubOrganiser || undefined,
      accessRules: {
        allowedRoles: req.body.accessRules?.allowedRoles || [],
        timeStart: req.body.accessRules?.timeStart || '',
        timeEnd: req.body.accessRules?.timeEnd || '',
        notes: req.body.accessRules?.notes || '',
      },
    };

    event.zones.push(zone);
    await event.save();
    res.status(201).json({ success: true, data: { zone }, message: 'Zone created.' });
  } catch (err) {
    next(err);
  }
});

router.put('/zones/:zoneId', requireEventAccess, requirePermission('canManageZones'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const zone = (event.zones || []).find((item) => item.id === req.params.zoneId);
    if (!zone) return res.status(404).json({ success: false, message: 'Zone not found.' });

    zone.name = req.body.name ?? zone.name;
    zone.description = req.body.description ?? zone.description;
    zone.capacity = req.body.capacity != null ? Number(req.body.capacity) : zone.capacity;
    zone.color = req.body.color ?? zone.color;
    zone.assignedSubOrganiser = req.body.assignedSubOrganiser ?? zone.assignedSubOrganiser;
    zone.accessRules = {
      ...(zone.accessRules?.toObject ? zone.accessRules.toObject() : zone.accessRules || {}),
      ...(req.body.accessRules || {}),
    };
    await event.save();

    res.json({ success: true, data: { zone }, message: 'Zone updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/zones/:zoneId', requireEventAccess, requirePermission('canManageZones'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    event.zones = (event.zones || []).filter((item) => item.id !== req.params.zoneId);
    event.categories = (event.categories || []).map((category) => ({
      ...category.toObject(),
      allowedZones: (category.allowedZones || []).filter((item) => item !== req.params.zoneId),
    }));
    await event.save();

    res.json({ success: true, message: 'Zone deleted.' });
  } catch (err) {
    next(err);
  }
});

router.patch('/zones/:zoneId/categories', requireEventAccess, requirePermission('canManageZones'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const { categoryIds = [] } = req.body;
    event.categories.forEach((category) => {
      const allowed = new Set(category.allowedZones || []);
      if (categoryIds.includes(category.id)) allowed.add(req.params.zoneId);
      else allowed.delete(req.params.zoneId);
      category.allowedZones = Array.from(allowed);
    });
    await event.save();

    res.json({ success: true, message: 'Zone assignments updated.' });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', requireEventAccess, async (req, res, next) => {
  try {
    const eventId = resolveEventId(req);
    const notifications = await Notification.find({ 'metadata.eventId': String(eventId) })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: { notifications } });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/:id/resend', requireEventAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });

    await Notification.create({
      user: req.user._id,
      title: `${notification.title} (resent)`,
      message: notification.message,
      type: notification.type,
      metadata: {
        ...(notification.metadata || {}),
        resentFrom: String(notification._id),
        resentAt: new Date().toISOString(),
      },
    });

    res.json({ success: true, message: 'Notification re-queued.' });
  } catch (err) {
    next(err);
  }
});

router.get('/custom-roles', requireEventAccess, async (req, res, next) => {
  try {
    const eventId = resolveEventId(req);
    const roles = await Role.find({ event: eventId }).sort({ createdAt: -1 });
    res.json({ success: true, data: { roles } });
  } catch (err) {
    next(err);
  }
});

router.post('/custom-roles', requireEventAccess, async (req, res, next) => {
  try {
    const eventId = resolveEventId(req);
    const role = await Role.create({
      name: req.body.name,
      slug: slugify(req.body.name || req.body.slug),
      description: req.body.description || '',
      event: eventId,
      permissions: {
        canViewDashboard: !!req.body.permissions?.canViewDashboard,
        canManageEvents: !!req.body.permissions?.canManageEvents,
        canManageTickets: !!req.body.permissions?.canManageTickets,
        canViewAttendees: !!req.body.permissions?.canViewAttendees,
        canEditAttendees: !!req.body.permissions?.canEditAttendees,
        canVerifyPhotos: !!req.body.permissions?.canVerifyPhotos,
        canScanEntry: !!req.body.permissions?.canScanEntry,
        canManageZones: !!req.body.permissions?.canManageZones,
        canInviteAttendees: !!req.body.permissions?.canInviteAttendees,
        canBulkUpload: !!req.body.permissions?.canBulkUpload,
        canViewReports: !!req.body.permissions?.canViewReports,
        canViewLogs: !!req.body.permissions?.canViewLogs,
        canManageSponsors: !!req.body.permissions?.canManageSponsors,
        canViewTransactions: !!req.body.permissions?.canViewTransactions,
        canManageSettings: !!req.body.permissions?.canManageSettings,
      },
      zoneIds: req.body.zoneIds || [],
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: { role }, message: 'Custom role created.' });
  } catch (err) {
    next(err);
  }
});

router.put('/custom-roles/:id', requireEventAccess, async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });
    role.name = req.body.name ?? role.name;
    role.slug = req.body.slug ? slugify(req.body.slug) : role.slug;
    role.description = req.body.description ?? role.description;
    
    // Explicitly update all permissions safely
    const reqPerms = req.body.permissions || {};
    const existingPerms = role.permissions?.toObject ? role.permissions.toObject() : role.permissions || {};
    
    role.permissions = {
      canViewDashboard: reqPerms.canViewDashboard !== undefined ? !!reqPerms.canViewDashboard : !!existingPerms.canViewDashboard,
      canManageEvents: reqPerms.canManageEvents !== undefined ? !!reqPerms.canManageEvents : !!existingPerms.canManageEvents,
      canManageTickets: reqPerms.canManageTickets !== undefined ? !!reqPerms.canManageTickets : !!existingPerms.canManageTickets,
      canViewAttendees: reqPerms.canViewAttendees !== undefined ? !!reqPerms.canViewAttendees : !!existingPerms.canViewAttendees,
      canEditAttendees: reqPerms.canEditAttendees !== undefined ? !!reqPerms.canEditAttendees : !!existingPerms.canEditAttendees,
      canVerifyPhotos: reqPerms.canVerifyPhotos !== undefined ? !!reqPerms.canVerifyPhotos : !!existingPerms.canVerifyPhotos,
      canScanEntry: reqPerms.canScanEntry !== undefined ? !!reqPerms.canScanEntry : !!existingPerms.canScanEntry,
      canManageZones: reqPerms.canManageZones !== undefined ? !!reqPerms.canManageZones : !!existingPerms.canManageZones,
      canInviteAttendees: reqPerms.canInviteAttendees !== undefined ? !!reqPerms.canInviteAttendees : !!existingPerms.canInviteAttendees,
      canBulkUpload: reqPerms.canBulkUpload !== undefined ? !!reqPerms.canBulkUpload : !!existingPerms.canBulkUpload,
      canViewReports: reqPerms.canViewReports !== undefined ? !!reqPerms.canViewReports : !!existingPerms.canViewReports,
      canViewLogs: reqPerms.canViewLogs !== undefined ? !!reqPerms.canViewLogs : !!existingPerms.canViewLogs,
      canManageSponsors: reqPerms.canManageSponsors !== undefined ? !!reqPerms.canManageSponsors : !!existingPerms.canManageSponsors,
      canViewTransactions: reqPerms.canViewTransactions !== undefined ? !!reqPerms.canViewTransactions : !!existingPerms.canViewTransactions,
      canManageSettings: reqPerms.canManageSettings !== undefined ? !!reqPerms.canManageSettings : !!existingPerms.canManageSettings,
    };
    
    role.zoneIds = req.body.zoneIds || role.zoneIds;
    await role.save();
    res.json({ success: true, data: { role }, message: 'Custom role updated.' });
  } catch (err) {
    next(err);
  }
});

router.delete('/custom-roles/:id', requireEventAccess, async (req, res, next) => {
  try {
    const roleId = req.params.id;
    const role = await Role.findById(roleId);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found.' });

    // Check if any sub-organisers are currently assigned this custom role
    const assignedUser = await User.findOne({ customRole: roleId });
    if (assignedUser) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete custom role because it is currently assigned to ${assignedUser.name || 'a team member'}.`,
      });
    }

    await Role.findByIdAndDelete(roleId);
    res.json({ success: true, message: 'Custom role deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

router.put('/event-customization', requireEventAccess, localUpload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'logoImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), async (req, res, next) => {
  try {
    const { event, requestedId } = await getWritableScopedEvent(req);
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${requestedId})` });

    const parseJson = (val) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch (e) { return val; }
      }
      return val;
    };

    const basicInfo = parseJson(req.body.basicInfo);
    const branding = parseJson(req.body.branding);
    const confirmationFlow = parseJson(req.body.confirmationFlow);
    const accessRules = parseJson(req.body.accessRules);
    const paymentMethods = parseJson(req.body.paymentMethods);
    const matchDetails = parseJson(req.body.matchDetails);
    const concertDetails = parseJson(req.body.concertDetails);
    const conferenceDetails = parseJson(req.body.conferenceDetails);
    const communicationChannels = parseJson(req.body.communicationChannels);

    if (matchDetails) {
      event.matchDetails = {
        ...(event.matchDetails?.toObject ? event.matchDetails.toObject() : event.matchDetails || {}),
        ...matchDetails
      };
      event.markModified('matchDetails');
    }

    if (concertDetails) {
      event.concertDetails = {
        ...(event.concertDetails?.toObject ? event.concertDetails.toObject() : event.concertDetails || {}),
        ...concertDetails
      };
      event.markModified('concertDetails');
    }

    if (conferenceDetails) {
      event.conferenceDetails = {
        ...(event.conferenceDetails?.toObject ? event.conferenceDetails.toObject() : event.conferenceDetails || {}),
        ...conferenceDetails
      };
      event.markModified('conferenceDetails');
    }

    const role = normalizeRole(req.user.role);
    const isAdmin = role === ROLES.MAIN_ADMIN || role === ROLES.SUPER_ADMIN;

    if (basicInfo) {
      // Basic Fields: Admin only for Name/Type/Dates, Organiser allowed for Description
      if (isAdmin) {
        event.name = basicInfo.name ?? event.name;
        event.eventType = basicInfo.eventType ?? event.eventType;
        event.customEventType = basicInfo.customEventType ?? event.customEventType;
        if (basicInfo.startDate) event.startDate = new Date(basicInfo.startDate);
        if (basicInfo.endDate) event.endDate = new Date(basicInfo.endDate);
      }
      
      event.description = basicInfo.description ?? event.description;
      if (basicInfo.timezone !== undefined) {
        event.timezone = basicInfo.timezone;
      }
      
      if (basicInfo.venue) {
        if (isAdmin) {
          // Admin can update everything in venue
          event.venue = {
            ...(event.venue?.toObject ? event.venue.toObject() : event.venue || {}),
            ...basicInfo.venue,
          };
        } else {
          // Organiser can update address, city, country, mapUrl
          const v = event.venue?.toObject ? event.venue.toObject() : (event.venue || {});
          event.venue = {
            ...v,
            address: basicInfo.venue.address ?? v.address,
            city: basicInfo.venue.city ?? v.city,
            country: basicInfo.venue.country ?? v.country,
            mapUrl: basicInfo.venue.mapUrl ?? v.mapUrl,
          };
        }
        event.markModified('venue');
      }

      if (basicInfo.currency) {
        if (!event.settings) event.settings = {};
        event.settings.currency = basicInfo.currency;
        event.markModified('settings.currency');
      }
    }

    if (branding || req.files || req.body.removeCoverImage || req.body.removeLogoImage || req.body.removeBannerImage) {
      const b = branding || {};
      if (!event.branding) event.branding = {};

      Object.assign(event.branding, b);

      // Handle new image uploads
      if (req.files?.coverImage) {
        const path = `/uploads/${req.files.coverImage[0].filename}`;
        event.coverImage = path;
        event.branding.coverImage = path;
      } else if (req.body.removeCoverImage === 'true') {
        // Remove cover image
        event.coverImage = '';
        event.branding.coverImage = '';
      }

      if (req.files?.bannerImage) {
        const path = `/uploads/${req.files.bannerImage[0].filename}`;
        event.bannerImage = path;
        event.branding.bannerImage = path;
      } else if (req.body.removeBannerImage === 'true') {
        // Remove banner image
        event.bannerImage = '';
        event.branding.bannerImage = '';
      }

      if (req.files?.logoImage) {
        const path = `/uploads/${req.files.logoImage[0].filename}`;
        event.logoImage = path;
        event.branding.logoImage = path;
      } else if (req.body.removeLogoImage === 'true') {
        // Remove logo image
        event.logoImage = '';
        event.branding.logoImage = '';
      }

      event.markModified('branding');
    }

    if (Array.isArray(req.body.customFields)) {
      event.customFields = req.body.customFields;
    }

    // Settings & Access Rules
    if (!event.settings) event.settings = {};
    
    if (confirmationFlow) {
      Object.assign(event.settings, confirmationFlow);
      event.markModified('settings');
    }
    
    if (accessRules) {
      event.settings.accessRules = {
        ...(event.settings.accessRules?.toObject ? event.settings.accessRules.toObject() : event.settings.accessRules || {}),
        ...accessRules
      };
      event.markModified('settings.accessRules');
    }

    if (paymentMethods) {
      event.settings.paymentMethods = {
        ...(event.settings.paymentMethods?.toObject ? event.settings.paymentMethods.toObject() : event.settings.paymentMethods || {}),
        ...paymentMethods
      };
      event.markModified('settings.paymentMethods');
    }

    if (communicationChannels) {
      // Security: Organisers cannot enable SMS
      if (normalizeRole(req.user.role) !== ROLES.MAIN_ADMIN && communicationChannels.sms === true) {
        console.log('[PATCH] Reverting unauthorised SMS channel change by organiser in customization.');
        communicationChannels.sms = event.settings?.communicationChannels?.sms || false;
      }
      event.settings.communicationChannels = {
        ...(event.settings.communicationChannels?.toObject ? event.settings.communicationChannels.toObject() : event.settings.communicationChannels || {}),
        ...communicationChannels
      };
      event.markModified('settings.communicationChannels');
    }
    
    if (req.body.status) {
      event.status = req.body.status;
    }
    
    await event.save();

    await buildActivityNotification({
      userId: req.user._id,
      eventId: event._id,
      title: 'Event customization updated',
      message: `${event.name} customization settings were updated.`,
      type: 'success',
      metadata: { actionType: 'event_customization_update' },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`event:${event._id}`).emit('event_update', { eventId: event._id });
      io.to(`dashboard:${event._id}`).emit('event_update', { eventId: event._id });
      // Notify the public listing page so cover/banner/logo images update live
      io.to('listings').emit('events_updated', { eventId: event._id });
    }

    res.json({ success: true, data: { event }, message: 'Event customization updated.' });
  } catch (err) {
    next(err);
  }
});

router.get('/settings', requireEventAccess, requirePermission('canManageSettings'), requireScopedEvent, async (req, res, next) => {
  try {
    res.json({ success: true, data: { event: req.scopedEvent, settings: req.scopedEvent.settings || {} } });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', requireEventAccess, requirePermission('canManageSettings'), async (req, res, next) => {
  try {
    const { event, requestedId } = await getWritableScopedEvent(req);
    if (!event) return res.status(404).json({ success: false, message: `Event not found. (ID: ${requestedId})` });

    const role = normalizeRole(req.user.role);
    const isAdmin = role === ROLES.MAIN_ADMIN || role === ROLES.SUPER_ADMIN;

    if (isAdmin) {
      event.name = req.body.name ?? event.name;
      event.startDate = req.body.startDate ? new Date(req.body.startDate) : event.startDate;
      event.endDate = req.body.endDate ? new Date(req.body.endDate) : event.endDate;
      if (req.body.venue) {
        event.venue = {
          ...(event.venue?.toObject ? event.venue.toObject() : event.venue || {}),
          ...req.body.venue,
        };
      }
    } else {
      // Organiser can update address, city, country, mapUrl
      if (req.body.venue) {
        const v = event.venue?.toObject ? event.venue.toObject() : (event.venue || {});
        event.venue = {
          ...v,
          address: req.body.venue.address ?? v.address,
          city: req.body.venue.city ?? v.city,
          country: req.body.venue.country ?? v.country,
          mapUrl: req.body.venue.mapUrl ?? v.mapUrl,
        };
      }
    }
    const incomingSettings = req.body.settings || {};
    
    // Security: Organisers cannot enable SMS
    if (normalizeRole(req.user.role) !== ROLES.MAIN_ADMIN && incomingSettings.communicationChannels?.sms === true) {
      console.log('[SETTINGS] Reverting unauthorised SMS channel change by organiser.');
      incomingSettings.communicationChannels.sms = event.settings?.communicationChannels?.sms || false;
    }

    event.settings = {
      ...(event.settings?.toObject ? event.settings.toObject() : event.settings || {}),
      ...incomingSettings,
    };
    
    await event.save();

    res.json({ success: true, data: { event, settings: event.settings }, message: 'Event settings updated.' });
  } catch (err) {
    next(err);
  }
});

router.get('/template', requireEventAccess, async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const rows = [
      ['Full Name', 'National ID', 'Date of Birth (YYYY-MM-DD)', 'Email', 'Phone', 'Category ID'],
      [],
      ['Allowed Categories'],
      ['Category ID', 'Category Name'],
      ...(event.categories || []).map((item) => [item.id, item.name]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendees');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="attendees-template-${event._id}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/event/:eventId/export', requireEventAccess, requirePermission('canViewReports'), async (req, res, next) => {
  try {
    const type = req.query.type || 'attendees';
    const wb = XLSX.utils.book_new();

    if (type === 'attendees') {
      const attendees = await Attendee.find({ event: req.params.eventId, isActive: true }).lean();
      const rows = [
        ['Full Name', 'Email', 'Phone', 'Category', 'Confirmation Status', 'Photo Status'],
        ...attendees.map((item) => [item.fullName, item.email, item.phone, item.categoryName, item.confirmationStatus, item.photoVerificationStatus]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Attendees');
    } else if (type === 'tickets') {
      const event = await Event.findById(req.params.eventId).lean();
      const rows = [
        ['Category Name', 'Price', 'Capacity', 'Sold', 'Allowed Zones'],
        ...((event?.categories || []).map((item) => [item.name, item.price, item.capacity, item.sold || 0, (item.allowedZones || []).join(', ')])),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Tickets');
    } else {
      const logs = await EntryLog.find({ event: req.params.eventId }).populate('attendee', 'fullName').lean();
      const rows = [
        ['Timestamp', 'Attendee', 'Action', 'Gate', 'Zone', 'Status'],
        ...logs.map((item) => [
          item.timestamp ? new Date(item.timestamp).toISOString() : '',
          item.attendee?.fullName || item.snapshot?.fullName || '-',
          item.action,
          item.gateName || item.gateId || '-',
          item.zoneName || '-',
          item.accessGranted ? 'Allowed' : 'Denied',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Entry Logs');
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${req.params.eventId}.csv"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// --- SPONSOR PACKAGES ---

router.get('/sponsor-packages', requireEventAccess, requirePermission('canManageSponsors'), requireScopedEvent, async (req, res, next) => {
  try {
    res.json({ success: true, data: { packages: req.scopedEvent.sponsorPackages || [] } });
  } catch (err) { next(err); }
});

router.post('/sponsor-packages', requireEventAccess, requirePermission('canManageSponsors'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const pkg = {
      id: uuidv4(),
      name: req.body.name,
      level: req.body.level || 'Custom',
      description: req.body.description || '',
      capacity: Number(req.body.capacity || 1), // NOP
      price: Number(req.body.price || 0),
      zones: req.body.zones || [],
      benefits: req.body.benefits || [],
      contactNumber: req.body.contactNumber || '',
      isVisible: req.body.isVisible !== false,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
    };

    event.sponsorPackages.push(pkg);
    await event.save();
    res.status(201).json({ success: true, data: { package: pkg }, message: 'Sponsor package created.' });
  } catch (err) { next(err); }
});

router.put('/sponsor-packages/:packageId', requireEventAccess, requirePermission('canManageSponsors'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    const pkg = event.sponsorPackages.find(p => p.id === req.params.packageId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    Object.assign(pkg, {
      name: req.body.name ?? pkg.name,
      level: req.body.level ?? pkg.level,
      description: req.body.description ?? pkg.description,
      capacity: req.body.capacity != null ? Number(req.body.capacity) : pkg.capacity,
      price: req.body.price != null ? Number(req.body.price) : pkg.price,
      zones: req.body.zones ?? pkg.zones,
      benefits: req.body.benefits ?? pkg.benefits,
      contactNumber: req.body.contactNumber ?? pkg.contactNumber,
      isVisible: req.body.isVisible ?? pkg.isVisible,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : pkg.expiryDate,
    });

    await event.save();
    res.json({ success: true, data: { package: pkg }, message: 'Sponsor package updated.' });
  } catch (err) { next(err); }
});

router.delete('/sponsor-packages/:packageId', requireEventAccess, requirePermission('canManageSponsors'), async (req, res, next) => {
  try {
    const event = await Event.findById(resolveEventId(req));
    // Check if any sponsor is assigned to this package
    const assignedSponsor = await Sponsor.findOne({ eventId: event._id, packageId: req.params.packageId });
    if (assignedSponsor) return res.status(400).json({ success: false, message: 'Cannot delete package with active assignments.' });

    event.sponsorPackages = event.sponsorPackages.filter(p => p.id !== req.params.packageId);
    await event.save();
    res.json({ success: true, message: 'Sponsor package deleted.' });
  } catch (err) { next(err); }
});

// --- SPONSOR ASSIGNMENTS ---

router.get('/sponsors', requireEventAccess, requirePermission('canManageSponsors'), async (req, res, next) => {
  try {
    const sponsors = await Sponsor.find({ eventId: resolveEventId(req) }).lean();
    res.json({ success: true, data: sponsors });
  } catch (err) { next(err); }
});

router.post('/sponsors', requireEventAccess, requirePermission('canManageSponsors'), async (req, res, next) => {
  try {
    const { companyName, contactPerson, email, phone, packageId, notes } = req.body;
    const eventId = resolveEventId(req);
    const event = await Event.findById(eventId);
    
    const pkg = event.sponsorPackages.find(p => p.id === packageId);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });

    let user = await User.findOne({ email });
    const tempPassword = Math.random().toString(36).slice(-10);
    // Enforce event-level contact requirements
    const emailRequired = event.settings?.communicationChannels?.email === true;
    const smsRequired = event.settings?.communicationChannels?.sms === true;
    if (emailRequired && (!email || String(email).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Email is required for sponsors on this event.' });
    }
    if (smsRequired && (!phone || String(phone).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Phone number is required for sponsors on this event.' });
    }

    if (!user) {
      user = await User.create({
        name: contactPerson,
        email,
        phone,
        password: tempPassword,
        role: 'Sponsor',
        isTempPassword: true,
        isVerified: true,
        assignedEvents: [event._id]
      });
    } else {
      // Validate existing user contact info meets event requirements
      if (emailRequired && (!user.email || String(user.email).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Existing user does not have an email required for sponsor on this event.' });
      }
      if (smsRequired && (!user.phone || String(user.phone).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Existing user does not have a phone number required for sponsor on this event.' });
      }

      user.role = 'Sponsor';
      user.isVerified = true;
      if (!user.assignedEvents.includes(event._id)) user.assignedEvents.push(event._id);
      await user.save();
    }

    const sponsor = await Sponsor.create({
      eventId: event._id,
      packageId,
      companyName,
      contactPerson,
      email,
      phone,
      userId: user._id,
      assignedBy: req.user._id,
      notes
    });

    // Create the first attendee (the sponsor contact person themselves) as a pass holder
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    await Attendee.create({
      event: event._id,
      sponsorId: sponsor._id,
      fullName: contactPerson,
      email,
      phone,
      categoryName: `${pkg.name} Pass`,
      confirmationToken,
      confirmationStatus: 'pending',
      photoVerificationStatus: 'pending',
      isActive: true,
      zones: pkg.zones || []
    });

    await logActivity({
      req,
      action: 'sponsor_action',
      eventId: event._id,
      details: { message: `Sponsor onboarded: ${companyName} (${pkg.name})` }
    });

    await logActivity({
      req,
      action: 'ticket_creation',
      eventId: event._id,
      details: { message: `Sponsor ticket created: ${contactPerson} (${pkg.name} Pass)` }
    });

    // Send Welcome Email + Pass Invite
    const notificationService = require('../services/notificationService');
    try {
      await notificationService.notifySponsorWelcome(user, event, pkg, tempPassword, confirmationToken);
    } catch (emailErr) {
      console.error('Failed to send sponsor welcome email:', emailErr);
    }

    res.status(201).json({ success: true, data: sponsor, message: 'Sponsor created and notified.' });
  } catch (err) { next(err); }
});

router.delete('/sponsors/:id', requireEventAccess, requirePermission('canManageSponsors'), async (req, res, next) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id);
    if (!sponsor) return res.status(404).json({ success: false, message: 'Sponsor not found.' });

    // Optionally deactivate user account or remove from event
    if (sponsor.userId) {
       const user = await User.findById(sponsor.userId);
       if (user) {
         user.assignedEvents = user.assignedEvents.filter(id => id.toString() !== sponsor.eventId.toString());
         await user.save();
       }
    }

    await Sponsor.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sponsor removed.' });
  } catch (err) { next(err); }
});

module.exports = router;
