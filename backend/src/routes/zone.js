const express = require('express');
const router = express.Router();
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const ZoneLog = require('../models/ZoneLog');
const { protect, restrictTo } = require('../middleware/auth');
const { emitDashboardEvent } = require('../utils/socket');
const { normalizeRole, ROLES } = require('../utils/rbac');

/**
 * Check if a ticket is valid for entry.
 * Rules:
 * 1. Ticket must not be cancelled
 * 2. Ticket must be confirmed/active
 * 3. Ticket must not be expired (event end time)
 */
const isTicketValid = (ticket, event) => {
  // Check if ticket is cancelled
  if (ticket.status === 'CANCELLED' || ticket.status === 'EXPIRED') {
    return { valid: false, reason: 'TICKET_CANCELLED', message: 'Ticket has been cancelled' };
  }

  // Check if ticket is confirmed/active
  if (ticket.status !== 'CONFIRMED' && ticket.status !== 'SOLD' && ticket.status !== 'ACTIVE') {
    return { valid: false, reason: 'TICKET_NOT_CONFIRMED', message: 'Ticket has not been confirmed' };
  }

  // Check if event has ended (ticket expiration is based on event end time)
  if (event?.endDateTime) {
    const eventEndTime = new Date(event.endDateTime);
    if (eventEndTime < new Date()) {
      return { valid: false, reason: 'EVENT_ENDED', message: 'Event has ended' };
    }
  }

  return { valid: true };
};

/**
 * Check if a reservation ticket can be checked in (for cash at venue)
 * Reservations are valid until the event ends
 */
const isReservationValid = (ticket, event) => {
  // Check if ticket is reserved
  if (ticket.status !== 'RESERVED' && ticket.status !== 'PENDING') {
    return { valid: false, reason: 'NOT_RESERVED', message: 'Not a reservation ticket' };
  }

  // Check if event has ended
  if (event?.endDateTime) {
    const eventEndTime = new Date(event.endDateTime);
    if (eventEndTime < new Date()) {
      return { valid: false, reason: 'EVENT_ENDED', message: 'Event has ended' };
    }
  }

  return { valid: true };
};

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
  
  // High-level administrators always have full access
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return true;
  
  // Other roles (SubOrganiser, Staff, Volunteer, Auditor) must have explicit zone access
  const assignedZones = [
    ...(user.assignedZones || []).map(String),
    ...(user.responsibilities?.zoneIds || []).map(String),
  ].filter(Boolean);

  // Wildcard check for all zones
  if (assignedZones.includes('all') || assignedZones.includes('ALL_ZONES')) return true;

  // If the team member has no zones assigned, they cannot access any zone
  if (!assignedZones.length) return false;

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

    emitDashboardEvent(io, 'zone_scan', attendee.event.toString(), {
      source: 'zone',
      eventId: attendee.event,
      attendeeName: attendee.fullName, // Use attendeeName for frontend compatibility
      action: denialReason === 'DUPLICATE_SCAN' ? 'DUPLICATE' : 'DENIED',
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

    // Fetch the event with endDateTime for expiration check
    const fullEvent = await Event.findById(event._id).select('endDateTime zones');
    
    // Validate ticket status against event end time
    const ticketValidation = isTicketValid(attendee, fullEvent);
    if (!ticketValidation.valid) {
      const denied = await buildDeniedResponse({
        attendee,
        zoneName,
        action,
        scanMethod: qrToken ? 'QR' : 'RFID',
        userId: req.user._id,
        io,
        denialReason: ticketValidation.reason,
        httpStatus: 403,
        message: ticketValidation.message,
      });

      return res.status(denied.status).json(denied.body);
    }

    // Check if event has ended (for any ticket status)
    if (fullEvent?.endDateTime) {
      const eventEndTime = new Date(fullEvent.endDateTime);
      if (eventEndTime < new Date()) {
        const denied = await buildDeniedResponse({
          attendee,
          zoneName,
          action,
          scanMethod: qrToken ? 'QR' : 'RFID',
          userId: req.user._id,
          io,
          denialReason: 'EVENT_ENDED',
          httpStatus: 403,
          message: 'Event has ended. No further entries allowed.',
        });

        return res.status(denied.status).json(denied.body);
      }
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

    emitDashboardEvent(io, 'zone_scan', event._id.toString(), {
      source: 'zone',
      eventId: event._id,
      attendeeName: attendee.fullName,
      action: action, // 'ENTRY' or 'EXIT'
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
