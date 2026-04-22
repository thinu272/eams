const express = require('express');
const mongoose = require('mongoose');
const Attendee = require('../models/Attendee');
const EntryLog = require('../models/EntryLog');
const Event = require('../models/Event');
const ZoneLog = require('../models/ZoneLog');
const { protect, restrictTo } = require('../middleware/auth');
const { normalizeRole, ROLES } = require('../utils/rbac');

const router = express.Router();

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const userHasEventAccess = async (user, eventId) => {
  if (!user || !eventId) return false;
  if (normalizeRole(user.role) === ROLES.MAIN_ADMIN) return true;

  const assigned = (user.assignedEvents || []).map((item) => item.toString());
  if (assigned.includes(eventId.toString())) return true;

  const event = await Event.findById(eventId).select('createdBy mainOrganiser auditors');
  if (!event) return false;

  return (
    event.createdBy?.toString() === user._id.toString() ||
    event.mainOrganiser?.toString() === user._id.toString() ||
    (event.auditors || []).some((auditor) => auditor.toString() === user._id.toString())
  );
};

const parseDateRange = (from, to) => {
  const range = {};
  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) range.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      toDate.setHours(23, 59, 59, 999);
      range.$lte = toDate;
    }
  }
  return Object.keys(range).length ? range : null;
};

const resolveCategory = (event, categoryValue) => {
  if (!categoryValue) return null;
  const normalized = categoryValue.trim();
  const category = (event.categories || []).find(
    (item) => item.id === normalized || item.name === normalized
  );
  return {
    id: category?.id || normalized,
    name: category?.name || normalized,
  };
};

const resolveZone = (event, zoneValue) => {
  if (!zoneValue) return null;
  const normalized = zoneValue.trim();
  const zone = (event.zones || []).find(
    (item) => item.id === normalized || item.name === normalized
  );
  return {
    id: zone?.id || normalized,
    name: zone?.name || normalized,
  };
};

const buildCsv = (rows) =>
  rows
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

router.use(protect, restrictTo('auditor', 'main_admin', 'main_organiser'));

// GET /api/audit/logs
router.get('/logs', async (req, res, next) => {
  try {
    const {
      eventId,
      type = 'entry',
      from,
      to,
      zone,
      categoryId,
      page = 1,
      limit = 25,
    } = req.query;

    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const event = await Event.findById(eventId).select('categories zones');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = resolveCategory(event, categoryId);
    const zoneFilter = resolveZone(event, zone);
    const timeRange = parseDateRange(from, to);
    const safeLimit = Math.min(parseInt(limit, 10) || 25, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * safeLimit;

    if (type === 'zone') {
      const filter = { eventId };
      if (timeRange) filter.timestamp = timeRange;
      if (zoneFilter) filter.zoneName = zoneFilter.name;
      if (category) {
        filter['attendeeSnapshot.categoryName'] = category.name;
      }

      const [logs, total] = await Promise.all([
        ZoneLog.find(filter)
          .populate('attendeeId', 'fullName phone')
          .populate('scannedBy', 'name role')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(safeLimit),
        ZoneLog.countDocuments(filter),
      ]);

      return res.json({ success: true, data: { logs, total, page: Math.floor(skip / safeLimit) + 1, pages: Math.ceil(total / safeLimit), type: 'zone' } });
    }

    const filter = { event: eventId };
    if (timeRange) filter.timestamp = timeRange;
    if (zoneFilter) {
      filter.$or = [{ zoneId: zoneFilter.id }, { zoneName: zoneFilter.name }];
    }
    if (category) {
      filter['snapshot.categoryId'] = category.id;
    }

    const [logs, total] = await Promise.all([
      EntryLog.find(filter)
        .populate('attendee', 'fullName phone')
        .populate('processedBy', 'name role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(safeLimit),
      EntryLog.countDocuments(filter),
    ]);

    res.json({ success: true, data: { logs, total, page: Math.floor(skip / safeLimit) + 1, pages: Math.ceil(total / safeLimit), type: 'entry' } });
  } catch (err) {
    next(err);
  }
});

// GET /api/audit/reports
router.get('/reports', async (req, res, next) => {
  try {
    const { eventId, from, to, zone, categoryId } = req.query;

    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const event = await Event.findById(eventId).select('name categories zones');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = resolveCategory(event, categoryId);
    const zoneFilter = resolveZone(event, zone);
    const timeRange = parseDateRange(from, to);
    const eventObjectId = toObjectId(eventId);

    const attendeeMatch = { event: eventObjectId, isActive: true };
    if (category) {
      attendeeMatch.categoryId = category.id;
    }

    const entryMatch = { event: eventObjectId };
    if (timeRange) entryMatch.timestamp = timeRange;
    if (category) entryMatch['snapshot.categoryId'] = category.id;
    if (zoneFilter) {
      entryMatch.$or = [{ zoneId: zoneFilter.id }, { zoneName: zoneFilter.name }];
    }

    const zoneMatch = { eventId: eventObjectId };
    if (timeRange) zoneMatch.timestamp = timeRange;
    if (category) zoneMatch['attendeeSnapshot.categoryName'] = category.name;
    if (zoneFilter) zoneMatch.zoneName = zoneFilter.name;

    const [
      totalAttendees,
      confirmedAttendees,
      checkedInCount,
      deniedEntries,
      attendanceReport,
      zoneMovementReport,
    ] = await Promise.all([
      Attendee.countDocuments(attendeeMatch),
      Attendee.countDocuments({ ...attendeeMatch, confirmationStatus: 'confirmed', isConfirmed: true }),
      EntryLog.countDocuments({ ...entryMatch, action: 'check_in', accessGranted: true }),
      EntryLog.countDocuments({ ...entryMatch, accessGranted: false }),
      Attendee.aggregate([
        { $match: attendeeMatch },
        {
          $group: {
            _id: '$categoryName',
            totalAttendees: { $sum: 1 },
            confirmedAttendees: {
              $sum: { $cond: [{ $eq: ['$confirmationStatus', 'confirmed'] }, 1, 0] },
            },
            checkedInCount: {
              $sum: { $cond: [{ $eq: ['$checkedIn', true] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ZoneLog.aggregate([
        { $match: zoneMatch },
        {
          $group: {
            _id: { zoneName: '$zoneName', action: '$action' },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.zoneName',
            entries: {
              $sum: { $cond: [{ $eq: ['$_id.action', 'ENTRY'] }, '$count', 0] },
            },
            exits: {
              $sum: { $cond: [{ $eq: ['$_id.action', 'EXIT'] }, '$count', 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            zoneName: '$_id',
            entries: 1,
            exits: 1,
            netMovement: { $subtract: ['$entries', '$exits'] },
          },
        },
        { $sort: { zoneName: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalAttendees,
          confirmedAttendees,
          checkedInCount,
          deniedEntries,
        },
        attendanceReport,
        zoneMovementReport,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/audit/export
router.get('/export', async (req, res, next) => {
  try {
    const { eventId, report = 'entry_logs', from, to, zone, categoryId } = req.query;

    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }
    if (!(await userHasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const event = await Event.findById(eventId).select('name categories zones');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = resolveCategory(event, categoryId);
    const zoneFilter = resolveZone(event, zone);
    const timeRange = parseDateRange(from, to);
    const eventObjectId = toObjectId(eventId);
    let csv = '';
    let filename = `${report}-${eventId}.csv`;

    if (report === 'zone_logs') {
      const filter = { eventId };
      if (timeRange) filter.timestamp = timeRange;
      if (zoneFilter) filter.zoneName = zoneFilter.name;
      if (category) filter['attendeeSnapshot.categoryName'] = category.name;

      const logs = await ZoneLog.find(filter).sort({ timestamp: -1 });
      csv = buildCsv([
        ['Timestamp', 'Attendee', 'Category', 'Zone', 'Action', 'Access', 'Reason'],
        ...logs.map((log) => [
          log.timestamp?.toISOString() || '',
          log.attendeeSnapshot?.fullName || '',
          log.attendeeSnapshot?.categoryName || '',
          log.zoneName || '',
          log.action || '',
          log.accessGranted ? 'Granted' : 'Denied',
          log.denialReason || '',
        ]),
      ]);
      filename = `zone-logs-${eventId}.csv`;
    } else if (report === 'attendance') {
      const attendeeMatch = { event: eventObjectId, isActive: true };
      if (category) attendeeMatch.categoryId = category.id;

      const rows = await Attendee.aggregate([
        { $match: attendeeMatch },
        {
          $group: {
            _id: '$categoryName',
            totalAttendees: { $sum: 1 },
            confirmedAttendees: {
              $sum: { $cond: [{ $eq: ['$confirmationStatus', 'confirmed'] }, 1, 0] },
            },
            checkedInCount: {
              $sum: { $cond: [{ $eq: ['$checkedIn', true] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      csv = buildCsv([
        ['Category', 'Total Attendees', 'Confirmed Attendees', 'Checked In'],
        ...rows.map((row) => [row._id || 'Uncategorised', row.totalAttendees, row.confirmedAttendees, row.checkedInCount]),
      ]);
      filename = `attendance-report-${eventId}.csv`;
    } else if (report === 'zone_movement') {
      const zoneMatch = { eventId: eventObjectId };
      if (timeRange) zoneMatch.timestamp = timeRange;
      if (category) zoneMatch['attendeeSnapshot.categoryName'] = category.name;
      if (zoneFilter) zoneMatch.zoneName = zoneFilter.name;

      const rows = await ZoneLog.aggregate([
        { $match: zoneMatch },
        {
          $group: {
            _id: { zoneName: '$zoneName', action: '$action' },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.zoneName',
            entries: {
              $sum: { $cond: [{ $eq: ['$_id.action', 'ENTRY'] }, '$count', 0] },
            },
            exits: {
              $sum: { $cond: [{ $eq: ['$_id.action', 'EXIT'] }, '$count', 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            zoneName: '$_id',
            entries: 1,
            exits: 1,
            netMovement: { $subtract: ['$entries', '$exits'] },
          },
        },
        { $sort: { zoneName: 1 } },
      ]);
      csv = buildCsv([
        ['Zone', 'Entries', 'Exits', 'Net Movement'],
        ...rows.map((row) => [row.zoneName, row.entries, row.exits, row.netMovement]),
      ]);
      filename = `zone-movement-report-${eventId}.csv`;
    } else {
      const filter = { event: eventId };
      if (timeRange) filter.timestamp = timeRange;
      if (category) filter['snapshot.categoryId'] = category.id;
      if (zoneFilter) filter.$or = [{ zoneId: zoneFilter.id }, { zoneName: zoneFilter.name }];

      const logs = await EntryLog.find(filter).sort({ timestamp: -1 });
      csv = buildCsv([
        ['Timestamp', 'Attendee', 'Category', 'Gate', 'Zone', 'Action', 'Access', 'Reason'],
        ...logs.map((log) => [
          log.timestamp?.toISOString() || '',
          log.snapshot?.fullName || '',
          log.snapshot?.categoryName || '',
          log.gateName || log.gateId || '',
          log.zoneName || '',
          log.action || '',
          log.accessGranted ? 'Granted' : 'Denied',
          log.denialReason || '',
        ]),
      ]);
      filename = `entry-logs-${eventId}.csv`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
