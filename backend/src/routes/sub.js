const express = require('express');
const mongoose = require('mongoose');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const { protect, restrictTo } = require('../middleware/auth');
const { normalizeRole, ROLES } = require('../utils/rbac');
const { notifyPhotoRejectionNotification, notifyStatusChange } = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const router = express.Router();

const SUB_ALLOWED_ROLES = [ROLES.SUB_ORGANISER, ROLES.MAIN_ORGANISER, ROLES.MAIN_ADMIN, ROLES.STAFF];
const ENTRY_LIKE_ZONE = /entry|gate/i;

const parseToken = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch (error) {
    return raw;
  }
};

const hasScanPermission = (user) => {
  const role = normalizeRole(user?.role);
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return true;

  return !!(
    user?.permissions?.canEntryAccess ||
    user?.permissions?.canScanEntry ||
    user?.responsibilities?.entryAccess
  );
};

const hasVerificationPermission = (user) => {
  const role = normalizeRole(user?.role);
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return true;

  return !!(
    user?.permissions?.canVerifyPhotos ||
    user?.responsibilities?.verificationAccess
  );
};

const getAssignedZoneIds = (user, event) => {
  const role = normalizeRole(user?.role);
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) {
    return (event?.zones || []).map((zone) => zone.id || zone.name).filter(Boolean);
  }

  const fromResponsibilities = (user?.responsibilities?.zoneIds || []).map(String);
  const fromEventAssignment = (event?.zones || [])
    .filter((zone) => zone.assignedSubOrganiser && zone.assignedSubOrganiser.toString() === user._id.toString())
    .map((zone) => zone.id || zone.name)
    .filter(Boolean);

  return Array.from(new Set([...fromResponsibilities, ...fromEventAssignment]));
};

const getPermittedCategories = (user, event) => {
  const role = normalizeRole(user?.role);
  const categories = event?.categories || [];
  
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) {
    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      price: cat.price,
      capacity: cat.capacity,
      sold: cat.sold,
      allowedZones: cat.allowedZones || [],
      isPrivate: !!cat.isPrivate,
      accessCode: cat.accessCode || '',
      usageCount: cat.usageCount || 0,
      maxUsage: cat.maxUsage || null,
      assignedSubOrganisers: cat.assignedSubOrganisers || [],
    }));
  }

  const myZones = getAssignedZoneIds(user, event).map(String);
  const userId = user._id.toString();
  
  return categories
    .filter((cat) => {
      // 1. Explicitly assigned to this sub-organiser
      const isAssigned = (cat.assignedSubOrganisers || []).some(id => id.toString() === userId);
      if (isAssigned) return true;

      // 2. Created by this sub-organiser
      if (cat.createdBy && cat.createdBy.toString() === userId) return true;

      // 3. Zone overlap (Legacy/Fallback)
      const catZones = (cat.allowedZones || []).map(String);
      return catZones.length === 0 || catZones.some(z => myZones.includes(z));
    })
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      price: cat.price,
      capacity: cat.capacity,
      sold: cat.sold,
      allowedZones: cat.allowedZones || [],
      isPrivate: !!cat.isPrivate,
      accessCode: cat.accessCode || '',
      usageCount: cat.usageCount || 0,
      maxUsage: cat.maxUsage || null,
      assignedSubOrganisers: cat.assignedSubOrganisers || [],
    }));
};

const getScopedZoneObjects = (event, assignedZoneIds) => {
  const zones = event?.zones || [];
  if (!assignedZoneIds.length) return [];

  return zones.filter((zone) => {
    const zoneId = String(zone.id || '');
    const zoneName = String(zone.name || '');
    return assignedZoneIds.includes(zoneId) || assignedZoneIds.includes(zoneName);
  });
};

const getScopeZoneKeys = (event, assignedZoneIds) => {
  const scopedZones = getScopedZoneObjects(event, assignedZoneIds);
  const keys = new Set(assignedZoneIds.map(String));
  scopedZones.forEach((zone) => {
    if (zone.id) keys.add(String(zone.id));
    if (zone.name) keys.add(String(zone.name));
  });
  return Array.from(keys).filter(Boolean);
};

const resolveScopedEvent = async (user, explicitEventId) => {
  const role = normalizeRole(user?.role);
  let eventId = explicitEventId;

  if (!eventId) {
    eventId = user?.assignedEvents?.[0];
  }

  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
    return { error: 'No assigned event available for this account.' };
  }

  const event = await Event.findById(eventId);
  if (!event) {
    return { error: 'Assigned event not found.' };
  }

  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) {
    return { event };
  }

  const assignedEventIds = (user?.assignedEvents || []).map((item) => item.toString());
  if (!assignedEventIds.includes(event._id.toString())) {
    return { error: 'Requested event is outside your assignment.' };
  }

  return { event };
};

const buildScopedAttendeeFilter = (eventId, scopeZoneKeys) => {
  const filter = { event: eventId, isActive: true };

  if (scopeZoneKeys && scopeZoneKeys.length > 0) {
    filter.$or = [
      { allowedZones: { $in: scopeZoneKeys } },
      { allowedZones: { $size: 0 } },
      { allowedZones: { $exists: false } }
    ];
  }

  return filter;
};

const resolveActiveZone = (event, assignedZoneIds, requestedZone) => {
  const scopedZones = getScopedZoneObjects(event, assignedZoneIds);
  const zoneLookup = String(requestedZone || '').trim();

  const matched = scopedZones.find((zone) => zone.id === zoneLookup || zone.name === zoneLookup) || scopedZones[0];
  if (!matched) return null;

  return {
    id: matched.id || matched.name,
    name: matched.name || matched.id,
  };
};

const isAttendeeAllowedInZone = (attendee, zone) => {
  const allowedZones = attendee?.allowedZones || [];
  return allowedZones.includes(zone.id) || allowedZones.includes(zone.name);
};

const mapActivity = (entryLogs, zoneLogs) => {
  return [...entryLogs, ...zoneLogs]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20)
    .map((item) => {
      if (item.kind === 'entry') {
        return {
          id: `entry-${item._id}`,
          kind: 'entry',
          timestamp: item.timestamp,
          zoneName: item.zoneName || item.gateName || item.gateId || 'Entry',
          actorName: item.processedBy?.name || 'System',
          attendeeName: item.attendee?.fullName || item.snapshot?.fullName || 'Unknown attendee',
          action: item.accessGranted ? 'Entry allowed' : 'Entry denied',
          status: item.accessGranted ? 'success' : 'error',
          detail: item.denialReason || item.action,
        };
      }

      return {
        id: `zone-${item._id}`,
        kind: 'zone',
        timestamp: item.timestamp,
        zoneName: item.zoneName,
        actorName: item.scannedBy?.name || 'System',
        attendeeName: item.attendeeId?.fullName || item.attendeeSnapshot?.fullName || 'Unknown attendee',
        action: item.accessGranted ? `${item.action} recorded` : 'Zone denied',
        status: item.accessGranted ? 'success' : 'error',
        detail: item.denialReason || item.scanMethod,
      };
    });
};

router.use(protect, restrictTo(...SUB_ALLOWED_ROLES));

router.get('/dashboard', async (req, res, next) => {
  try {
    const { event, error } = await resolveScopedEvent(req.user, req.query.eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const assignedZoneIds = getAssignedZoneIds(req.user, event);
    const scopedZones = getScopedZoneObjects(event, assignedZoneIds);
    const scopeZoneKeys = getScopeZoneKeys(event, assignedZoneIds);
    const attendeeFilter = buildScopedAttendeeFilter(event._id, scopeZoneKeys);

    const [totalAttendees, checkedInCount, pendingVerifications, entryLogs, zoneLogs] = await Promise.all([
      Attendee.countDocuments(attendeeFilter),
      Attendee.countDocuments({ ...attendeeFilter, checkedIn: true }),
      hasVerificationPermission(req.user)
        ? Attendee.countDocuments({ ...attendeeFilter, photoVerificationStatus: { $in: ['pending', 'Pending'] }, photo: { $exists: true, $ne: '' } })
        : Promise.resolve(0),
      EntryLog.find({ event: event._id, zoneId: { $in: scopeZoneKeys } })
        .populate('attendee', 'fullName')
        .populate('processedBy', 'name')
        .sort({ timestamp: -1 })
        .limit(5)
        .lean(),
      ZoneLog.find({ eventId: event._id, zoneName: { $in: scopeZoneKeys } })
        .populate('attendeeId', 'fullName')
        .populate('scannedBy', 'name')
        .sort({ timestamp: -1 })
        .limit(5)
        .lean(),
    ]);

    const activity = mapActivity(
      entryLogs.map((item) => ({ ...item, kind: 'entry' })),
      zoneLogs.map((item) => ({ ...item, kind: 'zone' }))
    ).slice(0, 5);

    res.json({
      success: true,
      data: {
        event: {
          _id: event._id,
          name: event.name,
          startDate: event.startDate,
          venue: event.venue,
        },
        permissions: {
          canVerifyPhotos: hasVerificationPermission(req.user),
          canScanEntry: hasScanPermission(req.user),
        },
        metrics: {
          totalAttendees,
          checkedInCount,
          pendingVerifications,
          zoneCount: scopedZones.length,
        },
        zones: scopedZones,
        categories: getPermittedCategories(req.user, event),
        activity,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/zones', async (req, res, next) => {
  try {
    const { event, error } = await resolveScopedEvent(req.user, req.query.eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const assignedZoneIds = getAssignedZoneIds(req.user, event);
    const scopedZones = getScopedZoneObjects(event, assignedZoneIds);

    const zones = await Promise.all(scopedZones.map(async (zone) => {
      const zoneKeys = [zone.id, zone.name].filter(Boolean);
      const occupancyAgg = await ZoneLog.aggregate([
        {
          $match: {
            eventId: new mongoose.Types.ObjectId(event._id),
            zoneName: { $in: zoneKeys },
            accessGranted: true,
          },
        },
        {
          $group: {
            _id: null,
            occupancy: {
              $sum: {
                $cond: [{ $eq: ['$action', 'ENTRY'] }, 1, -1],
              },
            },
          },
        },
      ]);

      const attendeeCount = await Attendee.countDocuments({
        event: event._id,
        isActive: true,
        allowedZones: { $in: zoneKeys },
      });

      const allowedCategories = (event.categories || []).filter((category) =>
        (category.allowedZones || []).some((value) => zoneKeys.includes(value))
      );

      return {
        id: zone.id || zone.name,
        name: zone.name || zone.id,
        capacity: zone.capacity || 0,
        currentOccupancy: Math.max(0, occupancyAgg[0]?.occupancy || 0),
        attendeeCount,
        allowedCategories: allowedCategories.map((category) => ({
          id: category.id,
          name: category.name,
          price: category.price,
        })),
      };
    }));

    res.json({
      success: true,
      data: {
        event: { _id: event._id, name: event.name },
        zones,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/attendees', async (req, res, next) => {
  try {
    const { event, error } = await resolveScopedEvent(req.user, req.query.eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const assignedZoneIds = getAssignedZoneIds(req.user, event);
    const scopeZoneKeys = getScopeZoneKeys(event, assignedZoneIds);
    const { search, category, status, verificationStatus, page = 1, limit = 20 } = req.query;
    const filter = buildScopedAttendeeFilter(event._id, scopeZoneKeys);

    if (category) filter.categoryId = category;
    if (status) {
      if (status === 'checked-in') filter.checkedIn = true;
      else if (status === 'not-checked-in') filter.checkedIn = false;
      else filter.confirmationStatus = status;
    }
    if (verificationStatus) filter.photoVerificationStatus = verificationStatus;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const [attendees, total] = await Promise.all([
      Attendee.find(filter)
        .sort({ checkedIn: -1, fullName: 1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),
      Attendee.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        event: { 
          _id: event._id, 
          name: event.name,
          categories: event.categories || []
        },
        attendees,
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { event, error } = await resolveScopedEvent(req.user, req.query.eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const assignedZoneIds = getAssignedZoneIds(req.user, event);
    const scopeZoneKeys = getScopeZoneKeys(event, assignedZoneIds);
    const zone = String(req.query.zone || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const zoneKeys = zone ? [zone] : scopeZoneKeys;

    const [entryLogs, zoneLogs] = await Promise.all([
      EntryLog.find({ event: event._id, zoneId: { $in: zoneKeys } })
        .populate('attendee', 'fullName')
        .populate('processedBy', 'name')
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean(),
      ZoneLog.find({ eventId: event._id, zoneName: { $in: zoneKeys } })
        .populate('attendeeId', 'fullName')
        .populate('scannedBy', 'name')
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        logs: mapActivity(
          entryLogs.map((item) => ({ ...item, kind: 'entry' })),
          zoneLogs.map((item) => ({ ...item, kind: 'zone' }))
        ).slice(0, limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify', async (req, res, next) => {
  try {
    if (!hasVerificationPermission(req.user)) {
      return res.status(403).json({ success: false, message: 'Photo verification is not enabled for your assignment.' });
    }

    const { attendeeId, status, reason } = req.body;
    if (!attendeeId || !mongoose.Types.ObjectId.isValid(attendeeId)) {
      return res.status(400).json({ success: false, message: 'Valid attendeeId is required.' });
    }

    const normalizedStatus = String(status || '').toLowerCase();
    if (!['verified', 'rejected'].includes(normalizedStatus)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event').populate('order');
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    const { event, error } = await resolveScopedEvent(req.user, attendee.event?._id || attendee.event);
    if (error) return res.status(403).json({ success: false, message: error });

    const scopeZoneKeys = getScopeZoneKeys(event, getAssignedZoneIds(req.user, event));
    if (scopeZoneKeys.length > 0) {
      const attendeeZones = attendee.allowedZones || [];
      const hasOverlap = attendeeZones.length === 0 || attendeeZones.some((zone) => scopeZoneKeys.includes(zone));
      if (!hasOverlap) {
        return res.status(403).json({ success: false, message: 'Attendee is outside your assigned zones.' });
      }
    }

    attendee.photoVerificationStatus = normalizedStatus;
    attendee.photoVerifiedBy = req.user._id;
    attendee.photoVerifiedAt = new Date();
    attendee.verifiedBy = req.user._id;
    attendee.verifiedAt = new Date();
    attendee.photoRejectionReason = normalizedStatus === 'rejected' ? (reason || 'Rejected by sub organiser') : null;
    if (normalizedStatus === 'rejected') {
      attendee.resubmitToken = attendee.resubmitToken || uuidv4();
    }
    await attendee.save();

    if (normalizedStatus === 'rejected') {
      await notifyPhotoRejectionNotification({
        attendee,
        event: attendee.event,
        reason: attendee.photoRejectionReason,
      });
    } else {
      attendee.confirmationStatus = 'confirmed';
      attendee.isConfirmed = true;
      attendee.confirmedAt = new Date();
      attendee.confirmedBy = 'sub_organiser';
      await attendee.save();

      const { notifyFinalTicket, notifyStatusChange } = require('../services/notificationService');
      const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
      const Ticket = require('../models/Ticket');

      await notifyFinalTicket({
        attendee,
        event: attendee.event,
        phone: attendee.phone,
        notificationChannel: 'both',
        force: true
      }).catch((err) => console.error('SUB_ORG FINAL NOTIFY ERROR:', err));

      const orderTickets = await Ticket.find({ order: attendee.order }).populate('attendee');
      const allVerified = orderTickets.length > 0 && orderTickets.every(t => t.attendee && t.attendee.photoVerificationStatus === 'verified');

      if (allVerified) {
         await processOrderFinalConfirmation({ orderId: attendee.order });
      } else {
        await notifyStatusChange({
          attendee,
          event: attendee.event,
          status: 'Photo Verified',
          message: 'Your photo has been verified. Waiting for other attendees in your order to be verified before tickets are issued.',
        });
      }
    }

    res.json({ success: true, data: { attendee }, message: `Photo ${normalizedStatus}.` });
  } catch (error) {
    next(error);
  }
});

router.post('/scan-entry', async (req, res, next) => {
  try {
    if (!hasScanPermission(req.user)) {
      return res.status(403).json({ success: false, message: 'Entry scanning is not enabled for your assignment.' });
    }

    const { event, error } = await resolveScopedEvent(req.user, req.body.eventId || req.query.eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const assignedZoneIds = getAssignedZoneIds(req.user, event);
    const activeZone = resolveActiveZone(event, assignedZoneIds, req.body.zoneId || req.body.zoneName || req.body.zone);
    if (!activeZone) {
      return res.status(400).json({ success: false, message: 'No assigned entry zone available for this account.' });
    }

    const qrToken = parseToken(req.body.qrToken);
    const rfidId = String(req.body.rfidId || '').trim();
    if (!qrToken && !rfidId) {
      return res.status(400).json({ success: false, message: 'qrToken or rfidId is required.' });
    }

    const attendee = await Attendee.findOne(qrToken ? { qrToken } : { wristbandId: rfidId }).populate('event');
    if (!attendee || attendee.event?._id?.toString() !== event._id.toString()) {
      return res.status(404).json({ success: false, message: 'Attendee not found in your assigned event.' });
    }

    let accessGranted = true;
    let denialReason = '';

    if (!attendee.isActive) {
      accessGranted = false;
      denialReason = 'Attendee is inactive';
    } else if (!attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      accessGranted = false;
      denialReason = 'Attendee is not confirmed';
    } else if (!ENTRY_LIKE_ZONE.test(activeZone.name) && !isAttendeeAllowedInZone(attendee, activeZone)) {
      accessGranted = false;
      denialReason = 'Ticket is not allowed in this zone';
    } else if (attendee.checkedIn) {
      accessGranted = false;
      denialReason = 'Attendee already checked in';
    }

    if (accessGranted) {
      attendee.checkedIn = true;
      attendee.checkedInAt = new Date();
      await attendee.save();
    }

    const log = await EntryLog.create({
      event: event._id,
      attendee: attendee._id,
      gateId: activeZone.id,
      gateName: activeZone.name,
      zoneId: activeZone.id,
      zoneName: activeZone.name,
      action: accessGranted ? 'check_in' : 'denied',
      method: rfidId ? 'rfid' : 'qr',
      accessGranted,
      denialReason: denialReason || undefined,
      processedBy: req.user._id,
      snapshot: {
        fullName: attendee.fullName,
        categoryId: attendee.categoryId,
        categoryName: attendee.categoryName,
        allowedZones: attendee.allowedZones || [],
        photoVerified: attendee.photoVerificationStatus === 'verified',
      },
      timestamp: new Date(),
    });

    res.status(accessGranted ? 200 : 403).json({
      success: accessGranted,
      message: accessGranted ? 'Entry allowed' : 'Entry denied',
      data: {
        accessGranted,
        denialReason,
        zone: activeZone,
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          categoryName: attendee.categoryName,
          confirmationStatus: attendee.confirmationStatus,
          checkedIn: attendee.checkedIn,
          allowedZones: attendee.allowedZones || [],
          photo: attendee.photo,
        },
        log,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/scan-zone', async (req, res, next) => {
  try {
    if (!hasScanPermission(req.user)) {
      return res.status(403).json({ success: false, message: 'Zone scanning is not enabled for your assignment.' });
    }

    const { event, error } = await resolveScopedEvent(req.user, req.body.eventId || req.query.eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const assignedZoneIds = getAssignedZoneIds(req.user, event);
    const activeZone = resolveActiveZone(event, assignedZoneIds, req.body.zoneId || req.body.zoneName || req.body.zone);
    if (!activeZone) {
      return res.status(400).json({ success: false, message: 'No assigned zone available for this account.' });
    }

    const qrToken = parseToken(req.body.qrToken);
    const rfidId = String(req.body.rfidId || '').trim();
    if (!qrToken && !rfidId) {
      return res.status(400).json({ success: false, message: 'qrToken or rfidId is required.' });
    }

    const attendee = await Attendee.findOne(qrToken ? { qrToken } : { wristbandId: rfidId }).populate('event');
    if (!attendee || attendee.event?._id?.toString() !== event._id.toString()) {
      return res.status(404).json({ success: false, message: 'Attendee not found in your assigned event.' });
    }

    let accessGranted = true;
    let denialReason = '';

    if (!attendee.isActive || !attendee.isConfirmed || attendee.confirmationStatus !== 'confirmed') {
      accessGranted = false;
      denialReason = 'Ticket is not confirmed for venue access';
    } else if (!isAttendeeAllowedInZone(attendee, activeZone)) {
      accessGranted = false;
      denialReason = 'Zone not included in ticket';
    }

    let action = 'ENTRY';
    if (accessGranted) {
      const lastLog = await ZoneLog.findOne({
        attendeeId: attendee._id,
        eventId: event._id,
        zoneName: activeZone.name,
        accessGranted: true,
      }).sort({ timestamp: -1 });
      action = lastLog?.action === 'ENTRY' ? 'EXIT' : 'ENTRY';
    }

    const log = await ZoneLog.create({
      attendeeId: attendee._id,
      eventId: event._id,
      zoneName: activeZone.name,
      action,
      accessGranted,
      denialReason: accessGranted ? undefined : 'NOT_ALLOWED',
      scanMethod: rfidId ? 'RFID' : 'QR',
      scannedBy: req.user._id,
      attendeeSnapshot: {
        fullName: attendee.fullName,
        categoryName: attendee.categoryName,
        allowedZones: attendee.allowedZones || [],
      },
      timestamp: new Date(),
    });

    res.status(accessGranted ? 200 : 403).json({
      success: accessGranted,
      message: accessGranted ? 'Zone access allowed' : 'Zone access denied',
      data: {
        accessGranted,
        denialReason,
        action,
        zone: activeZone,
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          categoryName: attendee.categoryName,
          confirmationStatus: attendee.confirmationStatus,
          allowedZones: attendee.allowedZones || [],
          photo: attendee.photo,
        },
        log,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/tickets', async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) === ROLES.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff are not authorized to create tickets.' });
    }
    const { 
      eventId, 
      name, 
      price, 
      capacity, 
      allowedZones, 
      isPrivate, 
      maxUsage,
      description,
      assignedSubOrganisers
    } = req.body;

    const { event, error } = await resolveScopedEvent(req.user, eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    // Validate Zones: Sub-organiser can only assign to their assigned zones
    const assignedZoneIds = getAssignedZoneIds(req.user, event).map(String);
    const requestedZones = (allowedZones || []).map(String);
    
    if (requestedZones.length === 0) {
      return res.status(400).json({ success: false, message: 'Ticket must be assigned to at least one zone.' });
    }

    const unauthorizedZones = requestedZones.filter(id => !assignedZoneIds.includes(id));
    if (unauthorizedZones.length > 0) {
      return res.status(403).json({ 
        success: false, 
        message: `You are not authorized to create tickets for zones: ${unauthorizedZones.join(', ')}` 
      });
    }

    let accessCode = null;
    let accessCodeHash = null;

    if (isPrivate) {
      // Generate a code: PREFIX-RANDOM
      const prefix = name.substring(0, 3).toUpperCase();
      const random = crypto.randomBytes(3).toString('hex').toUpperCase();
      accessCode = `${prefix}-${random}`;
      accessCodeHash = await bcrypt.hash(accessCode, 10);
    }

    const newCategory = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now(),
      name,
      price: Number(price),
      capacity: Number(capacity),
      allowedZones: requestedZones,
      description: description || '',
      isPrivate: !!isPrivate,
      accessCode,
      accessCodeHash,
      maxUsage: maxUsage ? Number(maxUsage) : undefined,
      createdBy: req.user._id,
      assignedSubOrganisers: Array.isArray(assignedSubOrganisers) ? assignedSubOrganisers : [],
      usageCount: 0
    };

    event.categories.push(newCategory);
    event.markModified('categories');
    await event.save();

    res.status(201).json({
      success: true,
      message: 'Ticket category created successfully.',
      data: {
        category: {
          id: newCategory.id,
          name: newCategory.name,
          isPrivate: newCategory.isPrivate,
          accessCode: accessCode // Returned ONLY once
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/tickets/:categoryId/regenerate', async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) === ROLES.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff are not authorized to modify tickets.' });
    }
    const { eventId } = req.body;
    const { categoryId } = req.params;

    // Use existing validation helper
    const { event, error } = await resolveScopedEvent(req.user, eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const category = event.categories.find(c => c.id === categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Ticket category not found.' });

    // Permissions check: Allow if they created it OR have access to the zones it serves
    if (String(category.createdBy) !== String(req.user._id) && req.user.role !== 'main_admin') {
       const assignedZoneIds = getAssignedZoneIds(req.user, event).map(String);
       const ticketZones = (category.allowedZones || []).map(String);
       const hasZoneAccess = ticketZones.some(zId => assignedZoneIds.includes(zId));
       
       if (!hasZoneAccess) {
         return res.status(403).json({ success: false, message: 'You do not have permission to modify this ticket category.' });
       }
    }

    if (!category.isPrivate) {
      return res.status(400).json({ success: false, message: 'Only private tickets have access codes.' });
    }

    // Generate NEW code
    const prefix = category.name.substring(0, 3).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    const newAccessCode = `${prefix}-${random}`;
    category.accessCode = newAccessCode;
    category.accessCodeHash = await bcrypt.hash(newAccessCode, 10);

    event.markModified('categories');
    await event.save();

    res.status(200).json({
      success: true,
      message: 'Access code regenerated successfully.',
      data: {
        accessCode: newAccessCode
      }
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/tickets/:categoryId', async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) === ROLES.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff are not authorized to modify tickets.' });
    }
    const { eventId, name, price, capacity, allowedZones, description, isPrivate, maxUsage, assignedSubOrganisers } = req.body;
    const { categoryId } = req.params;

    const { event, error } = await resolveScopedEvent(req.user, eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const index = event.categories.findIndex(c => c.id === categoryId);
    if (index === -1) return res.status(404).json({ success: false, message: 'Category not found.' });

    const cat = event.categories[index];
    const userId = req.user._id.toString();
    const isOwner = cat.createdBy && cat.createdBy.toString() === userId;
    const isAssigned = (cat.assignedSubOrganisers || []).some(id => id.toString() === userId);

    if (!isOwner && !isAssigned) {
      return res.status(403).json({ success: false, message: 'You are not authorized to modify this category.' });
    }

    if (name) cat.name = name;
    if (price !== undefined) cat.price = Number(price);
    if (capacity !== undefined) cat.capacity = Number(capacity);
    if (description !== undefined) cat.description = description;
    if (maxUsage !== undefined) cat.maxUsage = maxUsage ? Number(maxUsage) : undefined;
    if (assignedSubOrganisers !== undefined) cat.assignedSubOrganisers = Array.isArray(assignedSubOrganisers) ? assignedSubOrganisers : [];
    
    if (allowedZones) {
      const assignedZoneIds = getAssignedZoneIds(req.user, event).map(String);
      const requestedZones = (allowedZones || []).map(String);
      const unauthorizedZones = requestedZones.filter(id => !assignedZoneIds.includes(id));
      if (unauthorizedZones.length > 0) {
        return res.status(403).json({ success: false, message: `Unauthorized zones: ${unauthorizedZones.join(', ')}` });
      }
      cat.allowedZones = requestedZones;
    }

    if (isPrivate !== undefined && isPrivate !== cat.isPrivate) {
      cat.isPrivate = !!isPrivate;
      if (cat.isPrivate && !cat.accessCode) {
        const prefix = cat.name.substring(0, 3).toUpperCase();
        const random = crypto.randomBytes(3).toString('hex').toUpperCase();
        cat.accessCode = `${prefix}-${random}`;
        cat.accessCodeHash = await bcrypt.hash(cat.accessCode, 10);
      }
    }

    event.markModified('categories');
    await event.save();

    res.json({ success: true, message: 'Ticket category updated.', data: { category: cat } });
  } catch (error) {
    next(error);
  }
});

router.delete('/tickets/:categoryId', async (req, res, next) => {
  try {
    if (normalizeRole(req.user.role) === ROLES.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff are not authorized to delete tickets.' });
    }
    const { eventId } = req.query;
    const { categoryId } = req.params;

    const { event, error } = await resolveScopedEvent(req.user, eventId);
    if (error) return res.status(400).json({ success: false, message: error });

    const index = event.categories.findIndex(c => c.id === categoryId);
    if (index === -1) return res.status(404).json({ success: false, message: 'Category not found.' });

    const cat = event.categories[index];
    const userId = req.user._id.toString();
    const isOwner = cat.createdBy && cat.createdBy.toString() === userId;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only the creator can delete this category.' });
    }

    if (cat.sold > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete category with existing sales.' });
    }

    event.categories.splice(index, 1);
    event.markModified('categories');
    await event.save();

    res.json({ success: true, message: 'Ticket category deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
