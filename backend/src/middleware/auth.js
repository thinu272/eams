const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const { checkRoleMatch, getCanonicalRole, normalizeRole, ROLES } = require('../utils/rbac');

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
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }
    const status = String(user.status || 'Active');
    if (status !== 'Active') {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }
    
    // Normalize role for robust RBAC
    user.rbacRole = getCanonicalRole(user.role);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * RBAC middleware: restrictTo('Staff')
 * Handles Inheritance: MainAdmin passes Staff check.
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });

    if (!checkRoleMatch(req.user.role, roles)) {
      return res.status(403).json({
        success: false,
        message: `Your authority level (${req.user.role}) is insufficient for this operational command.`,
      });
    }
    next();
  };
};

/**
 * Checks if user is authorized for a specific event
 * MainAdmin bypasses all event checks.
 */
const requireEventAccess = async (req, res, next) => {
  try {
    const { user } = req;
    const rawId = req.params.eventId || req.body.eventId || req.query.eventId;
    const eventId = (rawId && rawId !== 'undefined') ? rawId : (user.assignedEvents && user.assignedEvents[0]);

    // Root Authority bypass (Admins and Main Organisers have global scope)
    const canonicalRole = normalizeRole(user.role);
    if (canonicalRole === ROLES.MAIN_ADMIN || canonicalRole === ROLES.MAIN_ORGANISER) {
      return next();
    }
    
    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID required for scoped operation.' });
    }
    
    // Validate format
    const isValid = mongoose.Types.ObjectId.isValid(eventId);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }

    // Check explicit assignments
    if (user.assignedEvents.some(e => e.toString() === eventId.toString())) {
      return next();
    }

    // Check creator status (for organisers who haven't been 'assigned' yet)
    const Event = require('../models/Event');
    const event = await Event.findById(eventId).select('createdBy mainOrganiser');
    if (event && (event.createdBy?.toString() === user._id.toString() || event.mainOrganiser?.toString() === user._id.toString())) {
      return next();
    }

    console.log(`[requireEventAccess] DENIED: User ${user._id} attempting scope ${eventId}`);
    return res.status(403).json({ success: false, message: 'Target event is outside your authorized scope.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Check fine-grained permissions stored in the User JSON.
 * High-level roles (Admin/Organiser) usually have full permissions by default.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    const role = normalizeRole(req.user.role);
    
    // Full authority roles bypass specific flag checks
    if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return next();
    
    // Check specific JSON flag
    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Target operation requires specific clearance: ${permission}`,
      });
    }
    next();
  };
};

// Legacy Support: some routes still use checkRole as an alias for restrictTo
const checkRole = restrictTo;

module.exports = { 
  protect, 
  restrictTo, 
  checkRole,
  requireEventAccess, 
  requirePermission 
};
