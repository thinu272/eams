const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Attendee = require('../models/Attendee');
const Order = require('../models/Order');
const Event = require('../models/Event');
const { notifyPhotoRejectionNotification, notifyStatusChange } = require('../services/notificationService');

const listPendingPhotos = async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const filter = { photoVerificationStatus: { $in: ['pending', 'Pending'] } };
    if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
      filter.event = eventId;
    }

    const attendees = await Attendee.find(filter)
      .populate('event', 'name startDate venue')
      .populate('order', 'buyerName buyerEmail buyerPhone orderNumber')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { attendees } });
  } catch (err) { next(err); }
};

const verifyPhoto = async (req, res, next) => {
  try {
    const { attendeeId, status, reason } = req.body;
    if (!attendeeId || !mongoose.Types.ObjectId.isValid(attendeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid attendeeId.' });
    }
    const normalized = String(status || '').toLowerCase();
    if (!['verified', 'rejected'].includes(normalized)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected.' });
    }

    const attendee = await Attendee.findById(attendeeId).populate('event').populate('order');
    if (!attendee) return res.status(404).json({ success: false, message: 'Attendee not found.' });

    attendee.photoVerificationStatus = normalized;
    attendee.photoRejectionReason = normalized === 'rejected' ? (reason || 'Rejected') : null;
    attendee.photoVerifiedBy = req.user._id;
    attendee.photoVerifiedAt = new Date();
    attendee.verifiedBy = req.user._id;
    attendee.verifiedAt = new Date();

    if (normalized === 'rejected') {
      attendee.resubmitToken = attendee.resubmitToken || uuidv4();
    }

    await attendee.save();

    if (normalized === 'rejected') {
      await notifyPhotoRejectionNotification({
        attendee,
        event: attendee.event,
        reason: attendee.photoRejectionReason,
      });
    } else {
      await notifyStatusChange({
        attendee,
        event: attendee.event,
        status: 'Photo Verified',
        message: 'Your photo has been verified successfully.',
      });
    }

    res.json({ success: true, data: { attendee } });
  } catch (err) { next(err); }
};

const resubmitPhoto = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required.' });

    const attendee = await Attendee.findOne({ resubmitToken: token }).populate('event');
    if (!attendee) return res.status(404).json({ success: false, message: 'Invalid token.' });
    if (!req.s3Data) return res.status(400).json({ success: false, message: 'Photo is required.' });

    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    attendee.photoVerificationStatus = 'pending';
    attendee.photoRejectionReason = null;
    attendee.photoVerifiedBy = null;
    attendee.photoVerifiedAt = null;
    attendee.verifiedBy = null;
    attendee.verifiedAt = null;
    attendee.resubmitCount = (attendee.resubmitCount || 0) + 1;

    await attendee.save();

    res.json({ success: true, message: 'Photo resubmitted successfully.', data: { attendee } });
  } catch (err) { next(err); }
};

module.exports = {
  listPendingPhotos,
  verifyPhoto,
  resubmitPhoto,
};
