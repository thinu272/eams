const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Event = require('../models/Event');
const { protect, restrictTo } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// GET /api/users - list users (admin sees all, organiser sees their event's users)
router.get('/', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { role, eventId, page = 1, limit = 20 } = req.query;
    let filter = {};

    if (req.user.role === 'main_organiser') {
      // Organiser only sees users in their events
      const events = await Event.find({ mainOrganiser: req.user._id }).select('_id');
      const eventIds = events.map(e => e._id);
      filter.assignedEvents = { $in: eventIds };
    }
    if (role) filter.role = role;
    if (eventId) filter.assignedEvents = eventId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter).select('-password').populate('assignedEvents', 'name').skip(skip).limit(parseInt(limit)).sort('-createdAt'),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: { users, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// POST /api/users - create user (admin or organiser creating staff/sub-organiser)
router.post('/', restrictTo('main_admin', 'main_organiser'), [
  body('name').notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be 8+ characters'),
  body('role').isIn(['main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor']).withMessage('Invalid role'),
], async (req, res, next) => {
  try {
    console.log('CREATE_USER_REQUEST:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('CREATE_USER_VALIDATION_ERRORS:', errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Only main_admin can create main_organiser
    if (req.body.role === 'main_organiser' && req.user.role !== 'main_admin') {
      return res.status(403).json({ success: false, message: 'Only main admin can create organisers.' });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists.' });
    }

    const user = await User.create({
      ...req.body,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    console.error('CREATE_USER_ERROR:', err);
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).populate('assignedEvents', 'name status');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id - update user
router.patch('/:id', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { password, role, ...updateData } = req.body;
    // Prevent role escalation by non-admin
    if (role && req.user.role !== 'main_admin') {
      return res.status(403).json({ success: false, message: 'Only admin can change roles.' });
    }
    if (role) updateData.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true, runValidators: true,
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/assign-event - assign user to event
router.patch('/:id/assign-event', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { eventId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { assignedEvents: eventId } },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id/remove-event - remove user from event
router.patch('/:id/remove-event', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { eventId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { assignedEvents: eventId } },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/toggle-active
router.patch('/:id/toggle-active', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

module.exports = router;
