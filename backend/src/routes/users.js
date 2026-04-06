const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Event = require('../models/Event');
const { protect, restrictTo } = require('../middleware/auth');
const { expandRoles } = require('../utils/rbac');

const USER_ROLE_VALUES = ['main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor'];
const ALLOWED_ROLE_INPUTS = Array.from(
  new Set([
    ...USER_ROLE_VALUES,
    'ORGANISER',
    'SUB_ORGANISER',
    'STAFF',
    'AUDITOR',
    'VOLUNTEER',
  ])
);

const canAccessEvent = async (currentUser, eventId) => {
  if (!eventId) return false;
  if (currentUser.role === 'main_admin') return true;
  return currentUser.assignedEvents?.some((assigned) => assigned.toString() === eventId.toString());
};

const canManageUser = async (currentUser, targetUser, eventId) => {
  if (currentUser.role === 'main_admin') return true;
  if (!eventId) {
    return targetUser.assignedEvents?.some((assigned) =>
      currentUser.assignedEvents?.some((own) => own.toString() === assigned.toString())
    );
  }
  return canAccessEvent(currentUser, eventId);
};

// All routes require auth
router.use(protect);

// GET /api/users - list users (admin sees all, organiser sees their event's users)
router.get('/', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { role, eventId, page = 1, limit = 20 } = req.query;
    let filter = {};

    if (req.user.role === 'main_organiser') {
      const eventIds = (req.user.assignedEvents || []).map((event) => event.toString());
      filter.assignedEvents = { $in: eventIds };
    }
    if (role) {
      const expandedRoles = expandRoles([role]).filter((item) => USER_ROLE_VALUES.includes(item));
      filter.role = expandedRoles.length > 1 ? { $in: expandedRoles } : expandedRoles[0] || role;
    }
    if (eventId) {
      if (req.user.role === 'main_organiser' && !(await canAccessEvent(req.user, eventId))) {
        return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
      }
      filter.assignedEvents = eventId;
    }

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
  body('role').custom((value) => {
    if (!ALLOWED_ROLE_INPUTS.includes(String(value || '').trim().toUpperCase()) && !ALLOWED_ROLE_INPUTS.includes(String(value || '').trim().toLowerCase())) {
      throw new Error('Invalid role');
    }
    return true;
  }),
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
    if (req.user.role === 'main_organiser' && !['sub_organiser', 'staff', 'volunteer', 'auditor'].includes(req.body.role)) {
      return res.status(403).json({ success: false, message: 'You can only create sub-organisers and operational roles.' });
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
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!(await canManageUser(req.user, existingUser, req.body.eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this user.' });
    }

    // Prevent role escalation by non-admin
    if (role && req.user.role !== 'main_admin') {
      return res.status(403).json({ success: false, message: 'Only admin can change roles.' });
    }
    if (role) updateData.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true, runValidators: true,
    });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/permissions - update sub-organiser / staff permissions
router.patch('/:id/permissions', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { eventId, permissions = {}, assignedZones = [], assignedGates = [] } = req.body;
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!(await canManageUser(req.user, existingUser, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this user.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        permissions: {
          ...existingUser.permissions?.toObject?.(),
          ...permissions,
        },
        assignedZones,
        assignedGates,
      },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/assign-event - assign user to event
router.patch('/:id/assign-event', restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { eventId } = req.body;
    if (req.user.role === 'main_organiser' && !(await canAccessEvent(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }
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
    if (req.user.role === 'main_organiser' && !(await canAccessEvent(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }
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
    if (!(await canManageUser(req.user, user))) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this user.' });
    }
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

module.exports = router;
