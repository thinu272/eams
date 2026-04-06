const express = require('express');
const router = express.Router();
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const ZoneLog = require('../models/ZoneLog');
const { protect, restrictTo } = require('../middleware/auth');
const { emitDashboardEvent } = require('../utils/socket');

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

  return event.createdBy?.toString() === user._id.toString();
};

const userHasZoneAccess = (user, zoneName) => {
  if (!zoneName) return false;
  if (['main_admin', 'main_organiser', 'sub_organiser'].includes(user.role)) return true;
  if (!['staff', 'volunteer'].includes(user.role)) return false;

  const assignedZones = (user.assignedZones || []).filter(Boolean);
  if (!assignedZones.length) return true;

  return assignedZones.includes(zoneName);
};

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
        } : null,
      },
    },
  };
};

router.post('/scan', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const requestedZone = normalizeZoneName(req.body.zone);
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
    const hasEventAccess = await userHasEventAccess(req.user, event);
    if (!hasEventAccess) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const { zoneId, zoneName } = resolveZone(event, requestedZone);

    if (!userHasZoneAccess(req.user, zoneName)) {
      return res.status(403).json({ success: false, message: `You are not assigned to scan ${zoneName}.` });
    }

    const lastGrantedLog = await ZoneLog.findOne({
      attendeeId: attendee._id,
      zoneName,
      accessGranted: true,
    }).sort({ timestamp: -1 });

    const action = lastGrantedLog?.action === 'ENTRY' ? 'EXIT' : 'ENTRY';

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

    if (!attendee.isActive || !attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: 'INVALID_TICKET',
        httpStatus: 403,
        message: 'Invalid ticket',
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

    const event = await Event.findById(eventId).select('createdBy');
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

    if (['staff', 'volunteer'].includes(req.user.role) && (req.user.assignedZones || []).length) {
      if (typeof filter.zoneName === 'string') {
        if (!req.user.assignedZones.includes(filter.zoneName)) {
          return res.json({ success: true, data: { logs: [] } });
        }
      } else {
        filter.zoneName = { $in: req.user.assignedZones };
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
