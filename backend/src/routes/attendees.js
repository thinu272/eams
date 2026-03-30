const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { protect, restrictTo, requireEventAccess, requirePermission } = require('../middleware/auth');
const { sendAttendeeInvite, sendFinalConfirmation } = require('../utils/email');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// POST /api/attendees/confirm/:token - attendee self-confirms identity (public)
router.post('/confirm/:token', upload.single('photo'), async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token });
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid confirmation link.' });
    if (attendee.confirmationStatus === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Already confirmed.' });
    }

    const { fullName, email, phone, dateOfBirth, nationalId, passportNumber, nationality } = req.body;
    attendee.fullName = fullName;
    attendee.email = email;
    attendee.phone = phone;
    if (dateOfBirth) attendee.dateOfBirth = new Date(dateOfBirth);
    if (nationalId) attendee.nationalId = nationalId;
    if (passportNumber) attendee.passportNumber = passportNumber;
    if (nationality) attendee.nationality = nationality;
    if (req.file) attendee.photo = `uploads/${req.file.filename}`;

    attendee.confirmationStatus = 'confirmed';
    attendee.confirmedAt = new Date();
    attendee.confirmedBy = 'self';

    // Generate QR code
    const qrData = attendee.qrToken;
    attendee.qrCode = await QRCode.toDataURL(qrData);

    await attendee.save();

    // IMPORTANT: Sync Ticket status
    await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: 'confirmed' });

    // Check if all tickets in the order are now confirmed
    if (attendee.order) {
      const tickets = await Ticket.find({ order: attendee.order });
      const confirmedCount = tickets.filter(t => t.status === 'confirmed').length;
      if (confirmedCount === tickets.length) {
        await Order.findByIdAndUpdate(attendee.order, { confirmationStatus: 'complete' });
        // Send final confirmation emails to all attendees
        const allAttendees = await Attendee.find({ order: attendee.order });
        const event = await Event.findById(attendee.event);
        allAttendees.forEach(a => sendFinalConfirmation(a, event).catch(console.error));
      } else {
        await Order.findByIdAndUpdate(attendee.order, { confirmationStatus: 'partial' });
      }
    }

    res.json({ success: true, data: { attendee }, message: 'Identity confirmed successfully.' });
  } catch (err) { next(err); }
});

// GET /api/attendees/confirm/:token - get attendee confirmation info (public)
router.get('/confirm/:token', async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token })
      .populate('event', 'name venue startDate categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid link.' });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// GET /api/attendees - list attendees for event (organiser/sub-organiser)
router.get('/', protect, async (req, res, next) => {
  try {
    const { eventId, status, categoryId, search, page = 1, limit = 20 } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });

    const filter = { event: eventId, isActive: true };
    if (status) filter.confirmationStatus = status;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [attendees, total] = await Promise.all([
      Attendee.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Attendee.countDocuments(filter),
    ]);
    res.json({ success: true, data: { attendees, total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// POST /api/attendees - manually add attendee (sub-organiser)
router.post('/', protect, requirePermission('canAddAttendees'), async (req, res, next) => {
  try {
    const { eventId, categoryId, ...attendeeData } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = event.categories.find(c => c.id === categoryId);
    const allowedZones = category ? category.allowedZones : [];

    const attendee = await Attendee.create({
      ...attendeeData,
      event: eventId,
      categoryId,
      categoryName: category?.name,
      allowedZones,
      addedBy: req.user._id,
      addedVia: 'manual',
      confirmationStatus: 'pending',
    });

    // Generate QR code
    const qrData = JSON.stringify({ token: attendee.qrToken, event: eventId });
    attendee.qrCode = await QRCode.toDataURL(qrData);
    await attendee.save();

    res.status(201).json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// POST /api/attendees/bulk-upload - parse Excel file
router.post('/bulk-upload', protect, requirePermission('canBulkUpload'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required.' });
    const { eventId, categoryId } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    const category = event.categories.find(c => c.id === categoryId);

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const results = { created: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row['Full Name'] || !row['Email']) {
          results.errors.push({ row: i + 2, message: 'Full Name and Email are required.' });
          continue;
        }
        const attendee = await Attendee.create({
          fullName: row['Full Name'],
          email: row['Email'],
          phone: row['Phone'] || '',
          nationalId: row['National ID'] || '',
          dateOfBirth: row['Date of Birth'] ? new Date(row['Date of Birth']) : undefined,
          nationality: row['Nationality'] || '',
          event: eventId,
          categoryId: categoryId,
          categoryName: category?.name,
          allowedZones: category?.allowedZones || [],
          addedBy: req.user._id,
          addedVia: 'bulk_upload',
          confirmationStatus: 'pending',
        });
        const qrData = JSON.stringify({ token: attendee.qrToken, event: eventId });
        attendee.qrCode = await QRCode.toDataURL(qrData);
        await attendee.save();
        results.created++;
      } catch (err) {
        results.errors.push({ row: i + 2, message: err.message });
      }
    }
    res.json({ success: true, data: results, message: `${results.created} attendees imported. ${results.errors.length} errors.` });
  } catch (err) { next(err); }
});

// GET /api/attendees/template - download blank Excel template
router.get('/template', protect, async (req, res, next) => {
  try {
    const wb = XLSX.utils.book_new();
    const headers = [['Full Name', 'Email', 'Phone', 'National ID', 'Passport Number', 'Date of Birth', 'Nationality', 'Notes']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = headers[0].map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Attendees');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=attendee_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) { next(err); }
});

// POST /api/attendees/:id/invite - send invite to attendee
router.post('/:id/invite', protect, async (req, res, next) => {
  try {
    let attendee = await Attendee.findById(req.params.id)
      .populate({ path: 'order', select: 'buyerEmail' })
      .populate('event', 'name venue startDate');
    
    // If not found, check if it's a ticket ID
    if (!attendee) {
      const ticket = await Ticket.findById(req.params.id).populate('attendee');
      if (ticket && ticket.attendee) {
        attendee = await Attendee.findById(ticket.attendee._id)
          .populate({ path: 'order', select: 'buyerEmail' })
          .populate('event', 'name venue startDate');
      }
    }

    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

    // Authorization check: Admin/Organiser OR the buyer of the order
    const isOrganiser = ['main_admin', 'main_organiser'].includes(req.user.role) || 
                       (req.user.role === 'sub_organiser' && req.user.permissions?.canInviteAttendees);
    const isBuyer = attendee.order && attendee.order.buyerEmail === req.user.email;

    if (!isOrganiser && !isBuyer) {
      return res.status(403).json({ success: false, message: 'You are not authorised to invite for this ticket.' });
    }

    attendee.confirmationStatus = 'invited';
    await attendee.save();
    await sendAttendeeInvite(attendee, attendee.event);
    res.json({ success: true, message: 'Invite sent.' });
  } catch (err) {
    console.error('INVITE ERROR:', err);
    next(err);
  }
});

// PATCH /api/attendees/:id/verify-photo - organiser verifies photo
router.patch('/:id/verify-photo', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const attendee = await Attendee.findByIdAndUpdate(req.params.id, {
      photoVerificationStatus: status,
      photoVerifiedBy: req.user._id,
      photoVerifiedAt: new Date(),
      ...(status === 'rejected' && { photoRejectionReason: rejectionReason }),
    }, { new: true });
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// GET /api/attendees/:id - get single attendee
router.get('/:id', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event', 'name venue startDate zones categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// PATCH /api/attendees/:id - update attendee
router.patch('/:id', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

module.exports = router;
