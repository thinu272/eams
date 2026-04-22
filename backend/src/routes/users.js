const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES, hasRolePower, normalizeRole } = require('../utils/rbac');
const { notifySubOrganiserInvite } = require('../services/notificationService');

// All routes require authentication
router.use(protect);

/**
 * GET /api/users
 * Admins see everyone. Organisers see users within their scope.
 */
router.get('/', restrictTo(ROLES.MAIN_ORGANISER), async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    let filter = {};

    // MainAdmin (100) can see everything. 
    // Others are scoped to their creation or assigned events.
    if (!hasRolePower(req.user.role, ROLES.MAIN_ADMIN)) {
      filter = {
        $or: [
          { createdBy: req.user._id },
          { assignedEvents: { $in: req.user.assignedEvents || [] } }
        ]
      };
    }

    if (role) {
      filter.role = normalizeRole(role);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('assignedEvents', 'name')
        .skip(skip)
        .limit(parseInt(limit))
        .sort('-createdAt'),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        users,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/users
 * Administrative recruitment of system personnel.
 */
router.post('/', restrictTo(ROLES.MAIN_ORGANISER), [
  body('name').notEmpty().withMessage('Full name required'),
  body('email').isEmail().withMessage('Valid identity email required'),
  body('password').isLength({ min: 8 }).withMessage('Security code must be 8+ characters'),
  body('role').notEmpty().withMessage('Command role must be specified'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const targetRole = normalizeRole(req.body.role);

    // Permission Check: Cannot create a role higher than or equal to your own (except Admins)
    if (!hasRolePower(req.user.role, ROLES.MAIN_ADMIN)) {
      if (hasRolePower(targetRole, req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient clearance to initialize this authority level.' 
        });
      }
    }

    // Email conflict check
    const exists = await User.findOne({ email: req.body.email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Identity email already registered in ecosystem.' });
    }

    const user = await User.create({
      ...req.body,
      role: targetRole,
      createdBy: req.user._id,
    });

    if (targetRole === ROLES.SUB_ORGANISER) {
      notifySubOrganiserInvite({ user, event: null, phone: user.phone, email: user.email }).catch(console.error);
    }

    res.status(201).json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/users/:id
 * Update user profile or authority grade.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { role, permissions, password, assignedEvent, assignedEvents, ...updateData } = req.body;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ success: false, message: 'Identity not found.' });

    // Authority Check: Only supervisors or admins can modify identities
    const isSelf = targetUser._id.toString() === req.user._id.toString();
    const canManage = hasRolePower(req.user.role, ROLES.MAIN_ADMIN) || (hasRolePower(req.user.role, targetUser.role) && !isSelf);

    if (!isSelf && !canManage) {
      return res.status(403).json({ success: false, message: 'Insufficient clearance to modify this identity.' });
    }

    const normalizedIncomingRole = role ? normalizeRole(role) : null;

    // Role Escalation Protection
    // Non-admins can submit the current role value from the edit form, but they
    // cannot actually change authority levels.
    if (
      normalizedIncomingRole &&
      normalizedIncomingRole !== normalizeRole(targetUser.role) &&
      !hasRolePower(req.user.role, ROLES.MAIN_ADMIN)
    ) {
      return res.status(403).json({ success: false, message: 'Only System Administrators can re-grade authority levels.' });
    }

    // If updating password
    if (password) {
      targetUser.password = password;
      await targetUser.save();
    }

    if (normalizedIncomingRole) updateData.role = normalizedIncomingRole;
    if (permissions) updateData.permissions = permissions;
    if (assignedEvents !== undefined) {
      updateData.assignedEvents = Array.isArray(assignedEvents) ? assignedEvents.filter(Boolean) : [];
    } else if (assignedEvent !== undefined) {
      updateData.assignedEvents = assignedEvent ? [assignedEvent] : [];
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true, runValidators: true,
    }).populate('assignedEvents', 'name');

    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/users/:id
 * Revoke system access.
 */
router.delete('/:id', restrictTo(ROLES.MAIN_ADMIN), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Identity not found.' });
    res.json({ success: true, message: 'Identity de-commissioned from system.' });
  } catch (err) { next(err); }
});

module.exports = router;
