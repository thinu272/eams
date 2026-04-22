const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');
const User = require('../models/User');
const Role = require('../models/Role');

const getRoleBasedDashboardData = async (req, res, next) => {
  try {
    const user = req.user;
    const role = user.role?.toLowerCase();
    
    let dashboardData = {};

    switch (role) {
      case 'mainadmin':
        dashboardData = await getAdminDashboardData(user);
        break;
      case 'mainorganiser':
        dashboardData = await getOrganiserDashboardData(user);
        break;
      case 'suborganiser':
        dashboardData = await getSubOrganiserDashboardData(user);
        break;
      case 'staff':
      case 'volunteer':
        dashboardData = await getStaffDashboardData(user);
        break;
      case 'auditor':
        dashboardData = await getAuditorDashboardData(user);
        break;
      case 'attendee':
      default:
        dashboardData = await getAttendeeDashboardData(user);
        break;
    }

    res.json({
      success: true,
      data: dashboardData,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
};

const getAdminDashboardData = async (user) => {
  const now = new Date();
  
  // System-wide metrics
  const [
    totalEvents,
    totalUsers,
    totalOrders,
    totalRevenue,
    activeEvents,
    pendingVerifications,
    todayCheckIns,
    systemHealth
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
      timestamp: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
      action: 'check_in',
      accessGranted: true 
    }),
    getSystemHealthMetrics()
  ]);

  // Recent activity
  const recentActivity = await getRecentActivity(null, 10);

  // Events by status
  const eventsByStatus = await Event.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Users by role
  const usersByRole = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  return {
    overview: {
      totalEvents,
      totalUsers,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      activeEvents,
      pendingVerifications,
      todayCheckIns,
      systemHealth
    },
    charts: {
      eventsByStatus,
      usersByRole
    },
    recentActivity,
    permissions: {
      canViewAllEvents: true,
      canManageAllUsers: true,
      canAccessSystemSettings: true,
      canViewAllReports: true
    }
  };
};

const getOrganiserDashboardData = async (user) => {
  const now = new Date();
  const assignedEvents = user.assignedEvents || [];
  
  // Event-specific metrics
  const [
    totalEvents,
    totalAttendees,
    totalRevenue,
    activeEvents,
    pendingVerifications,
    todayCheckIns
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
      timestamp: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
      action: 'check_in',
      accessGranted: true 
    })
  ]);

  // Recent activity for assigned events
  const recentActivity = await getRecentActivity(assignedEvents, 10);

  // Events list with stats
  const eventsWithStats = await getEventsWithStats(assignedEvents);

  return {
    overview: {
      totalEvents,
      totalAttendees,
      totalRevenue: totalRevenue[0]?.total || 0,
      activeEvents,
      pendingVerifications,
      todayCheckIns
    },
    events: eventsWithStats,
    recentActivity,
    permissions: {
      canManageEvents: true,
      canManageAttendees: true,
      canViewReports: true,
      canSendNotifications: true
    }
  };
};

const getSubOrganiserDashboardData = async (user) => {
  const now = new Date();
  const assignedEvents = user.assignedEvents || [];
  const assignedZones = user.zoneIds || [];
  
  // Zone-specific metrics
  const [
    totalEvents,
    totalAttendees,
    pendingVerifications,
    todayCheckIns,
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
      timestamp: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
      action: 'check_in',
      accessGranted: true 
    }),
    getZoneOccupancy(assignedEvents, assignedZones)
  ]);

  // Recent activity for assigned zones
  const recentActivity = await getZoneActivity(assignedEvents, assignedZones, 10);

  return {
    overview: {
      totalEvents,
      totalAttendees,
      pendingVerifications,
      todayCheckIns,
      zoneOccupancy
    },
    zones: zoneOccupancy,
    recentActivity,
    permissions: {
      canManageZones: true,
      canVerifyPhotos: true,
      canScanEntry: true,
      canBulkUpload: true
    }
  };
};

const getStaffDashboardData = async (user) => {
  const now = new Date();
  const assignedEvents = user.assignedEvents || [];
  const assignedZones = user.zoneIds || [];
  
  // Staff-specific metrics
  const [
    todayScans,
    todayDenials,
    recentScans,
    zoneStatus
  ] = await Promise.all([
    EntryLog.countDocuments({ 
      processedBy: user._id,
      timestamp: { $gte: new Date(now.setHours(0, 0, 0, 0)) }
    }),
    EntryLog.countDocuments({ 
      processedBy: user._id,
      timestamp: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
      accessGranted: false
    }),
    EntryLog.find({ processedBy: user._id })
      .sort('-timestamp')
      .limit(10)
      .populate('attendee', 'fullName')
      .populate('event', 'name'),
    getZoneStatus(assignedEvents, assignedZones)
  ]);

  return {
    overview: {
      todayScans,
      todayDenials,
      scanRate: todayScans > 0 ? ((todayScans - todayDenials) / todayScans * 100).toFixed(1) : 0
    },
    recentScans,
    zones: zoneStatus,
    permissions: {
      canScanEntry: true,
      canScanZones: true,
      canManualSearch: true
    }
  };
};

const getAuditorDashboardData = async (user) => {
  const now = new Date();
  
  // Auditor-specific metrics
  const [
    totalEvents,
    totalAttendees,
    totalRevenue,
    verificationStats,
    accessStats,
    recentAuditLogs
  ] = await Promise.all([
    Event.countDocuments(),
    Attendee.countDocuments(),
    Order.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    getVerificationStats(),
    getAccessStats(),
    getAuditLogs(10)
  ]);

  return {
    overview: {
      totalEvents,
      totalAttendees,
      totalRevenue: totalRevenue[0]?.total || 0,
      verificationStats,
      accessStats
    },
    auditLogs: recentAuditLogs,
    permissions: {
      canViewAllReports: true,
      canExportData: true,
      canViewAuditLogs: true
    }
  };
};

const getAttendeeDashboardData = async (user) => {
  const email = user.email;
  const now = new Date();
  
  // Attendee-specific data
  const [
    tickets,
    orders,
    upcomingEvents,
    recentActivity
  ] = await Promise.all([
    Ticket.find({ attendee: user._id })
      .populate('event', 'name startDate endDate venue')
      .sort('-createdAt'),
    Order.find({ buyerEmail: email })
      .populate('eventId', 'name startDate endDate venue')
      .sort('-createdAt'),
    Event.find({
      status: 'published',
      startDate: { $gte: now }
    })
      .select('name startDate venue coverImage')
      .sort('startDate')
      .limit(6),
    getAttendeeActivity(user._id, 5)
  ]);

  const currentTickets = tickets.filter(t => 
    t.event?.startDate && new Date(t.event.startDate) >= now
  );

  const previousOrders = orders.filter(o => 
    o.eventId?.endDate && new Date(o.eventId.endDate) < now
  );

  return {
    tickets: currentTickets,
    previousOrders,
    upcomingEvents,
    recentActivity,
    permissions: {
      canViewOwnTickets: true,
      canViewOwnOrders: true,
      canUpdateProfile: true
    }
  };
};

// Helper functions
const getSystemHealthMetrics = async () => {
  // System health checks
  return {
    database: 'healthy',
    api: 'healthy',
    lastBackup: new Date(),
    uptime: process.uptime()
  };
};

const getRecentActivity = async (eventIds, limit = 10) => {
  const match = eventIds ? { event: { $in: eventIds } } : {};
  
  const activity = await EntryLog.find(match)
    .sort('-timestamp')
    .limit(limit)
    .populate('attendee', 'fullName')
    .populate('event', 'name')
    .populate('processedBy', 'name');

  return activity.map(log => ({
    id: log._id,
    type: 'scan',
    title: `${log.action.replace('_', ' ').toUpperCase()}`,
    description: `${log.attendee?.fullName || 'Unknown'} - ${log.event?.name || 'Unknown'}`,
    time: log.timestamp,
    user: log.processedBy?.name
  }));
};

const getEventsWithStats = async (eventIds) => {
  const events = await Event.find({ _id: { $in: eventIds } })
    .select('name startDate endDate venue status')
    .sort('startDate');

  const stats = await Attendee.aggregate([
    { $match: { event: { $in: eventIds } } },
    {
      $group: {
        _id: '$event',
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: ['$isConfirmed', 1, 0] } },
        checkedIn: { $sum: { $cond: ['$checkedIn', 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$photoVerificationStatus', 'pending'] }, 1, 0] } }
      }
    }
  ]);

  const statMap = stats.reduce((acc, stat) => {
    acc[stat._id.toString()] = stat;
    return acc;
  }, {});

  return events.map(event => ({
    ...event.toObject(),
    stats: statMap[event._id.toString()] || { total: 0, confirmed: 0, checkedIn: 0, pending: 0 }
  }));
};

const getZoneOccupancy = async (eventIds, zoneIds) => {
  return await ZoneLog.aggregate([
    { $match: { eventId: { $in: eventIds }, zoneName: { $in: zoneIds } } },
    {
      $group: {
        _id: '$zoneName',
        currentOccupancy: { $sum: { $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, -1] } },
        totalEntries: { $sum: { $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, 0] } },
        totalExits: { $sum: { $cond: [{ $eq: ['$action', 'EXIT'] }, 1, 0] } }
      }
    }
  ]);
};

const getZoneActivity = async (eventIds, zoneIds, limit) => {
  return await ZoneLog.find({ 
    eventId: { $in: eventIds }, 
    zoneName: { $in: zoneIds } 
  })
    .sort('-timestamp')
    .limit(limit)
    .populate('attendeeId', 'fullName')
    .populate('eventId', 'name');
};

const getZoneStatus = async (eventIds, zoneIds) => {
  return await ZoneLog.aggregate([
    { $match: { eventId: { $in: eventIds }, zoneName: { $in: zoneIds } } },
    { $sort: { timestamp: -1 } },
    { $group: {
      _id: '$zoneName',
      lastActivity: { $first: '$timestamp' },
      currentOccupancy: { $sum: { $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, -1] } }
    }}
  ]);
};

const getVerificationStats = async () => {
  return await Attendee.aggregate([
    {
      $group: {
        _id: '$photoVerificationStatus',
        count: { $sum: 1 }
      }
    }
  ]);
};

const getAccessStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return await EntryLog.aggregate([
    { $match: { timestamp: { $gte: today } } },
    {
      $group: {
        _id: '$accessGranted',
        count: { $sum: 1 }
      }
    }
  ]);
};

const getAuditLogs = async (limit) => {
  // This would typically query an audit logs collection
  return [];
};

const getAttendeeActivity = async (userId, limit) => {
  // Get activity specific to the attendee
  const tickets = await Ticket.find({ attendee: userId })
    .populate('event', 'name')
    .sort('-updatedAt')
    .limit(limit);

  return tickets.map(ticket => ({
    id: ticket._id,
    type: 'ticket',
    title: `Ticket ${ticket.status}`,
    description: ticket.event?.name || 'Event',
    time: ticket.updatedAt
  }));
};

module.exports = {
  getRoleBasedDashboardData
};
