const express = require('express');
const router = express.Router();
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const ZoneLog = require('../models/ZoneLog');
const { protect, restrictTo } = require('../middleware/auth');
const { emitDashboardEvent } = require('../utils/socket');
const { normalizeRole, ROLES } = require('../utils/rbac');

const DUPLICATE_SCAN_WINDOW_MS = 5000;

const normalizeZoneName = (value) => (value || '').trim();

const resolveZone = (event, requestedZone) => {
  const normalizedZone = normalizeZoneName(requestedZone);
  const zone = event?.zones?.find((item) => item.name === normalizedZone || item.id === normalizedZone);

  return {
    requestedZone: normalizedZone,
    zoneId: zone?.id || normalizedZone,
    zoneName: zone?.name || normalizedZone,
  };
};

const userHasEventAccess = async (user, event) => {
  if (!user || !event) return false;
  if (user.role === 'main_admin') return true;

  const eventId = event._id.toString();
  const assignedEventIds = (user.assignedEvents || []).map((item) => item.toString());
  if (assignedEventIds.includes(eventId)) return true;

  if (event.createdBy?.toString() === user._id.toString()) return true;
  if (event.mainOrganiser?.toString() === user._id.toString()) return true;
  
  return false;
};

const userHasZoneAccess = (user, zoneName, zoneId) => {
  if (!zoneName && !zoneId) return false;
  const role = normalizeRole(user?.role);
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(role)) return true;
  if (![ROLES.STAFF, ROLES.VOLUNTEER].includes(role)) return false;

  const assignedZones = [
    ...(user.assignedZones || []).map(String),
    ...(user.responsibilities?.zoneIds || []).map(String),
  ].filter(Boolean);
  if (!assignedZones.length) return true;

  return assignedZones.includes(String(zoneName)) || assignedZones.includes(String(zoneId));
};

const getUserAssignedZones = (user) => Array.from(new Set([
  ...((user?.assignedZones || []).map(String)),
  ...((user?.responsibilities?.zoneIds || []).map(String)),
])).filter(Boolean);

const buildDeniedResponse = async ({
  attendee,
  zoneName,
  action,
  scanMethod,
  userId,
  io,
  denialReason,
  httpStatus,
  message,
}) => {
  if (attendee?.event) {
    const deniedLog = await ZoneLog.create({
      attendeeId: attendee._id,
      eventId: attendee.event,
      zoneName,
      action,
      accessGranted: false,
      denialReason,
      scanMethod,
      scannedBy: userId,
      attendeeSnapshot: {
        fullName: attendee.fullName,
        categoryName: attendee.categoryName,
        allowedZones: attendee.allowedZones || [],
      },
    });

    emitDashboardEvent(io, 'zone_update', attendee.event.toString(), {
      source: 'zone',
      eventId: attendee.event,
      name: attendee.fullName,
      action: denialReason === 'DUPLICATE_SCAN' ? 'DUPLICATE SCAN' : 'ZONE DENIED',
      zoneName,
      timestamp: deniedLog.timestamp,
      accessGranted: false,
    });
  }

  return {
    status: httpStatus,
    body: {
      success: false,
      reason: denialReason,
      message,
      data: {
        action,
        zoneName,
        attendee: attendee ? {
          _id: attendee._id,
          fullName: attendee.fullName,
          categoryName: attendee.categoryName,
          allowedZones: attendee.allowedZones || [],
          photo: attendee.photo,
        } : null,
      },
    },
  };
};

router.post('/scan', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const requestedZone = normalizeZoneName(req.body.zone);
    const requestedEventId = String(req.body.eventId || '').trim();
    const qrToken = req.body.qrToken?.trim();
    const rfidId = req.body.rfidId?.trim();

    if (!requestedZone) {
      return res.status(400).json({ success: false, reason: 'ZONE_REQUIRED', message: 'Zone is required.' });
    }

    if (!qrToken && !rfidId) {
      return res.status(400).json({ success: false, reason: 'TOKEN_REQUIRED', message: 'qrToken or rfidId is required.' });
    }

    const attendee = await Attendee.findOne(
      qrToken ? { qrToken } : { wristbandId: rfidId }
    ).populate('event', 'name createdBy zones');

    if (!attendee) {
      return res.status(404).json({
        success: false,
        reason: 'INVALID_TICKET',
        message: 'Invalid ticket',
        data: {
          action: 'ENTRY',
          zoneName: requestedZone,
          attendee: null,
        },
      });
    }

    const event = attendee.event;
    if (requestedEventId && event?._id?.toString() !== requestedEventId) {
      return res.status(404).json({
        success: false,
        reason: 'EVENT_MISMATCH',
        message: 'Attendee does not belong to the selected event.',
        data: {
          action: 'ENTRY',
          zoneName: requestedZone,
          attendee: null,
        },
      });
    }
    const hasEventAccess = await userHasEventAccess(req.user, event);
    if (!hasEventAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const { zoneId, zoneName } = resolveZone(event, requestedZone);

    if (!userHasZoneAccess(req.user, zoneName, zoneId)) {
      return res.status(403).json({ success: false, message: `You are not assigned to scan ${zoneName}.` });
    }

    let action = req.body.action;
    
    if (!action) {
      const lastGrantedLog = await ZoneLog.findOne({
        attendeeId: attendee._id,
        zoneName,
        accessGranted: true,
      }).sort({ timestamp: -1 });

      action = lastGrantedLog?.action === 'ENTRY' ? 'EXIT' : 'ENTRY';
    }

    const recentLog = await ZoneLog.findOne({
      attendeeId: attendee._id,
      zoneName,
    }).sort({ timestamp: -1 });

    if (recentLog && (Date.now() - recentLog.timestamp.getTime()) < DUPLICATE_SCAN_WINDOW_MS) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'DUPLICATE_SCAN',
        httpStatus: 429,
        message: 'Please wait before scanning this attendee again.',
      });

      return res.status(denied.status).json(denied.body);
    }

    if (!attendee.isActive || attendee.isDisabled || !attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      const denialReason = attendee.isDisabled ? 'TICKET_DISABLED' : 'INVALID_TICKET';
      const message = attendee.isDisabled ? 'Ticket has been disabled' : 'Invalid ticket';
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason,
        httpStatus: 403,
        message,
      });

      return res.status(denied.status).json(denied.body);
    }

    const allowedZones = attendee.allowedZones || [];
    if (!allowedZones.includes(zoneName) && !allowedZones.includes(zoneId)) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'NOT_ALLOWED',
        httpStatus: 403,
        message: 'Zone not included in ticket',
      });

      return res.status(denied.status).json(denied.body);
    }

    const zoneLog = await ZoneLog.create({
      attendeeId: attendee._id,
      eventId: event._id,
      zoneName,
      action,
      accessGranted: true,
      scanMethod: qrToken ? 'QR' : 'RFID',
      scannedBy: req.user._id,
      attendeeSnapshot: {
        fullName: attendee.fullName,
        categoryName: attendee.categoryName,
        allowedZones,
      },
    });

    emitDashboardEvent(io, 'zone_update', event._id.toString(), {
      source: 'zone',
      eventId: event._id,
      name: attendee.fullName,
      action: action === 'ENTRY' ? 'ZONE ENTRY' : 'ZONE EXIT',
      zoneName,
      timestamp: zoneLog.timestamp,
      accessGranted: true,
      categoryName: attendee.categoryName,
      processedByName: req.user.name || req.user.email,
    });

    res.json({
      success: true,
      message: 'Access Granted',
      data: {
        accessGranted: true,
        action,
        zoneName,
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          categoryName: attendee.categoryName,
          allowedZones,
          photo: attendee.photo,
        },
        event: {
          _id: event._id,
          name: event.name,
        },
        log: zoneLog,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer', 'auditor'), async (req, res, next) => {
  try {
    const { eventId, zone, limit = 10 } = req.query;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'eventId is required.' });
    }

    const event = await Event.findById(eventId).select('createdBy zones');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const hasEventAccess = await userHasEventAccess(req.user, event);
    if (!hasEventAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { eventId };
    if (zone) {
      const resolvedZone = resolveZone(event, zone);
      filter.zoneName = resolvedZone.zoneName;
    }

    const userAssignedZones = getUserAssignedZones(req.user);
    if ([ROLES.STAFF, ROLES.VOLUNTEER].includes(normalizeRole(req.user.role)) && userAssignedZones.length) {
      if (typeof filter.zoneName === 'string') {
        const resolvedFilterZone = resolveZone(event, filter.zoneName);
        const canAccessRequestedZone =
          userAssignedZones.includes(String(filter.zoneName)) ||
          userAssignedZones.includes(String(resolvedFilterZone.zoneName)) ||
          userAssignedZones.includes(String(resolvedFilterZone.zoneId));

        if (!canAccessRequestedZone) {
          return res.json({ success: true, data: { logs: [] } });
        }

        filter.zoneName = resolvedFilterZone.zoneName;
      } else {
        const allowedZoneNames = userAssignedZones
          .map((zone) => resolveZone(event, zone).zoneName)
          .filter(Boolean);
        filter.zoneName = { $in: Array.from(new Set(allowedZoneNames)) };
      }
    }

    const logs = await ZoneLog.find(filter)
      .populate('attendeeId', 'fullName categoryName allowedZones')
      .populate('scannedBy', 'name role')
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit, 10) || 10, 25));

    res.json({ success: true, data: { logs } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
