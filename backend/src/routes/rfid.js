const express = require('express');
const XLSX = require('xlsx');
const multer = require('multer');
const Event = require('../models/Event');
const RfidTag = require('../models/RfidTag');
const { protect, restrictTo } = require('../middleware/auth');
const { normalizeRfidTag, isValidRfidTag } = require('../services/rfidService');

const router = express.Router();
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const adminRoles = ['main_admin', 'main_organiser'];

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

module.exports = router;