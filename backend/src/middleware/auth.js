const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const { checkRoleMatch, getCanonicalRole } = require('../utils/rbac');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      console.log('PROTECT_FAILED: No token found for', req.url);
      return res.status(401).json({ success: false, message: 'Not authorised. No token.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }
    user.rbacRole = getCanonicalRole(user.role);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// RBAC middleware: checkRole(['SUPER_ADMIN']) or checkRole(['ORGANISER', 'AUDITOR'])
const checkRole = (roles = []) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!checkRoleMatch(req.user.role, allowedRoles)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.rbacRole || req.user.role}' is not permitted to perform this action.`,
      });
    }
    next();
  };
};

// Legacy alias kept so existing routes stay protected without being rewritten.
const restrictTo = (...roles) => checkRole(roles);

// Check user has access to a specific event
const requireEventAccess = async (req, res, next) => {
  const { user } = req;
  const eventId = req.params.eventId || req.body.eventId;

  console.log('[requireEventAccess]', { 
    eventId, 
    userRole: user?.role, 
    userId: user?._id,
    hasEventId: !!eventId
  });

  if (['main_admin', 'super_admin'].includes(user.role)) {
    console.log('[requireEventAccess] User is admin-level, allowing access');
    return next();
  }
  
  if (!eventId) {
    console.error('[requireEventAccess] No eventId provided');
    return res.status(400).json({ success: false, message: 'Event ID required.' });
  }
  
  // Validate ObjectId format - support both string and ObjectId
  const isValid = eventId && (
    mongoose.Types.ObjectId.isValid(eventId) || 
    (typeof eventId === 'object' && eventId._id && mongoose.Types.ObjectId.isValid(eventId._id))
  );
  
  console.log('[requireEventAccess] ObjectId validation:', { eventId, isValid });
  
  if (!isValid) {
    console.error('[requireEventAccess] Invalid ObjectId format:', eventId);
    return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
  }

  // Check assignedEvents list
  if (user.assignedEvents.some(e => e.toString() === eventId.toString())) {
    console.log('[requireEventAccess] User found in assignedEvents, allowing access');
    return next();
  }

  // Check if they are the creator (for unassigned organisers)
  const Event = require('../models/Event');
  const event = await Event.findById(eventId);
  if (event && event.createdBy?.toString() === user._id.toString()) {
    console.log('[requireEventAccess] User is event creator, allowing access');
    return next();
  }

  console.log(`[requireEventAccess] ACCESS_DENIED: User ${user._id} (${user.role}) for Event ${eventId}`);
  return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
};

// Check sub_organiser permission flag
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (['main_admin', 'super_admin', 'main_organiser'].includes(req.user.role)) return next();
    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission: ${permission}`,
      });
    }
    next();
  };
};

module.exports = { protect, checkRole, restrictTo, requireEventAccess, requirePermission };
