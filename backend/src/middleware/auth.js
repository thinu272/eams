const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

// Restrict to certain roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not permitted to perform this action.`,
      });
    }
    next();
  };
};

// Check user has access to a specific event
const requireEventAccess = async (req, res, next) => {
  const { user } = req;
  const eventId = req.params.eventId || req.body.eventId;

  if (user.role === 'main_admin') return next();
  if (!eventId) return res.status(400).json({ success: false, message: 'Event ID required.' });

  // Check assignedEvents list
  if (user.assignedEvents.some(e => e.toString() === eventId)) return next();

  // Check if they are the creator (for unassigned organisers)
  const Event = require('../models/Event');
  const event = await Event.findById(eventId);
  if (event && event.createdBy?.toString() === user._id.toString()) return next();

  console.log(`ACCESS_DENIED: User ${user._id} (${user.role}) for Event ${eventId}`);
  return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
};

// Check sub_organiser permission flag
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'main_admin' || req.user.role === 'main_organiser') return next();
    if (!req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission: ${permission}`,
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo, requireEventAccess, requirePermission };
