const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Attendee = require('../models/Attendee');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { protect, requirePermission } = require('../middleware/auth');
const { triggerCleanupNow } = require('../utils/s3Cleanup');
const { processOrderFinalConfirmation } = require('../services/finalConfirmationService');
const { notifyPhotoRejectionNotification } = require('../services/notificationService');

// Check organiser event access
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

// GET /api/verification/pending - list pending photos with filters, pagination, sorting
router.get('/pending', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const {
      eventId,
      status = 'pending',
      search,
      checkoutOption,
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = req.query;

    if (!eventId || eventId === 'undefined' || eventId === '') {
      return res.status(400).json({ success: false, message: 'eventId is required.' });
    }

    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const filter = { event: eventId, isActive: true };

    if (status) filter.photoVerificationStatus = status;

    if (checkoutOption && checkoutOption !== '') {
      filter.checkoutOption = checkoutOption;
    }

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { nationalId: { $regex: search, $options: 'i' } },
      ];
    }

    const sortObj = {};
    sortObj[sortBy] = parseInt(sortOrder, 10);

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [attendees, total] = await Promise.all([
      Attendee.find(filter)
        .select(
          '_id fullName email photo photoVerificationStatus photoValidationMetrics resubmitCount createdAt confirmationStatus checkoutOption',
        )
        .populate('event', 'name')
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Attendee.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / parseInt(limit, 10));

    res.json({
      success: true,
      data: {
        attendees,
        total,
        page: parseInt(page, 10),
        pages,
        limit: parseInt(limit, 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/verification/approve - approve a photo
router.post('/approve', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { attendeeId } = req.body;
    if (!attendeeId) {
      return res.status(400).json({ success: false, message: 'Attendee ID is required.' });
    }

    const attendee = await Attendee.findById(attendeeId).select('event photoVerificationStatus');
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    if (!(await hasEventAccess(req.user, attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    const updated = await Attendee.findByIdAndUpdate(
      attendeeId,
      {
        photoVerificationStatus: 'verified',
        photoVerifiedBy: req.user._id,
        photoVerifiedAt: new Date(),
        photoRejectionReason: null,
        // Auto-confirm attendee once photo is approved
        confirmationStatus: 'confirmed',
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: 'organiser',
      },
      { new: true },
    ).populate('event').select('_id fullName email phone photoVerificationStatus confirmationStatus isConfirmed order event qrToken qrCode');

    // Keep ticket lifecycle in sync once attendee is verified.
    await Ticket.findOneAndUpdate({ attendee: attendeeId }, { status: 'CONFIRMED' });

    // Trigger specific attendee notification
    const { notifyFinalTicket } = require('../services/notificationService');
    await notifyFinalTicket({
      attendee: updated,
      event: updated.event,
      phone: updated.phone,
      notificationChannel: 'both',
      force: true
    }).catch((err) => console.error('INDIVIDUAL FINAL NOTIFY ERROR:', err));

    // Trigger final confirmation email workflow for order context
    const finalConfirmation = await processOrderFinalConfirmation({ orderId: updated.order });

    res.json({
      success: true,
      message: 'Photo approved successfully.',
      data: {
        attendee: updated,
        finalConfirmation,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/verification/reject - reject a photo with reason
router.post('/reject', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { attendeeId, reason } = req.body;
    if (!attendeeId || !reason) {
      return res.status(400).json({ success: false, message: 'Attendee ID and reason are required.' });
    }

    const attendee = await Attendee.findById(attendeeId).select('event photoVerificationStatus');
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }

    if (!(await hasEventAccess(req.user, attendee.event))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this attendee.' });
    }

    const updated = await Attendee.findByIdAndUpdate(
      attendeeId,
      {
        photoVerificationStatus: 'rejected',
        photoVerifiedBy: req.user._id,
        photoVerifiedAt: new Date(),
        photoRejectionReason: reason,
      },
      { new: true },
    ).populate('event').select('_id fullName email photoVerificationStatus photoRejectionReason resubmitToken order event phone');

    await notifyPhotoRejectionNotification({
      attendee: updated,
      event: updated.event,
      reason,
    }).catch((error) => {
      console.error('PHOTO REJECTION NOTIFY ERROR:', error);
    });

    res.json({ success: true, message: 'Photo rejected successfully.', data: { attendee: updated } });
  } catch (err) {
    next(err);
  }
});

// GET /api/verification/stats - get verification stats by status
router.get('/stats', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { eventId } = req.query;
    if (!eventId || eventId === 'undefined' || eventId === '') {
      return res.status(400).json({ success: false, message: 'eventId is required.' });
    }

    if (!(await hasEventAccess(req.user, eventId))) {
      return res.status(403).json({ success: false, message: 'You do not have access to this event.' });
    }

    const stats = await Attendee.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(eventId), isActive: true } },
      {
        $group: {
          _id: '$photoVerificationStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      pending: 0,
      verified: 0,
      rejected: 0,
    };

    stats.forEach((stat) => {
      if (stat._id) result[stat._id] = stat.count;
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/verification/cleanup-s3 - trigger manual S3 cleanup (admin only)
router.post('/cleanup-s3', protect, requirePermission('canVerifyPhotos'), async (req, res, next) => {
  try {
    const { ageInDays = 90 } = req.body;

    // Only allow admin to trigger cleanup
    if (req.user.role !== 'main_admin') {
      return res.status(403).json({ success: false, message: 'Only admins can trigger S3 cleanup.' });
    }

    if (ageInDays < 30 || ageInDays > 365) {
      return res.status(400).json({ success: false, message: 'Age must be between 30 and 365 days.' });
    }

    const result = await triggerCleanupNow(ageInDays);

    res.json({
      success: true,
      message: `S3 cleanup completed: ${result.deleted} deleted, ${result.failed} failed`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
