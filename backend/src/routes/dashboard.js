const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Attendee = require('../models/Attendee');
const EntryLog = require('../models/EntryLog');
const ZoneLog = require('../models/ZoneLog');

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const getAccessibleEventIds = async (user, requestedEventId) => {
  if (user.role === 'main_admin') {
    if (requestedEventId) {
      const exists = await Event.exists({ _id: requestedEventId });
      return exists ? [requestedEventId] : [];
    }

    const events = await Event.find({}, '_id').lean();
    return events.map((event) => event._id.toString());
  }

  const assigned = (user.assignedEvents || []).map((eventId) => eventId.toString());
  if (requestedEventId) {
    return assigned.includes(requestedEventId) ? [requestedEventId] : [];
  }

  return assigned;
};

const buildEventMatch = (eventIds) => {
  const objectIds = eventIds.map((eventId) => toObjectId(eventId));
  return objectIds.length === 1 ? objectIds[0] : { $in: objectIds };
};

router.use(protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser'));

router.get('/stats', async (req, res, next) => {
  try {
    const { eventId, zone } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);

    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'You do not have access to the requested event.' });
    }

    const eventMatch = buildEventMatch(accessibleEventIds);
    const zoneFilter = zone ? { zoneName: zone } : {};

    const [totalTickets, confirmedAttendees, checkedInCount, deniedEntryLogs, deniedZoneLogs, entryTrend, zoneEntryCounts, zoneExitCounts] = await Promise.all([
      Ticket.countDocuments({ event: eventMatch }),
      Attendee.countDocuments({ event: eventMatch, isConfirmed: true }),
      EntryLog.countDocuments({ event: eventMatch, action: 'check_in', accessGranted: true }),
      EntryLog.countDocuments({ event: eventMatch, action: 'denied' }),
      ZoneLog.countDocuments({ eventId: eventMatch, accessGranted: false, ...zoneFilter }),
      EntryLog.aggregate([
        { $match: { event: eventMatch, action: 'check_in', accessGranted: true } },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' },
              hour: { $hour: '$timestamp' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
        {
          $project: {
            _id: 0,
            label: {
              $concat: [
                { $toString: '$_id.year' }, '-',
                { $toString: '$_id.month' }, '-',
                { $toString: '$_id.day' }, ' ',
                { $toString: '$_id.hour' }, ':00',
              ],
            },
            count: 1,
          },
        },
      ]),
      ZoneLog.aggregate([
        { $match: { eventId: eventMatch, accessGranted: true, action: 'ENTRY', ...zoneFilter } },
        { $group: { _id: '$zoneName', entries: { $sum: 1 } } },
      ]),
      ZoneLog.aggregate([
        { $match: { eventId: eventMatch, accessGranted: true, action: 'EXIT', ...zoneFilter } },
        { $group: { _id: '$zoneName', exits: { $sum: 1 } } },
      ]),
    ]);

    const exitLookup = new Map(zoneExitCounts.map((item) => [item._id, item.exits]));
    const zoneOccupancy = zoneEntryCounts.map((item) => ({
      zoneName: item._id,
      occupancy: Math.max(item.entries - (exitLookup.get(item._id) || 0), 0),
      entries: item.entries,
      exits: exitLookup.get(item._id) || 0,
    }));

    res.json({
      success: true,
      data: {
        totalTickets,
        confirmedAttendees,
        checkedInCount,
        deniedCount: deniedEntryLogs + deniedZoneLogs,
        entryTrend,
        zoneOccupancy,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const { eventId, zone, limit = 20 } = req.query;
    const accessibleEventIds = await getAccessibleEventIds(req.user, eventId);

    if (!accessibleEventIds.length) {
      return res.status(403).json({ success: false, message: 'You do not have access to the requested event.' });
    }

    const eventObjectIds = accessibleEventIds.map((id) => toObjectId(id));
    const entryMatch = {
      event: eventObjectIds.length === 1 ? eventObjectIds[0] : { $in: eventObjectIds },
    };
    const zoneMatch = {
      eventId: eventObjectIds.length === 1 ? eventObjectIds[0] : { $in: eventObjectIds },
    };

    if (zone) {
      entryMatch.$or = [{ zoneName: zone }, { gateName: zone }, { zoneId: zone }];
      zoneMatch.zoneName = zone;
    }

    const activity = await EntryLog.aggregate([
      { $match: entryMatch },
      {
        $lookup: {
          from: 'attendees',
          localField: 'attendee',
          foreignField: '_id',
          as: 'attendeeDoc',
        },
      },
      {
        $project: {
          _id: 1,
          source: { $literal: 'entry' },
          eventId: '$event',
          name: {
            $ifNull: [
              { $arrayElemAt: ['$attendeeDoc.fullName', 0] },
              '$snapshot.fullName',
            ],
          },
          action: {
            $switch: {
              branches: [
                { case: { $eq: ['$action', 'check_in'] }, then: 'CHECK-IN' },
                { case: { $eq: ['$action', 'check_out'] }, then: 'CHECK-OUT' },
                { case: { $eq: ['$action', 'zone_entry'] }, then: 'ZONE ENTRY' },
                { case: { $eq: ['$action', 'zone_exit'] }, then: 'ZONE EXIT' },
                { case: { $eq: ['$action', 'denied'] }, then: 'DENIED ENTRY' },
              ],
              default: { $toUpper: '$action' },
            },
          },
          zoneName: { $ifNull: ['$zoneName', '$gateName'] },
          timestamp: '$timestamp',
          accessGranted: '$accessGranted',
        },
      },
      {
        $unionWith: {
          coll: 'zonelogs',
          pipeline: [
            { $match: zoneMatch },
            {
              $lookup: {
                from: 'attendees',
                localField: 'attendeeId',
                foreignField: '_id',
                as: 'attendeeDoc',
              },
            },
            {
              $project: {
                _id: 1,
                source: { $literal: 'zone' },
                eventId: '$eventId',
                name: {
                  $ifNull: [
                    { $arrayElemAt: ['$attendeeDoc.fullName', 0] },
                    '$attendeeSnapshot.fullName',
                  ],
                },
                action: {
                  $cond: [
                    { $eq: ['$accessGranted', false] },
                    'ZONE DENIED',
                    {
                      $cond: [{ $eq: ['$action', 'ENTRY'] }, 'ZONE ENTRY', 'ZONE EXIT'],
                    },
                  ],
                },
                zoneName: '$zoneName',
                timestamp: '$timestamp',
                accessGranted: '$accessGranted',
              },
            },
          ],
        },
      },
      { $sort: { timestamp: -1 } },
      { $limit: Math.min(parseInt(limit, 10) || 20, 100) },
    ]);

    res.json({ success: true, data: { logs: activity } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
