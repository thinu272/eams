const express = require('express');
const router = express.Router();
const EntryLog = require('../models/EntryLog');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const { protect, restrictTo } = require('../middleware/auth');

// POST /api/entry/scan - scan QR or RFID at entry point
router.post('/scan', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'), async (req, res, next) => {
  try {
    const { qrToken, rfidId, gateId, gateName, zoneId, zoneName, action = 'check_in', method = 'qr' } = req.body;

    // Find attendee by QR token or RFID wristband
    let attendee;
    if (qrToken) {
      attendee = await Attendee.findOne({ qrToken }).populate('event');
    } else if (rfidId) {
      attendee = await Attendee.findOne({ wristbandId: rfidId }).populate('event');
    }

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found. Invalid QR or RFID.' });
    }

    if (!attendee.isActive) {
      return res.status(403).json({ success: false, message: 'Attendee is deactivated.' });
    }

    // Check confirmation status
    if (attendee.confirmationStatus !== 'confirmed') {
      const log = await EntryLog.create({
        event: attendee.event._id,
        attendee: attendee._id,
        gateId, gateName, zoneId, zoneName,
        action: 'denied', method,
        accessGranted: false,
        denialReason: 'Identity not confirmed',
        processedBy: req.user._id,
        snapshot: {
          fullName: attendee.fullName,
          categoryId: attendee.categoryId,
          categoryName: attendee.categoryName,
          allowedZones: attendee.allowedZones,
          photoVerified: attendee.photoVerificationStatus === 'verified',
        },
      });
      return res.status(403).json({ success: false, message: 'Identity not confirmed.', data: { log, attendee } });
    }

    // Zone access check
    let accessGranted = true;
    let denialReason = null;
    if (zoneId && action !== 'check_in') {
      if (!attendee.allowedZones.includes(zoneId)) {
        accessGranted = false;
        denialReason = `No access to zone: ${zoneName || zoneId}`;
      }
    }

    // If check_in and no wristband yet, issue wristband reference
    if (action === 'check_in' && accessGranted && !attendee.wristbandId) {
      attendee.wristbandId = req.body.wristbandId || `WB-${Date.now()}`;
      attendee.wristbandIssuedAt = new Date();
      attendee.wristbandIssuedBy = req.user._id;
      await attendee.save();
    }

    // Log the event
    const logEntry = await EntryLog.create({
      event: attendee.event._id,
      attendee: attendee._id,
      gateId, gateName, zoneId, zoneName,
      action: accessGranted ? action : 'denied',
      method,
      accessGranted,
      denialReason,
      processedBy: req.user._id,
      snapshot: {
        fullName: attendee.fullName,
        categoryId: attendee.categoryId,
        categoryName: attendee.categoryName,
        allowedZones: attendee.allowedZones,
        photoVerified: attendee.photoVerificationStatus === 'verified',
      },
    });

    res.json({
      success: true,
      data: {
        accessGranted,
        denialReason,
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
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

    const filter = { event: eventId };
    if (gateId) filter.gateId = gateId;
    if (zoneId) filter.zoneId = zoneId;
    if (action) filter.action = action;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      EntryLog.find(filter)
        .populate('attendee', 'fullName photo categoryName')
        .populate('processedBy', 'name')
        .sort('-timestamp')
        .skip(skip)
        .limit(parseInt(limit)),
      EntryLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { logs, total } });
  } catch (err) { next(err); }
});

// GET /api/entry/stats - live stats for event
router.get('/stats', protect, async (req, res, next) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });

    const [checkedIn, byZone, byCategory, denied] = await Promise.all([
      EntryLog.countDocuments({ event: eventId, action: 'check_in', accessGranted: true }),
      EntryLog.aggregate([
        { $match: { event: new (require('mongoose').Types.ObjectId)(eventId), action: 'zone_entry', accessGranted: true } },
        { $group: { _id: '$zoneId', zoneName: { $first: '$zoneName' }, count: { $sum: 1 } } },
      ]),
      EntryLog.aggregate([
        { $match: { event: new (require('mongoose').Types.ObjectId)(eventId), action: 'check_in', accessGranted: true } },
        { $group: { _id: '$snapshot.categoryId', categoryName: { $first: '$snapshot.categoryName' }, count: { $sum: 1 } } },
      ]),
      EntryLog.countDocuments({ event: eventId, action: 'denied' }),
    ]);

    res.json({ success: true, data: { checkedIn, byZone, byCategory, denied } });
  } catch (err) { next(err); }
});

// GET /api/entry/attendee/:qrToken - look up attendee by QR (entry screen)
router.get('/attendee/:qrToken', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ qrToken: req.params.qrToken })
      .populate('event', 'name venue startDate zones categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

module.exports = router;
