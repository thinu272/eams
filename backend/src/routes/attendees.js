const express = require('express');
const router = express.Router();
const path = require('path');
const XLSX = require('xlsx');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const Ticket = require('../models/Ticket');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { protect, restrictTo, requireEventAccess, requirePermission } = require('../middleware/auth');
const { notifyInvite, notifyFinalTicket, notifyBuyerTicketProgress } = require('../services/notificationService');
const { sendAttendeeVerificationConfirmation } = require('../utils/email');
const { upload, excelUpload, handleS3Upload } = require('../middleware/s3Upload');
const { deleteImageFromS3, getSignedUrl } = require('../services/s3Service');
const { validatePhoto } = require('../services/photoValidationService');
const { requiresPhotoVerification, resolveConfirmedTicketStatus } = require('../services/ticketDeliveryService');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
const { ROLES, normalizeRole } = require('../utils/rbac');

const hasEventAccess = async (user, eventId) => {
  if (!eventId) return false;
  if (user.role === 'main_admin') return true;
  if (user.assignedEvents?.some((assigned) => assigned.toString() === eventId.toString())) return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser');
  return !!event && (
    event.createdBy?.toString() === user._id.toString() ||
    event.mainOrganiser?.toString() === user._id.toString()
  );
};

const euclideanDistance = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const similarityFromDistance = (distance) => {
  if (typeof distance !== 'number' || Number.isNaN(distance)) return 0;
  const sim = 1 - distance;
  return Math.max(0, Math.min(1, sim));
};

const clampThreshold = (value) => {
  let threshold = parseFloat(value);
  if (Number.isNaN(threshold)) threshold = 0.5;
  return Math.max(0.4, Math.min(0.6, threshold));
};

// Multer configured in s3Upload middleware
// Using memory storage with S3 upload handler

// POST /api/attendees/confirm/:token - attendee self-confirms identity (public)
router.post('/confirm/:token', upload.single('photo'), handleS3Upload('attendee-photos'), async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ confirmationToken: req.params.token }).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid confirmation link.' });
    if (attendee.confirmationStatus === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Already confirmed.' });
    }

    const { fullName, email, phone, dateOfBirth, nationalId, passportNumber, nationality } = req.body;
    // Enforce phone/email based on event-level communication settings
    const smsRequired = attendee.event?.settings?.communicationChannels?.sms === true;
    const emailRequired = attendee.event?.settings?.communicationChannels?.email === true;
    if (smsRequired && (!phone || String(phone).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Phone number is required for this event.' });
    }
    if (emailRequired && (!email || String(email).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Email is required for this event.' });
    }
    attendee.fullName = fullName;
    attendee.email = email;
    attendee.phone = phone;
    if (dateOfBirth) attendee.dateOfBirth = new Date(dateOfBirth);
    if (nationalId) attendee.nationalId = nationalId;
    if (passportNumber) attendee.passportNumber = passportNumber;
    if (nationality) attendee.nationality = nationality;
    
    // Store S3 photo data
    if (req.s3Data) {
      // --- AI VALIDATION ---
      const aiResults = await validatePhoto(req.file.buffer, attendee.event);
      
      attendee.photo = req.s3Data.url;
      attendee.photoS3Key = req.s3Data.key;
      attendee.photoUploadedAt = new Date();
      attendee.photoHash = aiResults.hash;
      attendee.photoValidationMetrics = {
        ...attendee.photoValidationMetrics,
        faceCount: aiResults.metrics.faceCount,
        faceConfidence: aiResults.metrics.faceConfidence,
        sharpness: aiResults.metrics.sharpness,
        brightness: aiResults.metrics.brightness,
      };

      if (!aiResults.isValid) {
        attendee.photoVerificationStatus = 'rejected';
        attendee.photoRejectionReason = `AI Auto-Reject: ${aiResults.reason}`;
      } else {
        attendee.photoVerificationStatus = 'pending';
      }
    }

    let incomingDescriptor = [];
    try {
      incomingDescriptor = req.body.faceDescriptor ? JSON.parse(req.body.faceDescriptor) : [];
    } catch (err) {
      incomingDescriptor = [];
    }
    if (Array.isArray(incomingDescriptor) && incomingDescriptor.every((v) => typeof v === 'number')) {
      attendee.faceDescriptor = incomingDescriptor;
    }

    attendee.confirmationStatus = 'confirmed';
    attendee.isConfirmed = true;
    attendee.confirmedAt = new Date();
    attendee.confirmedBy = 'self';

    // DO NOT generate QR code here. It will be generated after admin photo approval.
    // attendee.qrCode = await QRCode.toDataURL(qrData);

    await attendee.save();

    const nextTicketStatus = resolveConfirmedTicketStatus({ attendee, event: attendee.event });
    await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: nextTicketStatus });

    // Send attendee verification confirmation email if photo verification is required
    if (requiresPhotoVerification(attendee.event) && attendee.photoVerificationStatus === 'pending') {
      await sendAttendeeVerificationConfirmation(attendee, attendee.event).catch(err => console.error('ATTENDEE VERIFICATION EMAIL ERROR:', err));
    }

    // Check if all tickets in the order are now submitted
    if (attendee.order) {
      const tickets = await Ticket.find({ order: attendee.order });
      const assignedCount = tickets.filter(t => t.status === 'ASSIGNED' || t.status === 'CONFIRMED').length;
      if (assignedCount === tickets.length) {
        await Order.findByIdAndUpdate(attendee.order, { confirmationStatus: 'complete' });
        if (!requiresPhotoVerification(attendee.event)) {
          await notifyFinalTicket({
            attendee,
            event: attendee.event,
            phone: attendee.phone,
            notificationChannel: 'email',
          }).catch(console.error);
        } else {
          const ticket = await Ticket.findOne({ attendee: attendee._id });
          const order = await Order.findById(attendee.order);
          await notifyBuyerTicketProgress({
            order,
            attendee,
            event: attendee.event,
            ticket,
            stage: 'pending_verification',
          });
        }
      } else {
        await Order.findByIdAndUpdate(attendee.order, { confirmationStatus: 'partial' });
        if (requiresPhotoVerification(attendee.event)) {
          const ticket = await Ticket.findOne({ attendee: attendee._id });
          const order = await Order.findById(attendee.order);
          await notifyBuyerTicketProgress({
            order,
            attendee,
            event: attendee.event,
            ticket,
            stage: 'pending_verification',
          });
        }
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
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

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

// GET /api/attendees/export - export attendees for event as CSV
router.get('/export', protect, async (req, res, next) => {
  try {
    const { eventId, status, categoryId, search } = req.query;
    if (!eventId) return res.status(400).json({ success: false, message: 'eventId required.' });
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { event: eventId, isActive: true };
    if (status) filter.confirmationStatus = status;
    if (categoryId) filter.categoryId = categoryId;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const attendees = await Attendee.find(filter).sort('-createdAt');
    const rows = [
      ['Full Name', 'Email', 'Phone', 'Category', 'Status', 'Photo Status', 'QR Token', 'Checked In'],
      ...attendees.map((attendee) => [
        attendee.fullName || '',
        attendee.email || '',
        attendee.phone || '',
        attendee.categoryName || '',
        attendee.confirmationStatus || '',
        attendee.photoVerificationStatus || '',
        attendee.qrToken || '',
        attendee.checkedIn ? 'Yes' : 'No',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendees-${eventId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// POST /api/attendees - manually add attendee (sub-organiser)
router.post('/', protect, requirePermission('canAddAttendees'), async (req, res, next) => {
  try {
    const { eventId, categoryId, notificationChannel, ...attendeeData } = req.body;
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const category = event.categories.find(c => c.id === categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

    // Zone validation for Sub-Organisers (Overlap logic)
    const role = normalizeRole(req.user.role);
    if (role === ROLES.SUB_ORGANISER) {
      const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);
      const categoryZones = (category.allowedZones || []).map(String);
      
      const hasOverlap = categoryZones.length === 0 || categoryZones.some(z => myZoneIds.includes(z));
      if (!hasOverlap) {
        return res.status(403).json({ 
          success: false, 
          message: `This category does not grant access to any of your assigned zones.` 
        });
      }
    }

    const allowedZones = category ? category.allowedZones : [];

    // Enforce phone/email presence based on event-level settings
    const smsRequired = event.settings?.communicationChannels?.sms === true;
    const emailRequired = event.settings?.communicationChannels?.email === true;
    if (smsRequired && (!attendeeData.phone || String(attendeeData.phone).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Phone number is required for this event.' });
    }
    if (emailRequired && (!attendeeData.email || String(attendeeData.email).trim() === '')) {
      return res.status(400).json({ success: false, message: 'Email is required for this event.' });
    }

    const attendee = await Attendee.create({
      ...attendeeData,
      event: eventId,
      categoryId,
      categoryName: category?.name,
      allowedZones,
      addedBy: req.user._id,
      addedVia: 'manual',
      confirmationStatus: notificationChannel && notificationChannel !== 'none' ? 'invited' : 'pending',
    });

    // Generate QR code
    attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
    await attendee.save();

    if (notificationChannel && notificationChannel !== 'none') {
      await notifyInvite({
        attendee,
        event,
        phone: attendee.phone,
        email: attendee.email,
        notificationChannel,
      });
    }

    // UPDATE SOLD COUNT AND BROADCAST
    await Event.updateOne(
      { _id: eventId, 'categories.id': categoryId },
      { $inc: { 'categories.$.sold': 1 } }
    );

    const { emitDashboardEvent } = require('../utils/socket');
    const io = req.app.get('io');
    emitDashboardEvent(io, 'event_update', eventId, {
      type: 'MANUAL_ADDITION',
      eventId,
      categoryId
    });

    res.status(201).json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

router.post('/bulk-upload', protect, excelUpload.single('file'), async (req, res, next) => {
  try {
    const role = normalizeRole(req.user.role);
    if (![ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER, ROLES.SUB_ORGANISER].includes(role) && !req.user.permissions?.canBulkUpload) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform bulk uploads.' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Excel file required.' });
    const { eventId, categoryId } = req.body;
    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    const category = (event.categories || []).find(c => c.id === categoryId);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

    const smsRequired = event.settings?.communicationChannels?.sms === true;
    const emailRequired = event.settings?.communicationChannels?.email === true;

    // Zone validation for Sub-Organisers (Overlap logic)
    if (role === ROLES.SUB_ORGANISER) {
      const myZoneIds = (req.user.responsibilities?.zoneIds || []).map(String);
      const categoryZones = (category.allowedZones || []).map(String);
      
      const hasOverlap = categoryZones.length === 0 || categoryZones.some(z => myZoneIds.includes(z));
      if (!hasOverlap) {
        return res.status(403).json({ 
          success: false, 
          message: `This category does not grant access to any of your assigned zones.` 
        });
      }
    }

    const workbook = XLSX.read(req.file.buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const results = { created: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row['Full Name'] || (emailRequired && !row['Email'])) {
          results.errors.push({ row: i + 2, message: `Full Name${emailRequired ? ' and Email' : ''} are required.` });
          continue;
        }
        if (smsRequired && !row['Phone']) {
          results.errors.push({ row: i + 2, message: 'Phone is required for this event.' });
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
        attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
        await attendee.save();
        results.created++;
      } catch (err) {
        results.errors.push({ row: i + 2, message: err.message });
      }
    }

    // UPDATE SOLD COUNT AND BROADCAST FOR BULK
    if (results.created > 0) {
      await Event.updateOne(
        { _id: eventId, 'categories.id': categoryId },
        { $inc: { 'categories.$.sold': results.created } }
      );

      const { emitDashboardEvent } = require('../utils/socket');
      const io = req.app.get('io');
      emitDashboardEvent(io, 'event_update', eventId, {
        type: 'BULK_UPLOAD',
        eventId,
        categoryId,
        count: results.created
      });
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

// POST /api/attendees/invite-by-ticket/:ticketId - invite attendee by ticket ID and email (public for buyers)
router.post('/invite-by-ticket/:ticketId', async (req, res, next) => {
  try {
    const { email, phone, notificationChannel } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const ticket = await Ticket.findById(req.params.ticketId).populate('order').populate('event');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    if (ticket.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Ticket is already assigned.' });

    // Create attendee
    const attendee = new Attendee({
      order: ticket.order._id,
      event: ticket.event._id,
      ticket: ticket._id,
      email: email,
      phone,
      categoryId: ticket.categoryId,
      categoryName: ticket.categoryName,
      allowedZones: ticket.allowedZones || [],
      confirmationToken: uuidv4(),
      qrToken: uuidv4(),
      confirmationStatus: 'invited',
      invitedAt: new Date(),
      addedVia: 'invite',
    });

    await attendee.save();

    // Update ticket
    ticket.attendee = attendee._id;
    ticket.inviteEmail = email;
    ticket.inviteToken = attendee.confirmationToken;
    ticket.status = 'INVITED';
    ticket.inviteSentAt = new Date();
    ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
    ticket.inviteStatus = 'PENDING';
    ticket.inviteRespondedAt = null;
    ticket.inviteUsedAt = null;
    await ticket.save();

    await notifyInvite({
      attendee,
      event: ticket.event,
      phone,
      email,
      notificationChannel: notificationChannel || 'email',
    });

    await notifyBuyerTicketProgress({
      order: ticket.order,
      attendee,
      event: ticket.event,
      ticket,
      stage: 'invited',
    });

    res.json({ success: true, message: 'Invite sent successfully.' });
  } catch (err) {
    console.error('INVITE BY TICKET ERROR:', err);
    next(err);
  }
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
    const attendeeTicket = await Ticket.findOne({ attendee: attendee._id });
    if (ticket) {
      ticket.status = 'INVITED';
      ticket.inviteStatus = 'PENDING';
      ticket.inviteSentAt = new Date();
      ticket.inviteExpiresAt = new Date(Date.now() + (parseInt(process.env.INVITE_TOKEN_EXPIRY_HOURS || '72', 10) * 60 * 60 * 1000));
      ticket.inviteRespondedAt = null;
      ticket.inviteUsedAt = null;
      if (!ticket.inviteToken) ticket.inviteToken = attendee.confirmationToken;
      if (!ticket.inviteEmail && attendee.email) ticket.inviteEmail = attendee.email;
      await ticket.save();
    }
    await notifyInvite({
      attendee,
      event: attendee.event,
      phone: req.body.phone || attendee.phone,
      email: attendee.email,
      notificationChannel: req.body.notificationChannel || 'email',
    });
    const ticket = await Ticket.findOne({ attendee: attendee._id });
    const order = attendee.order?._id ? attendee.order : await Order.findById(attendee.order);
    await notifyBuyerTicketProgress({
      order,
      attendee,
      event: attendee.event,
      ticket: attendeeTicket,
      stage: 'invited',
    });
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
    const attendee = await Attendee.findById(req.params.id).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    
    attendee.photoVerificationStatus = status;
    attendee.photoVerifiedBy = req.user._id;
    attendee.photoVerifiedAt = new Date();
    
    if (status === 'rejected') {
      attendee.photoRejectionReason = rejectionReason;
      attendee.qrCode = null; // Clear QR if rejected
    } else if (status === 'verified') {
      attendee.photoRejectionReason = null;
      
      // Generate QR code on approval
      attendee.qrCode = await QRCode.toDataURL(attendee.qrToken);
      attendee.confirmationStatus = 'confirmed';
      attendee.isConfirmed = true;
      attendee.confirmedAt = new Date();
      attendee.confirmedBy = 'organiser';
      
      // Sync ticket status
      await Ticket.findOneAndUpdate({ attendee: attendee._id }, { status: 'CONFIRMED' });
      
      // Ensure data is saved before notifying
      await attendee.save();

      // Send final ticket notification
      await notifyFinalTicket({
        attendee,
        event: attendee.event,
        phone: attendee.phone,
        notificationChannel: 'both',
        force: true
      }).catch(console.error);

      if (attendee.order) {
        await processOrderFinalConfirmation({ orderId: attendee.order }).catch(console.error);
      }
    }

    await attendee.save();
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// POST /api/attendees/reject-photo - reject photo and send resubmit notification
router.post('/reject-photo', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { attendeeId, reason } = req.body;
    if (!attendeeId || !reason) {
      return res.status(400).json({ success: false, message: 'Attendee ID and reason are required.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event', 'name');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, attendee.event?._id))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    const resubmitToken = uuidv4();
    const resubmitCount = (attendee.resubmitCount || 0) + 1;

    attendee.photoVerificationStatus = 'rejected';
    attendee.photoRejectionReason = reason;
    attendee.resubmitToken = resubmitToken;
    attendee.resubmitCount = resubmitCount;
    attendee.photoVerifiedBy = req.user._id;
    attendee.photoVerifiedAt = new Date();
    attendee.qrCode = null; // Clear QR on rejection
    
    await attendee.save();

    // Send notifications
    const { notifyPhotoRejection } = require('../services/notificationService');
    await notifyPhotoRejection({ attendee, reason, resubmitToken });

    res.json({ success: true, message: 'Photo rejected and resubmit notification sent.' });
  } catch (err) { next(err); }
});

// GET /api/attendees/resubmit/:token - get resubmit info (public)
router.get('/resubmit/:token', async (req, res, next) => {
  try {
    const attendee = await Attendee.findOne({ resubmitToken: req.params.token }).populate('event', 'name photoRequirements');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid resubmit link.' });

    // Check resubmit limit (max 3)
    if (attendee.resubmitCount >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum resubmissions reached.' });
    }

    res.json({
      success: true,
      data: {
        attendee: {
          id: attendee._id,
          fullName: attendee.fullName,
          email: attendee.email,
          rejectionReason: attendee.photoRejectionReason,
          resubmitCount: attendee.resubmitCount,
          photo: attendee.photo,
          faceDescriptor: attendee.faceDescriptor || [],
        },
        event: attendee.event,
      },
    });
  } catch (err) { next(err); }
});

// POST /api/attendees/resubmit/photo - resubmit photo
router.post('/resubmit/photo', upload.single('photo'), handleS3Upload('attendee-photos'), async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required.' });

    const attendee = await Attendee.findOne({ resubmitToken: token });
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid token.' });

    if (attendee.resubmitCount >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum resubmissions reached.' });
    }

    if (!req.s3Data) return res.status(400).json({ success: false, message: 'Photo is required.' });

    const faceValidationPassed = req.body.faceValidationPassed === 'true' || req.body.faceValidationPassed === true;
    if (!faceValidationPassed) {
      return res.status(400).json({ success: false, message: 'Frontend face validation not passed.' });
    }

    // Face descriptor matching logic
    let newFaceDescriptor = [];
    try {
      newFaceDescriptor = req.body.faceDescriptor ? JSON.parse(req.body.faceDescriptor) : [];
    } catch (err) {
      newFaceDescriptor = [];
    }
    if (!Array.isArray(newFaceDescriptor) || newFaceDescriptor.some((v) => typeof v !== 'number')) {
      newFaceDescriptor = [];
    }

    const existingDescriptor = Array.isArray(attendee.faceDescriptor) ? attendee.faceDescriptor : [];
    const threshold = clampThreshold(req.body.threshold);
    const skipFaceMatch = req.body.skipFaceMatch === 'true' || req.body.skipFaceMatch === true;

    let matchDistance = 0;
    let matchSimilarity = 0;
    let isMatchPass = true;

    if (existingDescriptor.length > 0 && !skipFaceMatch) {
      if (newFaceDescriptor.length === 0) {
        return res.status(400).json({ success: false, message: 'Face descriptor missing from submission.' });
      }
      matchDistance = euclideanDistance(existingDescriptor, newFaceDescriptor);
      if (matchDistance === null) {
        return res.status(400).json({ success: false, message: 'Face descriptor should be same dimensionality.' });
      }
      matchSimilarity = similarityFromDistance(matchDistance);

      if (matchSimilarity < threshold) {
        // Delete the S3 image if face doesn't match
        if (req.s3Data?.key) {
          await deleteImageFromS3(req.s3Data.key).catch(console.error);
        }

        attendee.photoVerificationStatus = 'rejected';
        attendee.photoRejectionReason = `Face mismatch: similarity ${matchSimilarity.toFixed(3)} below threshold ${threshold}`;
        attendee.photoValidationMetrics = {
          faceCount: Number(req.body.faceCount || 0),
          faceConfidence: Number(req.body.faceConfidence || 0),
          brightness: Number(req.body.brightness || 0),
          sharpness: Number(req.body.sharpness || 0),
          faceMatchDistance: Number(matchDistance),
          faceMatchSimilarity: Number(matchSimilarity),
          faceMatchThreshold: threshold,
        };
        await attendee.save();
        return res.status(400).json({ success: false, message: 'Face does not match the existing attendee record.', data: { matchSimilarity, matchDistance, threshold } });
      }
    }

    if (newFaceDescriptor.length > 0) {
      attendee.faceDescriptor = newFaceDescriptor;
    }

    // Delete old photo from S3 if exists
    if (attendee.photoS3Key) {
      await deleteImageFromS3(attendee.photoS3Key).catch(console.error);
    }

    // --- AI VALIDATION ---
    const aiResults = await validatePhoto(req.file.buffer, attendee.event);

    // Store new S3 photo data
    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    attendee.photoHash = aiResults.hash;

    // Log stats for audit
    attendee.photoValidationMetrics = {
      faceCount: aiResults.metrics.faceCount,
      faceConfidence: aiResults.metrics.faceConfidence,
      sharpness: aiResults.metrics.sharpness,
      brightness: aiResults.metrics.brightness,
      faceMatchDistance: Number(matchDistance),
      faceMatchSimilarity: Number(matchSimilarity),
      faceMatchThreshold: threshold,
    };

    if (skipFaceMatch) {
      attendee.notes = [attendee.notes, 'Face match skipped during photo resubmission because client models were unavailable.']
        .filter(Boolean)
        .join(' | ');
    }

    if (!aiResults.isValid) {
      attendee.photoVerificationStatus = 'rejected';
      attendee.photoRejectionReason = `AI Auto-Reject: ${aiResults.reason}`;
      await attendee.save();
      return res.status(400).json({ 
        success: false, 
        message: `Photo rejected by AI: ${aiResults.reason.replace(/_/g, ' ')}`,
        data: { aiResults }
      });
    }

    attendee.photoVerificationStatus = 'pending';
    attendee.photoRejectionReason = null; // Clear rejection reason
    attendee.qrCode = null; // Ensure no QR while pending
    await attendee.save();

    res.json({ success: true, message: 'Photo resubmitted successfully. It is now pending organiser verification.' });
  } catch (err) { next(err); }
});

// GET /api/attendees/:id - get single attendee
router.get('/:id', protect, async (req, res, next) => {
  try {
    const attendee = await Attendee.findById(req.params.id).populate('event', 'name venue startDate zones categories');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, attendee.event?._id || attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

// PATCH /api/attendees/:id - update attendee
router.patch('/:id', protect, async (req, res, next) => {
  try {
    const existingAttendee = await Attendee.findById(req.params.id).select('event');
    if (!existingAttendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });
    if (!(await hasEventAccess(req.user, existingAttendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }
    const attendee = await Attendee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('event');
    
    // Trigger notification if status changed to confirmed
    if (req.body.confirmationStatus === 'confirmed') {
      const { notifyFinalTicket } = require('../services/notificationService');
      await notifyFinalTicket({
        attendee,
        event: attendee.event,
        phone: attendee.phone,
        notificationChannel: 'both',
        force: true
      }).catch(console.error);
    }

    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
});

module.exports = router;
