const express = require('express');
const router = express.Router();
const EntryLog = require('../models/EntryLog');
const Attendee = require('../models/Attendee');
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/auth');
const { emitDashboardEvent } = require('../utils/socket');
const { normalizeRole, ROLES } = require('../utils/rbac');

const normalizeGate = (value) => (value || '').trim();
const parseScannedToken = (value) => {
  const raw = (value || '').trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch (error) {
    return raw;
  }
};

const Event = require('../models/Event');

const userHasEventAccess = async (user, eventId) => {
  if (!user || !eventId) return false;
  if (normalizeRole(user.role) === ROLES.MAIN_ADMIN) return true;

  if ((user.assignedEvents || []).some((assignedEvent) => assignedEvent.toString() === eventId.toString())) {
    return true;
  }

  try {
    const event = await Event.findById(eventId).select('createdBy mainOrganiser');
    if (event) {
      if (event.createdBy && event.createdBy.toString() === user._id.toString()) return true;
      if (event.mainOrganiser && event.mainOrganiser.toString() === user._id.toString()) return true;
    }
  } catch (err) {
    return false;
  }

  return false;
};

const userHasGateAccess = (user, gateName) => {
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(normalizeRole(user.role))) return true;

  const assignedGates = (user.assignedGates || []).map((gate) => normalizeGate(gate)).filter(Boolean);
  if (!assignedGates.length) return true;

  return assignedGates.includes(normalizeGate(gateName));
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const buildLogPayload = ({ attendee, gateId, gateName, zoneId, zoneName, action, method, deviceId, accessGranted, denialReason, processedBy }) => ({
  event: attendee.event._id || attendee.event,
  attendee: attendee._id,
  gateId,
  gateName,
  zoneId,
  zoneName,
  action,
  method,
  deviceId,
  accessGranted,
  denialReason,
  processedBy,
  snapshot: {
    fullName: attendee.fullName,
    categoryId: attendee.categoryId,
    categoryName: attendee.categoryName,
    allowedZones: attendee.allowedZones || [],
    photoVerified: attendee.photoVerificationStatus === 'verified',
  },
});

// POST /api/entry/scan - scan QR or RFID at entry point
router.post('/scan', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const {
      qrToken,
      rfidId,
      gateId,
      gateName,
      zoneId,
      zoneName,
      action = 'check_in',
      method = 'qr',
      deviceId,
    } = req.body;
    const io = req.app.get('io');

    let attendee;
    if (qrToken) {
      attendee = await Attendee.findOne({ qrToken: parseScannedToken(qrToken) }).populate('event');
    } else if (rfidId) {
      // Check both wristbandId (assigned during check-in) and rfidTag (pre-assigned)
      attendee = await Attendee.findOne({ 
        $or: [
          { rfidTag: rfidId.trim() },
          { wristbandId: rfidId.trim() }
        ]
      }).populate('event');
    }

    if (!attendee) {
      return res.status(404).json({ success: false, reason: 'NOT_FOUND', message: 'Attendee not found. Invalid QR or RFID.' });
    }

    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, reason: 'EVENT_ACCESS_DENIED', message: 'You do not have access to this event.' });
    }

    const resolvedGate = normalizeGate(gateName || gateId);
    if (!resolvedGate) {
      return res.status(400).json({ success: false, reason: 'GATE_REQUIRED', message: 'Gate is required.' });
    }

    if (!userHasGateAccess(req.user, resolvedGate)) {
      return res.status(403).json({ success: false, reason: 'GATE_ACCESS_DENIED', message: `You are not assigned to ${resolvedGate}.` });
    }

    if (!attendee.isActive) {
      const log = await EntryLog.create(buildLogPayload({
        attendee,
        gateId: resolvedGate,
        gateName: resolvedGate,
        zoneId,
        zoneName,
        action: 'denied',
        method,
        deviceId,
        accessGranted: false,
        denialReason: 'Attendee is deactivated',
        processedBy: req.user._id,
      }));
      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: 'DENIED ENTRY',
        zoneName: zoneName || resolvedGate || 'Main Entry',
        timestamp: log.timestamp,
        accessGranted: false,
      });
      return res.status(403).json({ success: false, reason: 'DEACTIVATED', message: 'Attendee is deactivated.', data: { log } });
    }

    // --- DATE VALIDATION ---
    const now = new Date();
    const eventStart = new Date(attendee.event.startDate);
    const eventEnd = attendee.event.endDate ? new Date(attendee.event.endDate) : new Date(eventStart.getTime() + (24 * 60 * 60 * 1000));
    
    // Buffer: Allow check-in 2 hours early
    const earlyBuffer = 2 * 60 * 60 * 1000;
    const lateBuffer = 1 * 60 * 60 * 1000; // Allow checkout 1 hour late

    if (now < (eventStart.getTime() - earlyBuffer)) {
      return res.status(403).json({ 
        success: false, 
        reason: 'EVENT_NOT_STARTED', 
        message: `Event has not started yet. Starts at ${eventStart.toLocaleString()}.` 
      });
    }

    if (now > (eventEnd.getTime() + lateBuffer)) {
      return res.status(403).json({ 
        success: false, 
        reason: 'EVENT_EXPIRED', 
        message: `Event has ended. Closed at ${eventEnd.toLocaleString()}.` 
      });
    }

    if (attendee.confirmationStatus !== 'confirmed' || !attendee.isConfirmed) {
      const log = await EntryLog.create(buildLogPayload({
        attendee,
        gateId: resolvedGate,
        gateName: resolvedGate,
        zoneId,
        zoneName,
        action: 'denied',
        method,
        deviceId,
        accessGranted: false,
        denialReason: 'Identity not confirmed',
        processedBy: req.user._id,
      }));
      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: 'DENIED ENTRY',
        zoneName: zoneName || resolvedGate || 'Main Entry',
        timestamp: log.timestamp,
        accessGranted: false,
      });
      return res.status(403).json({ success: false, reason: 'NOT_CONFIRMED', message: 'Identity not confirmed.', data: { log } });
    }

    if (action === 'check_in' && attendee.checkedIn) {
      const log = await EntryLog.create(buildLogPayload({
        attendee,
        gateId: resolvedGate,
        gateName: resolvedGate,
        zoneId,
        zoneName,
        action: 'denied',
        method,
        deviceId,
        accessGranted: false,
        denialReason: 'Already checked in',
        processedBy: req.user._id,
      }));
      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: 'DENIED ENTRY',
        zoneName: zoneName || resolvedGate || 'Main Entry',
        timestamp: log.timestamp,
        accessGranted: false,
      });
      return res.status(409).json({ success: false, reason: 'ALREADY_CHECKED_IN', message: 'Attendee has already checked in.', data: { log, attendee } });
    }

    if (action === 'check_out' && !attendee.checkedIn) {
      const log = await EntryLog.create(buildLogPayload({
        attendee,
        gateId: resolvedGate,
        gateName: resolvedGate,
        zoneId,
        zoneName,
        action: 'denied',
        method,
        deviceId,
        accessGranted: false,
        denialReason: 'Not currently checked in',
        processedBy: req.user._id,
      }));
      emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
        source: 'entry',
        eventId: attendee.event._id,
        name: attendee.fullName,
        action: 'DENIED EXIT',
        zoneName: zoneName || resolvedGate || 'Main Entry',
        timestamp: log.timestamp,
        accessGranted: false,
      });
      return res.status(409).json({ success: false, reason: 'NOT_CHECKED_IN', message: 'Attendee is not currently checked in.', data: { log, attendee } });
    }

    let accessGranted = true;
    let denialReason = null;
    if (zoneId && action !== 'check_in') {
      if (!(attendee.allowedZones || []).includes(zoneId)) {
        accessGranted = false;
        denialReason = `No access to zone: ${zoneName || zoneId}`;
      }
    }

    if (action === 'check_in' && accessGranted) {
      attendee.checkedIn = true;
      attendee.checkedInAt = new Date();
    }

    if (action === 'check_out' && accessGranted) {
      attendee.checkedIn = false;
    }

    if (action === 'check_in' && accessGranted && !attendee.wristbandId) {
      attendee.wristbandId = req.body.wristbandId || `WB-${Date.now()}`;
      attendee.wristbandIssuedAt = new Date();
      attendee.wristbandIssuedBy = req.user._id;
    }

    await attendee.save();

    const logEntry = await EntryLog.create(buildLogPayload({
      attendee,
      gateId: resolvedGate,
      gateName: resolvedGate,
      zoneId,
      zoneName,
      action: accessGranted ? action : 'denied',
      method,
      deviceId,
      accessGranted,
      denialReason,
      processedBy: req.user._id,
    }));

    emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
      source: 'entry',
      eventId: attendee.event._id,
      name: attendee.fullName,
      action: accessGranted ? (action === 'check_in' ? 'CHECK-IN' : action === 'check_out' ? 'CHECK-OUT' : action.toUpperCase()) : 'DENIED ENTRY',
      zoneName: zoneName || resolvedGate || 'Main Entry',
      timestamp: logEntry.timestamp,
      accessGranted,
    });

    res.json({
      success: true,
      data: {
        accessGranted,
        denialReason,
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          phone: attendee.phone,
          photo: attendee.photo,
          categoryId: attendee.categoryId,
          categoryName: attendee.categoryName,
          allowedZones: attendee.allowedZones,
          wristbandId: attendee.wristbandId,
          photoVerificationStatus: attendee.photoVerificationStatus,
        },
        event: { name: attendee.event.name, zones: attendee.event.zones },
        log: logEntry,
      },
    });
  } catch (err) { next(err); }
});

// GET /api/entry/logs - get entry logs for event
router.get('/logs', protect, async (req, res, next) => {
  try {
    const { eventId, gateId, zoneId, action, page = 1, limit = 50 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { event: eventId };
    if (gateId) filter.gateId = gateId;
    if (zoneId) filter.zoneId = zoneId;
    if (action) filter.action = action;

    if ([ROLES.STAFF, ROLES.VOLUNTEER].includes(normalizeRole(req.user.role)) && (req.user.assignedGates || []).length) {
      const assignedGates = req.user.assignedGates.map((gate) => normalizeGate(gate)).filter(Boolean);
      if (typeof filter.gateId === 'string') {
        if (!assignedGates.includes(normalizeGate(filter.gateId))) {
          return res.json({ success: true, data: { logs: [], total: 0 } });
        }
      } else {
        filter.gateId = { $in: assignedGates };
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      EntryLog.find(filter)
        .populate('attendee', 'fullName photo categoryName phone')
        .populate('processedBy', 'name')
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit, 10)),
      EntryLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { logs, total } });
  } catch (err) { next(err); }
});

// GET /api/entry/stats - live stats for event
router.get('/stats', protect, async (req, res, next) => {
  try {
    const { eventId, gateId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const gateFilter = {};
    if (gateId) {
      gateFilter.gateId = normalizeGate(gateId);
    }

    if ([ROLES.STAFF, ROLES.VOLUNTEER].includes(normalizeRole(req.user.role)) && (req.user.assignedGates || []).length) {
      const assignedGates = req.user.assignedGates.map((gate) => normalizeGate(gate)).filter(Boolean);
      if (gateFilter.gateId && !assignedGates.includes(gateFilter.gateId)) {
        return res.json({
          success: true,
          data: {
            checkedIn: 0,
            byZone: [],
            byCategory: [],
            denied: 0,
            today: { totalScanned: 0, successfulEntries: 0, deniedEntries: 0 },
          },
        });
      }
      if (!gateFilter.gateId) {
        gateFilter.gateId = { $in: assignedGates };
      }
    }

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const todayMatch = {
      event: eventObjectId,
      timestamp: { $gte: startOfToday() },
      ...gateFilter,
    };

    const [checkedIn, byZone, byCategory, denied, todaySummary] = await Promise.all([
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true, ...gateFilter }),
      EntryLog.aggregate([
        { $match: { event: eventObjectId, action: 'zone_entry', accessGranted: true, ...gateFilter } },
        { $group: { _id: '$zoneId', zoneName: { $first: '$zoneName' }, count: { $sum: 1 } } },
      ]),
      EntryLog.aggregate([
        { $match: { event: eventObjectId, action: 'check_in', accessGranted: true, ...gateFilter } },
        { $group: { _id: '$snapshot.categoryId', categoryName: { $first: '$snapshot.categoryName' }, count: { $sum: 1 } } },
      ]),
      EntryLog.countDocuments({ event: eventId, action: 'denied', ...gateFilter }),
      EntryLog.aggregate([
        { $match: todayMatch },
        {
          $group: {
            _id: null,
            totalScanned: { $sum: 1 },
            successfulEntries: {
              $sum: {
                $cond: [{ $and: [{ $eq: ['$action', 'check_in'] }, { $eq: ['$accessGranted', true] }] }, 1, 0],
              },
            },
            deniedEntries: {
              $sum: {
                $cond: [{ $eq: ['$accessGranted', false] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        checkedIn,
        byZone,
        byCategory,
        denied,
        today: todaySummary[0] || { totalScanned: 0, successfulEntries: 0, deniedEntries: 0 },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/entry/search - staff lookup by attendee name or phone
router.get('/search', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const { eventId, q, limit = 10 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!q?.trim()) return res.json({ success: true, data: { attendees: [] } });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const query = q.trim();
    const attendees = await Attendee.find({
      event: eventId,
      isActive: true,
      $or: [
        { fullName: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { nationalId: { $regex: query, $options: 'i' } },
        { passportNumber: { $regex: query, $options: 'i' } },
      ],
    })
      .select('fullName phone qrToken categoryName confirmationStatus checkedIn photo')
      .sort({ checkedIn: 1, fullName: 1 })
      .limit(Math.min(parseInt(limit, 10) || 10, 20));

    res.json({ success: true, data: { attendees } });
  } catch (err) { next(err); }
});

// GET /api/entry/attendee/:qrToken - look up attendee by QR (entry screen)
router.get('/attendee/:qrToken', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ qrToken: req.params.qrToken })
      .populate('event', 'name venue startDate zones categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// GET /api/entry/lookup?q= - manual attendee lookup (alias for /search with looser params)
router.get('/lookup', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const { eventId, q, limit = 10 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!q?.trim()) return res.json({ success: true, data: { attendees: [] } });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }
    const query = q.trim();
    const attendees = await Attendee.find({
      event: eventId,
      isActive: true,
      $or: [
        { fullName: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
        { nationalId: { $regex: query, $options: 'i' } },
        { passportNumber: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .select('fullName phone email qrToken categoryName confirmationStatus checkedIn photo allowedZones notes wristbandId')
      .sort({ checkedIn: 1, fullName: 1 })
      .limit(Math.min(parseInt(limit, 10) || 10, 20));
    res.json({ success: true, data: { attendees } });
  } catch (err) { next(err); }
});

// POST /api/entry/checkin - explicit check-in with optional wristband issuance
router.post('/checkin', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const { attendeeId, gateId, gateName, wristbandId, deviceId, method = 'manual' } = req.body;
    const io = req.app.get('io');

    if (!attendeeId) return res.status(400).json({ success: false, message: 'attendeeId required.' });

    const attendee = await Attendee.findById(attendeeId).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const resolvedGate = normalizeGate(gateName || gateId || 'Main Gate');

    // Issue wristband if requested and not already issued
    if (wristbandId && !attendee.wristbandId) {
      attendee.wristbandId = wristbandId;
      attendee.wristbandIssuedAt = new Date();
      attendee.wristbandIssuedBy = req.user._id;
    } else if (!attendee.wristbandId) {
      // Auto-generate wristband ID
      attendee.wristbandId = `WB-${Date.now()}`;
      attendee.wristbandIssuedAt = new Date();
      attendee.wristbandIssuedBy = req.user._id;
    }

    if (!attendee.checkedIn) {
      attendee.checkedIn = true;
      attendee.checkedInAt = new Date();
    }
    await attendee.save();

    const logEntry = await EntryLog.create(buildLogPayload({
      attendee,
      gateId: resolvedGate,
      gateName: resolvedGate,
      zoneId: null,
      zoneName: null,
      action: 'check_in',
      method,
      deviceId,
      accessGranted: true,
      denialReason: null,
      processedBy: req.user._id,
    }));

    emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
      source: 'entry',
      eventId: attendee.event._id,
      name: attendee.fullName,
      action: 'CHECK-IN',
      zoneName: resolvedGate,
      timestamp: logEntry.timestamp,
      accessGranted: true,
    });

    res.json({
      success: true,
      message: 'Checked in and wristband issued.',
      data: {
        wristbandId: attendee.wristbandId,
        wristbandIssuedAt: attendee.wristbandIssuedAt,
        checkedInAt: attendee.checkedInAt,
        log: logEntry,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/entry/checkout - explicit manual checkout
router.post('/checkout', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const { attendeeId, gateId, gateName, deviceId, method = 'manual' } = req.body;
    const io = req.app.get('io');

    if (!attendeeId) return res.status(400).json({ success: false, message: 'attendeeId required.' });

    const attendee = await Attendee.findById(attendeeId).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const resolvedGate = normalizeGate(gateName || gateId || 'Main Gate');
    if (!userHasGateAccess(req.user, resolvedGate)) {
      return res.status(403).json({ success: false, message: `You are not assigned to ${resolvedGate}.` });
    }

    if (!attendee.checkedIn) {
      return res.status(409).json({ success: false, message: 'Attendee is not currently checked in.' });
    }

    attendee.checkedIn = false;
    await attendee.save();

    const logEntry = await EntryLog.create(buildLogPayload({
      attendee,
      gateId: resolvedGate,
      gateName: resolvedGate,
      zoneId: null,
      zoneName: null,
      action: 'check_out',
      method,
      deviceId,
      accessGranted: true,
      denialReason: null,
      processedBy: req.user._id,
    }));

    emitDashboardEvent(io, 'entry_update', attendee.event._id.toString(), {
      source: 'entry',
      eventId: attendee.event._id,
      name: attendee.fullName,
      action: 'CHECK-OUT',
      zoneName: resolvedGate,
      timestamp: logEntry.timestamp,
      accessGranted: true,
    });

    res.json({
      success: true,
      message: 'Checked out successfully.',
      data: {
        checkedIn: attendee.checkedIn,
        log: logEntry,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
