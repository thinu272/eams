const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getRoleBasedDashboardData } = require('../controllers/roleBasedDashboardController');

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/dashboard/role-based - Get role-specific dashboard data
router.get('/role-based', getRoleBasedDashboardData);

// GET /api/dashboard/role-based/metrics - Get role-specific metrics
router.get('/role-based/metrics', async (req, res, next) => {
  try {
    const user = req.user;
    const role = user.role?.toLowerCase();
    
    let metrics = {};

    switch (role) {
      case 'mainadmin':
        metrics = await getAdminMetrics();
        break;
      case 'mainorganiser':
        metrics = await getOrganiserMetrics(user);
        break;
      case 'suborganiser':
        metrics = await getSubOrganiserMetrics(user);
        break;
      case 'staff':
      case 'volunteer':
        metrics = await getStaffMetrics(user);
        break;
      case 'auditor':
        metrics = await getAuditorMetrics();
        break;
      case 'attendee':
      default:
        metrics = await getAttendeeMetrics(user);
        break;
    }

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/role-based/activity - Get role-specific activity feed
router.get('/role-based/activity', async (req, res, next) => {
  try {
    const { limit = 20, type } = req.query;
    const user = req.user;
    
    let activity = await getRoleBasedActivity(user, parseInt(limit), type);
    
    res.json({
      success: true,
      data: { activity },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/role-based/notifications - Get role-specific notifications
router.get('/role-based/notifications', async (req, res, next) => {
  try {
    const { unread = false, limit = 10 } = req.query;
    const user = req.user;
    
    let notifications = await getRoleBasedNotifications(user, unread === 'true', parseInt(limit));
    
    res.json({
      success: true,
      data: { notifications },
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions for metrics
const getAdminMetrics = async () => {
  const Event = require('../models/Event');
  const User = require('../models/User');
  const Order = require('../models/Order');
  const Attendee = require('../models/Attendee');
  const EntryLog = require('../models/EntryLog');

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const [
    totalEvents,
    totalUsers,
    totalOrders,
    totalRevenue,
    activeEvents,
    pendingVerifications,
    todayCheckIns,
    todayRegistrations
  ] = await Promise.all([
    Event.countDocuments(),
    User.countDocuments(),
    Order.countDocuments({ status: 'confirmed' }),
    Order.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    Event.countDocuments({ 
      startDate: { $lte: now }, 
      endDate: { $gte: now },
      status: 'published' 
    }),
    Attendee.countDocuments({ photoVerificationStatus: 'pending' }),
    EntryLog.countDocuments({ 
      timestamp: { $gte: todayStart },
      action: 'check_in',
      accessGranted: true 
    }),
    User.countDocuments({ createdAt: { $gte: todayStart } })
  ]);

  return {
    totalEvents,
    totalUsers,
    totalOrders,
    totalRevenue: totalRevenue[0]?.total || 0,
    activeEvents,
    pendingVerifications,
    todayCheckIns,
    todayRegistrations,
    growth: {
      usersGrowth: await getGrowthRate('users', 'daily'),
      eventsGrowth: await getGrowthRate('events', 'daily'),
      revenueGrowth: await getGrowthRate('revenue', 'daily')
    }
  };
};

const getOrganiserMetrics = async (user) => {
  const Event = require('../models/Event');
  const Attendee = require('../models/Attendee');
  const Order = require('../models/Order');
  const EntryLog = require('../models/EntryLog');

  const assignedEvents = user.assignedEvents || [];
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const [
    totalEvents,
    totalAttendees,
    totalRevenue,
    activeEvents,
    pendingVerifications,
    todayCheckIns,
    todayRegistrations
  ] = await Promise.all([
    Event.countDocuments({ _id: { $in: assignedEvents } }),
    Attendee.countDocuments({ event: { $in: assignedEvents } }),
    Order.aggregate([
      { $match: { eventId: { $in: assignedEvents }, status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    Event.countDocuments({ 
      _id: { $in: assignedEvents },
      startDate: { $lte: now }, 
      endDate: { $gte: now },
      status: 'published' 
    }),
    Attendee.countDocuments({ 
      event: { $in: assignedEvents },
      photoVerificationStatus: 'pending' 
    }),
    EntryLog.countDocuments({ 
      event: { $in: assignedEvents },
      timestamp: { $gte: todayStart },
      action: 'check_in',
      accessGranted: true 
    }),
    Attendee.countDocuments({ 
      event: { $in: assignedEvents },
      createdAt: { $gte: todayStart }
    })
  ]);

  return {
    totalEvents,
    totalAttendees,
    totalRevenue: totalRevenue[0]?.total || 0,
    activeEvents,
    pendingVerifications,
    todayCheckIns,
    todayRegistrations
  };
};

const getSubOrganiserMetrics = async (user) => {
  const Event = require('../models/Event');
  const Attendee = require('../models/Attendee');
  const EntryLog = require('../models/EntryLog');
  const ZoneLog = require('../models/ZoneLog');

  const assignedEvents = user.assignedEvents || [];
  const assignedZones = user.zoneIds || [];
  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const [
    totalEvents,
    zoneAttendees,
    pendingVerifications,
    todayCheckIns,
    todayZoneEntries,
    zoneOccupancy
  ] = await Promise.all([
    Event.countDocuments({ _id: { $in: assignedEvents } }),
    Attendee.countDocuments({ 
      event: { $in: assignedEvents },
      allowedZones: { $in: assignedZones }
    }),
    Attendee.countDocuments({ 
      event: { $in: assignedEvents },
      photoVerificationStatus: 'pending' 
    }),
    EntryLog.countDocuments({ 
      event: { $in: assignedEvents },
      timestamp: { $gte: todayStart },
      action: 'check_in',
      accessGranted: true 
    }),
    ZoneLog.countDocuments({ 
      eventId: { $in: assignedEvents },
      zoneName: { $in: assignedZones },
      timestamp: { $gte: todayStart },
      action: 'ENTRY',
      accessGranted: true 
    }),
    ZoneLog.aggregate([
      { $match: { 
        eventId: { $in: assignedEvents },
        zoneName: { $in: assignedZones }
      }},
      {
        $group: {
          _id: '$zoneName',
          currentOccupancy: { $sum: { $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, -1] } },
          totalEntries: { $sum: { $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, 0] } }
        }
      }
    ])
  ]);

  return {
    totalEvents,
    zoneAttendees,
    pendingVerifications,
    todayCheckIns,
    todayZoneEntries,
    zoneOccupancy
  };
};

const getStaffMetrics = async (user) => {
  const EntryLog = require('../models/EntryLog');
  const ZoneLog = require('../models/ZoneLog');

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));

  const [
    todayScans,
    todayDenials,
    todayZoneScans,
    recentScans
  ] = await Promise.all([
    EntryLog.countDocuments({ 
      processedBy: user._id,
      timestamp: { $gte: todayStart }
    }),
    EntryLog.countDocuments({ 
      processedBy: user._id,
      timestamp: { $gte: todayStart },
      accessGranted: false
    }),
    ZoneLog.countDocuments({ 
      processedBy: user._id,
      timestamp: { $gte: todayStart },
      action: 'ENTRY',
      accessGranted: true 
    }),
    EntryLog.find({ processedBy: user._id })
      .sort('-timestamp')
      .limit(5)
      .populate('attendee', 'fullName')
      .populate('event', 'name')
  ]);

  return {
    todayScans,
    todayDenials,
    todayZoneScans,
    scanRate: todayScans > 0 ? ((todayScans - todayDenials) / todayScans * 100).toFixed(1) : 0,
    recentScans
  };
};

const getAuditorMetrics = async () => {
  const Event = require('../models/Event');
  const Attendee = require('../models/Attendee');
  const Order = require('../models/Order');
  const EntryLog = require('../models/EntryLog');

  const [
    totalEvents,
    totalAttendees,
    totalRevenue,
    verificationBreakdown,
    accessBreakdown,
    recentAuditActivity
  ] = await Promise.all([
    Event.countDocuments(),
    Attendee.countDocuments(),
    Order.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    Attendee.aggregate([
      {
        $group: {
          _id: '$photoVerificationStatus',
          count: { $sum: 1 }
        }
      }
    ]),
    EntryLog.aggregate([
      { $match: { timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: '$accessGranted',
          count: { $sum: 1 }
        }
      }
    ]),
    // This would typically query audit logs
    []
  ]);

  return {
    totalEvents,
    totalAttendees,
    totalRevenue: totalRevenue[0]?.total || 0,
    verificationBreakdown,
    accessBreakdown,
    recentAuditActivity
  };
};

const getAttendeeMetrics = async (user) => {
  const Ticket = require('../models/Ticket');
  const Order = require('../models/Order');
  const Attendee = require('../models/Attendee');

  const email = user.email;
  const now = new Date();

  const [
    totalTickets,
    activeTickets,
    totalOrders,
    upcomingEvents
  ] = await Promise.all([
    Ticket.countDocuments({ attendee: user._id }),
    Ticket.countDocuments({ 
      attendee: user._id,
      'event.startDate': { $gte: now }
    }),
    Order.countDocuments({ buyerEmail: email }),
    Ticket.aggregate([
      { $match: { attendee: user._id } },
      { $lookup: { from: 'events', localField: 'event', foreignField: '_id', as: 'event' } },
      { $unwind: '$event' },
      { $match: { 'event.startDate': { $gte: now } } },
      { $group: { _id: null, events: { $addToSet: '$event._id' } } }
    ])
  ]);

  return {
    totalTickets,
    activeTickets,
    totalOrders,
    upcomingEvents: upcomingEvents[0]?.events?.length || 0
  };
};

// Helper functions for activity feed
const getRoleBasedActivity = async (user, limit, type) => {
  const EntryLog = require('../models/EntryLog');
  const ZoneLog = require('../models/ZoneLog');
  const Attendee = require('../models/Attendee');

  let activity = [];

  switch (user.role?.toLowerCase()) {
    case 'mainadmin':
      activity = await EntryLog.find({})
        .sort('-timestamp')
        .limit(limit)
        .populate('attendee', 'fullName')
        .populate('event', 'name')
        .populate('processedBy', 'name');
      break;
    case 'mainorganiser':
    case 'suborganiser':
      activity = await EntryLog.find({ event: { $in: user.assignedEvents || [] } })
        .sort('-timestamp')
        .limit(limit)
        .populate('attendee', 'fullName')
        .populate('event', 'name')
        .populate('processedBy', 'name');
      break;
    case 'staff':
    case 'volunteer':
      activity = await EntryLog.find({ processedBy: user._id })
        .sort('-timestamp')
        .limit(limit)
        .populate('attendee', 'fullName')
        .populate('event', 'name');
      break;
    case 'attendee':
    default:
      activity = await EntryLog.find({ attendee: user._id })
        .sort('-timestamp')
        .limit(limit)
        .populate('event', 'name');
      break;
  }

  return activity.map(log => ({
    id: log._id,
    type: type || 'scan',
    title: `${log.action.replace('_', ' ').toUpperCase()}`,
    description: `${log.attendee?.fullName || 'You'} - ${log.event?.name || 'Unknown'}`,
    time: log.timestamp,
    details: {
      action: log.action,
      accessGranted: log.accessGranted,
      zone: log.zoneName,
      gate: log.gateName
    }
  }));
};

// Helper functions for notifications
const getRoleBasedNotifications = async (user, unreadOnly, limit) => {
  // This would typically query a notifications collection
  // For now, return mock data based on role
  const notifications = [];

  switch (user.role?.toLowerCase()) {
    case 'mainadmin':
      notifications.push(
        { id: 1, title: 'System Update', message: 'System maintenance scheduled', type: 'info', unread: true },
        { id: 2, title: 'New Registration', message: '5 new users registered today', type: 'success', unread: true }
      );
      break;
    case 'mainorganiser':
      notifications.push(
        { id: 1, title: 'Event Starting Soon', message: 'Your event starts in 2 hours', type: 'warning', unread: true },
        { id: 2, title: 'Pending Verifications', message: '3 photos need verification', type: 'info', unread: false }
      );
      break;
    case 'suborganiser':
      notifications.push(
        { id: 1, title: 'Zone Capacity Alert', message: 'Zone A is at 90% capacity', type: 'warning', unread: true }
      );
      break;
    case 'staff':
      notifications.push(
        { id: 1, title: 'Shift Reminder', message: 'Your shift starts in 30 minutes', type: 'info', unread: true }
      );
      break;
    case 'attendee':
    default:
      notifications.push(
        { id: 1, title: 'Event Reminder', message: 'Your event is tomorrow', type: 'info', unread: true }
      );
      break;
  }

  return notifications
    .filter(n => !unreadOnly || n.unread)
    .slice(0, limit);
};

// Helper function for growth rates
const getGrowthRate = async (metric, period) => {
  // This would calculate actual growth rates based on historical data
  // For now, return mock data
  return {
    daily: Math.random() * 10 - 5, // -5% to +5%
    weekly: Math.random() * 20 - 10, // -10% to +10%
    monthly: Math.random() * 30 - 15 // -15% to +15%
  };
};

module.exports = router;
