const express = require('express');
const XLSX = require('xlsx');
const multer = require('multer');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Attendee = require('../models/Attendee');
const RfidTag = require('../models/RfidTag');
const { protect, restrictTo } = require('../middleware/auth');
const { normalizeRfidTag, isValidRfidTag, assignRfidToAttendee, unassignRfidFromAttendee } = require('../services/rfidService');

const router = express.Router();
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const adminRoles = ['main_admin', 'main_organiser'];
const operationalRoles = ['main_admin', 'main_organiser', 'sub_organiser', 'staff', 'volunteer'];

const canManageEvent = async (user, eventId) => {
  if (user.role === 'main_admin') return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser mainOrganisers');
  return !!event && (String(event.createdBy) === String(user._id) || String(event.mainOrganiser) === String(user._id) || (event.mainOrganisers || []).some((id) => String(id) === String(user._id)));
};

const getCategoryLimit = async (eventId, categoryId) => {
  const event = await Event.findById(eventId).select('categories');
  const category = event?.categories?.find((item) => String(item.id) === String(categoryId));
  if (!category) return null;
  return Number(category.capacity || 0);
};

const userHasEventAccess = async (user, eventId) => {
  if (user.role === 'main_admin') return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser mainOrganisers subOrganisers staff volunteers');
  if (!event) return false;
  const userId = String(user._id);
  return [event.createdBy, event.mainOrganiser, ...(event.mainOrganisers || []), ...(event.subOrganisers || []), ...(event.staff || []), ...(event.volunteers || [])]
    .filter(Boolean)
    .some((id) => String(id) === userId)
    || (user.assignedEvents || []).some((id) => String(id) === String(eventId));
};

router.get('/inventory', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.eventId) filter.event = req.query.eventId;
    if (['AVAILABLE', 'ASSIGNED', 'DISABLED'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search) filter.rfidTag = { $regex: normalizeRfidTag(req.query.search), $options: 'i' };
    const [tags, totals] = await Promise.all([
      RfidTag.find(filter).sort({ rfidTag: 1 }).populate('event', 'name').populate('attendee', 'fullName email phone').populate('ticket', 'ticketNumber categoryName').lean(),
      RfidTag.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    const counts = totals.reduce((result, item) => ({ ...result, [item._id]: item.count }), {});
    res.json({ success: true, data: { tags, counts: { total: tags.length, available: counts.AVAILABLE || 0, assigned: counts.ASSIGNED || 0, disabled: counts.DISABLED || 0 } } });
  } catch (err) { next(err); }
});

const insertInventoryTags = async (values) => {
  const normalized = values.map(normalizeRfidTag);
  const valid = normalized.filter(isValidRfidTag);
  const unique = [...new Set(valid)];
  const existing = new Set((await RfidTag.find({ rfidTag: { $in: unique } }).select('rfidTag').lean()).map((tag) => tag.rfidTag));
  const docs = unique.filter((value) => !existing.has(value)).map((rfidTag) => ({ rfidTag, status: 'AVAILABLE' }));
  if (docs.length) await RfidTag.insertMany(docs, { ordered: false });
  return { imported: values.length, duplicates: values.length - valid.length + (valid.length - unique.length) + existing.size, invalid: values.length - valid.length, added: docs.length };
};

router.post('/inventory', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const values = Array.isArray(req.body.rfidTags) ? req.body.rfidTags : [req.body.rfidTag];
    if (!values.some(isValidRfidTag)) return res.status(400).json({ success: false, message: 'At least one valid 10-digit RFID is required.' });
    res.json({ success: true, data: await insertInventoryTags(values) });
  } catch (err) { next(err); }
});

router.post('/inventory/bulk', protect, restrictTo('main_admin', 'main_organiser'), excelUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel or CSV file is required.' });
    const workbook = XLSX.read(req.file.buffer);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
    const values = rows.slice(1).map((row) => row[0]).filter(Boolean);
    res.json({ success: true, data: await insertInventoryTags(values) });
  } catch (err) { next(err); }
});

router.post('/assign', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const qrToken = String(req.body.qrToken || '').trim();
    if (!qrToken || !req.body.rfidTag) return res.status(400).json({ success: false, message: 'qrToken and rfidTag are required.' });
    const attendee = await Attendee.findOne({ qrToken }).select('event ticket').lean();
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee could not be found.' });
    if (!(await userHasEventAccess(req.user, attendee.event))) return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    const result = await assignRfidToAttendee({ rfidTag: req.body.rfidTag, attendeeId: attendee._id, ticketId: attendee.ticket, operatorId: req.user._id });
    res.json({ success: true, message: 'RFID assigned successfully.', data: { attendee: result.attendee, tag: result.tag } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get('/events/:eventId', protect, restrictTo(...adminRoles), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const tags = await RfidTag.find({ event: req.params.eventId }).sort({ categoryId: 1, sequence: 1 }).populate('attendee', 'fullName email').lean();
    res.json({ success: true, data: { tags } });
  } catch (err) { next(err); }
});

const getUniqueValidRfidValues = async (eventId, categoryId, values) => {
  const existing = await RfidTag.find({ event: eventId, categoryId }).select('rfidTag').lean();
  const used = new Set(existing.map((tag) => tag.rfidTag));
  const unique = [];

  for (const value of values) {
    const normalized = normalizeRfidTag(value);
    if (!isValidRfidTag(normalized) || used.has(normalized)) continue;
    used.add(normalized);
    unique.push(normalized);
  }

  return unique;
};

const addTags = async ({ eventId, categoryId, values }) => {
  const [existing, maxAllowed] = await Promise.all([
    RfidTag.find({ event: eventId, categoryId }).select('rfidTag').lean(),
    getCategoryLimit(eventId, categoryId),
  ]);

  if (maxAllowed === null) {
    throw new Error('Category not found for this event.');
  }

  const used = new Set(existing.map((tag) => tag.rfidTag));
  let sequence = (await RfidTag.findOne({ event: eventId, categoryId }).sort({ sequence: -1 }).select('sequence').lean())?.sequence || 0;
  const docs = [];
  for (const value of values) {
    const rfidTag = normalizeRfidTag(value);
    if (!isValidRfidTag(rfidTag) || used.has(rfidTag)) continue;
    if (existing.length + docs.length + 1 > maxAllowed) {
      break;
    }
    used.add(rfidTag);
    docs.push({ event: eventId, categoryId, rfidTag, sequence: ++sequence });
  }
  if (docs.length) await RfidTag.insertMany(docs, { ordered: false });
  return docs.length;
};

router.post('/events/:eventId/tags', protect, restrictTo(...adminRoles), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const values = Array.isArray(req.body.rfidTags) ? req.body.rfidTags : [req.body.rfidTag];
    if (!req.body.categoryId || !values.some(isValidRfidTag)) return res.status(400).json({ success: false, message: 'categoryId and at least one valid 10-digit RFID are required.' });

    const categoryLimit = await getCategoryLimit(req.params.eventId, req.body.categoryId);
    if (categoryLimit === null) return res.status(400).json({ success: false, message: 'Category not found for this event.' });

    const existingCount = await RfidTag.countDocuments({ event: req.params.eventId, categoryId: req.body.categoryId });
    const uniqueNewValues = await getUniqueValidRfidValues(req.params.eventId, req.body.categoryId, values);

    if (existingCount + uniqueNewValues.length > categoryLimit) {
      return res.status(400).json({
        success: false,
        message: `This category can only hold ${categoryLimit} RFID tags. You are trying to add ${uniqueNewValues.length} more, but ${existingCount} already exist.`,
      });
    }

    const added = await addTags({ eventId: req.params.eventId, categoryId: req.body.categoryId, values: uniqueNewValues });
    res.json({ success: true, data: { added } });
  } catch (err) { next(err); }
});

router.post('/events/:eventId/upload', protect, restrictTo(...adminRoles), excelUpload.single('file'), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const { categoryId } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file is required.' });
    const workbook = XLSX.read(req.file.buffer);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const values = rows.map((row) => row.rfidTag || row['RFID Tag'] || row.RFID || row['RFID'] || Object.values(row)[0]);
    const categoryLimit = await getCategoryLimit(req.params.eventId, categoryId);
    if (categoryLimit === null) return res.status(400).json({ success: false, message: 'Category not found for this event.' });
    const existingCount = await RfidTag.countDocuments({ event: req.params.eventId, categoryId });
    const uniqueValues = await getUniqueValidRfidValues(req.params.eventId, categoryId, values);
    if (existingCount + uniqueValues.length > categoryLimit) {
      return res.status(400).json({
        success: false,
        message: `This category can only hold ${categoryLimit} RFID tags. You are trying to add ${uniqueValues.length} more, but ${existingCount} already exist.`,
      });
    }
    const added = await addTags({ eventId: req.params.eventId, categoryId, values: uniqueValues });
    res.json({ success: true, data: { added, skipped: values.length - added } });
  } catch (err) { next(err); }
});

router.delete('/events/:eventId/tags/:tagId', protect, restrictTo(...adminRoles), async (req, res, next) => {
  try {
    if (!(await canManageEvent(req.user, req.params.eventId))) return res.status(403).json({ success: false, message: 'You do not manage this event.' });
    const tag = await RfidTag.findOne({ _id: req.params.tagId, event: req.params.eventId });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found.' });
    if (tag.status === 'assigned') return res.status(409).json({ success: false, message: 'Assigned RFID tags cannot be removed.' });
    await tag.deleteOne();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/rfid/validate/:rfidTag - Validate if an RFID is available for assignment
router.get('/validate/:rfidTag', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;
    const { eventId, categoryId } = req.query;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ 
        success: false, 
        message: 'RFID tag must be exactly 10 digits.',
        valid: false,
        reason: 'INVALID_FORMAT'
      });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });

    if (!tag) {
      return res.json({
        success: true,
        data: {
          rfidTag: normalizedTag,
          exists: false,
          valid: false,
          status: null,
          reason: 'NOT_IN_INVENTORY',
          message: 'RFID tag is not registered in the inventory. Please add it to the Admin inventory first.',
        },
      });
    }

    // If eventId is provided, check if RFID is compatible
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      const event = await Event.findById(eventId).select('settings.rfidEnabled');
      
      if (!event?.settings?.rfidEnabled) {
        return res.json({
          success: true,
          data: {
            rfidTag: normalizedTag,
            exists: true,
            valid: false,
            status: tag.status,
            reason: 'RFID_DISABLED',
            message: 'RFID access is disabled for this event.',
          },
        });
      }

      // If category is specified, check category compatibility
      if (categoryId && tag.categoryId && tag.categoryId !== categoryId) {
        return res.json({
          success: true,
          data: {
            rfidTag: normalizedTag,
            exists: true,
            valid: false,
            status: tag.status,
            reason: 'CATEGORY_MISMATCH',
            message: `RFID tag is allocated for category ${tag.categoryId}, not ${categoryId}.`,
          },
        });
      }
    }

    if (tag.status !== 'AVAILABLE') {
      let message = 'RFID tag is already assigned.';
      let assignedInfo = null;

      if (tag.status === 'ASSIGNED' && tag.attendee) {
        const attendee = await Attendee.findById(tag.attendee).select('fullName email').lean();
        assignedInfo = {
          attendeeName: attendee?.fullName,
          attendeeId: tag.attendee,
        };
        message = `RFID tag is assigned to attendee: ${attendee?.fullName || 'Unknown'}`;
      } else if (tag.status === 'DISABLED') {
        message = 'RFID tag has been disabled.';
      }

      return res.json({
        success: true,
        data: {
          rfidTag: normalizedTag,
          exists: true,
          valid: false,
          status: tag.status,
          reason: 'NOT_AVAILABLE',
          message,
          assignedInfo,
        },
      });
    }

    res.json({
      success: true,
      data: {
        rfidTag: normalizedTag,
        exists: true,
        valid: true,
        status: 'AVAILABLE',
        reason: null,
        message: 'RFID tag is available for assignment.',
      },
    });
  } catch (err) { next(err); }
});

// DELETE /api/rfid/unassign/:rfidTag - Unassign/release an RFID from an attendee (Admin only)
router.delete('/unassign/:rfidTag', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;
    const { reason } = req.body;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag must be exactly 10 digits.' });
    }

    const result = await unassignRfidFromAttendee({
      rfidTag,
      operatorId: req.user._id,
      reason,
    });

    res.json({
      success: true,
      message: 'RFID unassigned successfully. Tag is now available for reassignment.',
      data: {
        rfidTag: result.tag.rfidTag,
        releasedFrom: {
          attendeeId: result.attendee._id,
          attendeeName: result.attendee.fullName,
        },
        status: result.tag.status,
        reason: result.reason,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
});

// GET /api/rfid/assignment/:attendeeId - Get RFID assignment details for an attendee
router.get('/assignment/:attendeeId', protect, restrictTo(...operationalRoles), async (req, res, next) => {
  try {
    const { attendeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(attendeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid attendee ID.' });
    }

    const attendee = await Attendee.findById(attendeeId)
      .populate('event', 'name settings.rfidEnabled')
      .select('fullName email phone rfidTag categoryName qrToken checkedIn');

    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    // Check event access
    if (!(await userHasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    let tagDetails = null;
    if (attendee.rfidTag) {
      tagDetails = await RfidTag.findOne({ rfidTag: attendee.rfidTag })
        .populate('event', 'name')
        .populate('assignedBy', 'name email')
        .lean();

      tagDetails.assignedAt = tagDetails.assignedAt ? new Date(tagDetails.assignedAt).toISOString() : null;
    }

    res.json({
      success: true,
      data: {
        attendee: {
          _id: attendee._id,
          fullName: attendee.fullName,
          email: attendee.email,
          phone: attendee.phone,
          categoryName: attendee.categoryName,
          qrToken: attendee.qrToken,
          rfidTag: attendee.rfidTag,
          checkedIn: attendee.checkedIn,
        },
        event: {
          _id: attendee.event._id,
          name: attendee.event.name,
          rfidEnabled: attendee.event.settings?.rfidEnabled,
        },
        rfidAssignment: tagDetails ? {
          rfidTag: tagDetails.rfidTag,
          status: tagDetails.status,
          event: tagDetails.event?.name,
          categoryId: tagDetails.categoryId,
          assignedBy: tagDetails.assignedBy?.name,
          assignedAt: tagDetails.assignedAt,
        } : null,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
// PATCH /api/rfid/inventory/:rfidTag/disable - Disable an RFID tag (make unavailable)
router.patch('/inventory/:rfidTag/disable', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;
    const { reason } = req.body;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag must be exactly 10 digits.' });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });

    if (tag.status === 'ASSIGNED') {
      return res.status(409).json({ success: false, message: 'Cannot disable an assigned RFID. Please unassign first.' });
    }

    tag.status = 'DISABLED';
    tag.disabledAt = new Date();
    tag.disabledBy = req.user._id;
    tag.disableReason = reason || 'Manually disabled';
    await tag.save();

    res.json({ success: true, message: 'RFID tag disabled successfully.', data: { tag: { rfidTag: tag.rfidTag, status: tag.status } } });
  } catch (err) { next(err); }
});

// PATCH /api/rfid/inventory/:rfidTag/enable - Re-enable a disabled RFID tag
router.patch('/inventory/:rfidTag/enable', protect, restrictTo('main_admin', 'main_organiser'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag must be exactly 10 digits.' });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });

    if (tag.status !== 'DISABLED') {
      return res.status(409).json({ success: false, message: 'Only disabled RFID tags can be enabled.' });
    }

    tag.status = 'AVAILABLE';
    tag.disabledAt = undefined;
    tag.disabledBy = undefined;
    tag.disableReason = undefined;
    await tag.save();

    res.json({ success: true, message: 'RFID tag enabled successfully.', data: { tag: { rfidTag: tag.rfidTag, status: tag.status } } });
  } catch (err) { next(err); }
});

// DELETE /api/rfid/inventory/:rfidTag - Delete an RFID tag from inventory (only non-assigned)
router.delete('/inventory/:rfidTag', protect, restrictTo('main_admin'), async (req, res, next) => {
  try {
    const { rfidTag } = req.params;

    if (!isValidRfidTag(rfidTag)) {
      return res.status(400).json({ success: false, message: 'RFID tag must be exactly 10 digits.' });
    }

    const normalizedTag = normalizeRfidTag(rfidTag);
    const tag = await RfidTag.findOne({ rfidTag: normalizedTag });
    if (!tag) return res.status(404).json({ success: false, message: 'RFID tag not found in inventory.' });

    if (tag.status === 'ASSIGNED') {
      return res.status(409).json({ success: false, message: 'Cannot delete an assigned RFID. Please unassign first.' });
    }

    await tag.deleteOne();

    res.json({ success: true, message: 'RFID tag deleted from inventory.' });
  } catch (err) { next(err); }
});