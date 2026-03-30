const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const { protect, restrictTo, requireEventAccess } = require('../middleware/auth');

// GET /api/events - public listing (no auth needed)
router.get('/', async (req, res, next) => {
  try {
    const { status = 'published', page = 1, limit = 12 } = req.query;
    const filter = { status };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter)
        .select('name slug description venue startDate endDate status categories coverImage matchDetails')
        .sort('startDate')
        .skip(skip)
        .limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, data: { events, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/events/:slug - public detail (no auth needed)
router.get('/:slug', async (req, res, next) => {
  try {
    const event = await Event.findOne({
      $or: [{ slug: req.params.slug }, { _id: req.params.slug.match(/^[a-f\d]{24}$/i) ? req.params.slug : null }],
    }).populate('mainOrganiser', 'name email');
    if (!event || event.status === 'draft') {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    res.json({ success: true, data: { event } });
  } catch (err) { next(err); }
});

// Everything below requires auth
router.use(protect);

// POST /api/events - create event (admin only)
router.post('/', restrictTo('main_admin'), [
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
    const event = await Event.create({ ...req.body, createdBy: req.user._id });
    
    // Auto-assign to creator (admin)
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { assignedEvents: event._id } });
    
    // Auto-assign to main organiser if provided
    if (req.body.mainOrganiser) {
      await User.findByIdAndUpdate(req.body.mainOrganiser, { $addToSet: { assignedEvents: event._id } });
    }
    
    res.status(201).json({ success: true, data: { event } });
  } catch (err) { next(err); }
});

// GET /api/events/admin/all - admin sees all events
router.get('/admin/all', restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [events, total] = await Promise.all([
      Event.find(filter).populate('mainOrganiser', 'name email').sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, data: { events, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/events/my/events - organiser's assigned events
router.get('/my/events', restrictTo('main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor'), async (req, res, next) => {
  try {
    const events = await Event.find({ _id: { $in: req.user.assignedEvents } })
      .populate('mainOrganiser', 'name email')
      .sort('-startDate');
    res.json({ success: true, data: { events } });
  } catch (err) { next(err); }
});

// PATCH /api/events/:eventId - update event
router.patch('/:eventId', (req, res, next) => { console.log('PATCH_EVENT_REQUEST:', req.params.eventId, req.user?.role); next(); }, restrictTo('main_admin', 'main_organiser'), requireEventAccess, async (req, res, next) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.eventId, req.body, {
      new: true, runValidators: true,
    });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, data: { event } });
  } catch (err) {
    console.error('EVENT_PATCH_ERROR:', err);
    next(err);
  }
});

// PATCH /api/events/:eventId/assign-organiser
router.patch('/:eventId/assign-organiser', restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { organiserId } = req.body;
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
router.patch('/:eventId/publish', restrictTo('main_admin'), async (req, res, next) => {
  try {
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
router.get('/:eventId/dashboard', requireEventAccess, async (req, res, next) => {
  try {
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

// DELETE /api/events/:eventId - delete event (admin only)
router.delete('/:eventId', restrictTo('main_admin'), async (req, res, next) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    // Also remove from assignedEvents in all users
    const User = require('../models/User');
    await User.updateMany({}, { $pull: { assignedEvents: req.params.eventId } });
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
