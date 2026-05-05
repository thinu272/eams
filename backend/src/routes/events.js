const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const SystemConfig = require('../models/SystemConfig');
const { protect, restrictTo, requireEventAccess } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper to validate ObjectId
const isValidObjectId = (id) => {
  if (!id) return false;
  if (typeof id === 'object' && id._id) return mongoose.Types.ObjectId.isValid(id._id);
  if (typeof id === 'object' && id.toString) {
    try {
      return mongoose.Types.ObjectId.isValid(id.toString());
    } catch {
      return false;
    }
  }
  return mongoose.Types.ObjectId.isValid(id);
};

// Multer config for event images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: {
    fileSize:
      parseInt(process.env.EVENT_COVER_MAX_FILE_SIZE, 10) ||
      parseInt(process.env.MAX_FILE_SIZE, 10) ||
      10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only JPG, JPEG, PNG, WEBP, or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!['{', '[', '"'].includes(trimmed[0])) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeEventPayload = (body, file, files) => {
  const payload = { ...body };

  ['venue', 'categories', 'zones', 'settings', 'matchDetails', 'concertDetails', 'conferenceDetails', 'customFields'].forEach((key) => {
    if (key in payload) {
      payload[key] = parseMaybeJson(payload[key]);
    }
  });

  if (payload.settings) {
    if (payload.settings.emailTemplates === undefined || payload.settings.emailTemplates === null) {
      delete payload.settings.emailTemplates;
    }
    if (payload.settings.smsTemplates === undefined || payload.settings.smsTemplates === null) {
      delete payload.settings.smsTemplates;
    }
  }

  if (payload.mainOrganiser && typeof payload.mainOrganiser === 'object') {
    payload.mainOrganiser = payload.mainOrganiser._id || payload.mainOrganiser.id || payload.mainOrganiser;
  }

  if (payload.mainOrganiser === '' || payload.mainOrganiser === null || payload.mainOrganiser === undefined) {
    delete payload.mainOrganiser;
  }

  if (file) {
    // Single file legacy support
    payload.coverImage = `/uploads/${file.filename}`;
  }

  if (files) {
    // Ensure branding exists
    payload.branding = payload.branding || {};

    if (files.coverImage) {
      const path = `/uploads/${files.coverImage[0].filename}`;
      payload.coverImage = path;
      payload.branding.coverImage = path;
    }
    
    if (files.logoImage) {
      const path = `/uploads/${files.logoImage[0].filename}`;
      payload.logoImage = path;
      payload.branding.logoImage = path;
    }

    if (files.bannerImage) {
      const path = `/uploads/${files.bannerImage[0].filename}`;
      payload.bannerImage = path;
      payload.branding.bannerImage = path;
    }
  }

  return payload;
};

// GET /api/events/config/public - public system config
router.get('/config/public', async (req, res, next) => {
  try {
    const config = await SystemConfig.findOne();
    res.json({
      success: true,
      data: {
        currency: config?.currency || 'LKR',
        maintenanceMode: !!config?.maintenanceMode,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/events - public listing (no auth needed)
router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 12, search, date, category } = req.query;
    
    // Default to showing published and ongoing events
    const filter = {
      status: status ? status : { $in: ['published', 'ongoing'] },
      endDate: { $gte: new Date(new Date().getTime() - 60 * 60 * 1000) } // Lenient expiry (1 hour grace)
    };

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (date) {
      filter.startDate = { $gte: new Date(date) };
    }

    if (category) {
      filter.eventType = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .select('name slug description venue startDate eventType categories coverImage bannerImage branding')
        .sort('startDate')
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, data: { events, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/events/admin/all - admin sees all events
router.get('/admin/all', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, search, from, to } = req.query;
    const filter = status ? { status } : {};
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    if (from || to) {
      const dateFilter = {};
      if (from) {
        const fromDate = new Date(from);
        if (!Number.isNaN(fromDate.getTime())) dateFilter.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          dateFilter.$lte = toDate;
        }
      }
      if (Object.keys(dateFilter).length) {
        filter.startDate = dateFilter;
      }
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter).populate('mainOrganiser', 'name email').sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);
    const Attendee = require('../models/Attendee');
    const eventIds = events.map((event) => event._id);
    const attendeeCounts = await Attendee.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: '$event', count: { $sum: 1 } } },
    ]);
    const countMap = attendeeCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});
    const eventsWithCounts = events.map((event) => ({
      ...event.toObject(),
      totalAttendees: countMap[event._id.toString()] || 0,
      ticketCategoryCount: event.categories?.length || 0,
    }));
    res.json({ success: true, data: { events: eventsWithCounts, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/events/my/events - organiser's assigned events
router.get('/my/events', protect, restrictTo('main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor'), async (req, res, next) => {
  try {
    const events = await Event.find({ _id: { $in: req.user.assignedEvents } })
      .populate('mainOrganiser', 'name email')
      .sort('-startDate');
    res.json({ success: true, data: { events } });
  } catch (err) { next(err); }
});

// GET /api/events/manage/:eventId - load event for editing
router.get('/manage/:eventId', protect, requireEventAccess, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .populate('mainOrganiser', 'name email')
      .populate('subOrganisers', 'name email');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    res.json({ success: true, data: { event } });
  } catch (err) {
    if (err.name === 'CastError' && err.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    next(err);
  }
});

// POST /api/events - create event (admin and organiser)
router.post('/', protect, restrictTo('main_admin', 'main_organiser'), upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'logoImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), [
  body('name').notEmpty().withMessage('Event name required'),
  body('venue.name').notEmpty().withMessage('Venue name required'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
  body('endDate').isISO8601().withMessage('Valid end date required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const eventData = normalizeEventPayload(req.body, req.file, req.files);
    eventData.createdBy = req.user._id;
    const event = await Event.create(eventData);
    
    // Auto-assign to creator (admin)
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { assignedEvents: event._id } });
    
    // Auto-assign to main organiser if provided
    if (req.body.mainOrganiser) {
      if (req.user.role !== 'main_admin' && req.body.mainOrganiser !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'You can only assign yourself as the organiser.' });
      }
      await User.findByIdAndUpdate(req.body.mainOrganiser, { $addToSet: { assignedEvents: event._id } });
    }
    
    res.status(201).json({ success: true, data: { event } });
  } catch (err) { 
    console.error('EVENT_POST_ERROR:', err.message);
    next(err); 
  }
});

// PATCH /api/events/:eventId/assign-organiser
router.patch('/:eventId/assign-organiser', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { organiserId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const User = require('../models/User');
    const [event, organiser] = await Promise.all([
      Event.findByIdAndUpdate(req.params.eventId, { mainOrganiser: organiserId }, { new: true }),
      User.findByIdAndUpdate(organiserId, { $addToSet: { assignedEvents: req.params.eventId } }, { new: true }),
    ]);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
});

// PATCH /api/events/:eventId/publish
router.patch('/:eventId/publish', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
});

// GET /api/events/:eventId/dashboard - organiser dashboard data
router.get('/:eventId/dashboard', protect, requireEventAccess, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const Attendee = require('../models/Attendee');
    const Order = require('../models/Order');
    const EntryLog = require('../models/EntryLog');

    const [event, attendeeStats, orderStats, recentLogs] = await Promise.all([
      Event.findById(req.params.eventId).populate('mainOrganiser', 'name email').populate('subOrganisers', 'name email'),
      Attendee.aggregate([
        { $match: { event: new (require('mongoose').Types.ObjectId)(req.params.eventId) } },
        { $group: { _id: '$confirmationStatus', count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { event: new (require('mongoose').Types.ObjectId)(req.params.eventId) } },
        { $group: { _id: '$paymentStatus', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      ]),
      EntryLog.find({ event: req.params.eventId }).sort('-timestamp').limit(20).populate('attendee', 'fullName categoryName'),
    ]);

    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event, attendeeStats, orderStats, recentLogs } });
  } catch (err) { next(err); }
});

// PATCH /api/events/:eventId - update event
router.patch('/:eventId', protect, upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'logoImage', maxCount: 1 },
  { name: 'bannerImage', maxCount: 1 }
]), restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    console.log('[PATCH /events/:eventId]', { 
      eventId, 
      eventIdType: typeof eventId,
      user: { id: req.user?._id, role: req.user?.role }
    });
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      console.error('[PATCH] ObjectId validation failed:', eventId);
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    
    // Check access for non-admin users
    if (req.user.role !== 'main_admin') {
      const userHasAccess = req.user.assignedEvents?.some(e => e.toString() === eventId) ||
        (await Event.findById(eventId).select('createdBy').then(e => e?.createdBy?.toString() === req.user._id.toString()));
      
      if (!userHasAccess) {
        console.log('[PATCH] User does not have access to event:', eventId);
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
    }
    
    const updateData = normalizeEventPayload(req.body, req.file, req.files);
    const existingEvent = await Event.findById(eventId).select('mainOrganiser');
    if (!existingEvent) return res.status(404).json({ success: false, message: 'Event not found.' });

    if (req.user.role !== 'main_admin' && updateData.mainOrganiser && updateData.mainOrganiser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only assign yourself as the organiser.' });
    }

    const event = await Event.findByIdAndUpdate(eventId, updateData, {
      new: true, runValidators: true,
    });

    if (req.user.role === 'main_admin' && Object.prototype.hasOwnProperty.call(updateData, 'mainOrganiser')) {
      const User = require('../models/User');
      const oldOrganiserId = existingEvent.mainOrganiser?.toString();
      const newOrganiserId = updateData.mainOrganiser ? updateData.mainOrganiser.toString() : null;

      if (oldOrganiserId && oldOrganiserId !== newOrganiserId) {
        await User.findByIdAndUpdate(oldOrganiserId, { $pull: { assignedEvents: event._id } });
      }
      if (newOrganiserId) {
        await User.findByIdAndUpdate(newOrganiserId, { $addToSet: { assignedEvents: event._id } });
      }
    }

    console.log('[PATCH] Event updated successfully:', event._id);
    const io = req.app.get('io');
    if (io) {
      io.to(`event:${event._id}`).emit('event_update', { eventId: event._id });
      io.to(`dashboard:${event._id}`).emit('event_update', { eventId: event._id });
    }

    res.json({ success: true, data: { event } });
  } catch (err) {
    console.error('[PATCH] Error:', err.message);
    next(err);
  }
});

// DELETE /api/events/:eventId - delete event (admin only)
router.delete('/:eventId', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    // Also remove from assignedEvents in all users
    const User = require('../models/User');
    await User.updateMany({}, { $pull: { assignedEvents: req.params.eventId } });
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) { next(err); }
});

// GET /api/events/:slug - public detail (no auth needed) - MUST BE LAST!
router.get('/:slug', async (req, res, next) => {
  try {
    const event = await Event.findOne({
      $or: [{ slug: req.params.slug }, { _id: req.params.slug.match(/^[a-f\d]{24}$/i) ? req.params.slug : null }],
    }).populate('mainOrganiser', 'name email');
    if (!event || event.status === 'draft') {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const isExpired = event.endDate && new Date(event.endDate) < new Date();
    res.json({ success: true, data: { event, isExpired } });
  } catch (err) { next(err); }
});

// POST /api/events/:slug/validate-code
router.post('/:slug/validate-code', async (req, res, next) => {
  try {
    const { categoryId, accessCode } = req.body;
    if (!categoryId || !accessCode) {
      return res.status(400).json({ success: false, message: 'Category ID and Access Code are required.' });
    }

    const event = await Event.findOne({
      $or: [{ slug: req.params.slug }, { _id: req.params.slug.match(/^[a-f\d]{24}$/i) ? req.params.slug : null }],
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const category = event.categories.find(c => String(c.id) === String(categoryId));
    if (!category) {
      return res.status(404).json({ success: false, message: 'Ticket category not found.' });
    }

    if (!category.isPrivate || !category.accessCodeHash) {
      return res.status(400).json({ success: false, message: 'This ticket category is not private.' });
    }

    // Check usage limits (if applicable)
    if (category.maxUsage && category.usageCount >= category.maxUsage) {
      return res.status(403).json({ success: false, message: 'This access code has reached its maximum usage limit.' });
    }

    // Check overall capacity
    if (category.sold >= category.capacity) {
      return res.status(403).json({ success: false, message: 'This ticket category is sold out.' });
    }

    // Verify code
    const isMatch = await bcrypt.compare(accessCode, category.accessCodeHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid access code.' });
    }

    res.json({ 
      success: true, 
      message: 'Access code validated successfully.',
      data: {
        categoryId,
        unlocked: true
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
