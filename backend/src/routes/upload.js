const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { upload, handleS3Upload } = require('../middleware/s3Upload');
const { deleteImageFromS3 } = require('../services/s3Service');
const User = require('../models/User');
const Attendee = require('../models/Attendee');

/**
 * POST /api/upload/profile-photo
 * Uploads and sets the profile photo for the authenticated user.
 */
router.post('/profile-photo', protect, upload.single('photo'), handleS3Upload('profile-photos'), async (req, res) => {
  try {
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }

    const user = await User.findById(req.user._id);
    
    // Delete old photo from S3 if exists
    if (user.profilePhotoS3Key) {
      await deleteImageFromS3(user.profilePhotoS3Key).catch(err => {
        console.error('Failed to delete old profile photo:', err);
      });
    }

    // Update user with new photo data
    user.profilePhoto = req.s3Data.url;
    user.profilePhotoS3Key = req.s3Data.key;
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        url: user.profilePhoto,
        key: user.profilePhotoS3Key
      }
    });
  } catch (error) {
    console.error('PROFILE UPLOAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

/**
 * POST /api/upload/attendee-photo/:token
 * Public endpoint for attendees to upload their face photo during confirmation.
 */
router.post('/attendee-photo/:token', upload.single('photo'), handleS3Upload('attendee-photos'), async (req, res) => {
  try {
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'Photo is required' });
    }

    const attendee = await Attendee.findOne({ confirmationToken: req.params.token });
    if (!attendee) {
      // Cleanup the uploaded photo if attendee not found
      await deleteImageFromS3(req.s3Data.key).catch(console.error);
      return res.status(404).json({ success: false, message: 'Invalid confirmation token' });
    }

    // Delete old photo from S3 if exists
    if (attendee.photoS3Key) {
      await deleteImageFromS3(attendee.photoS3Key).catch(console.error);
    }

    // Update attendee with new photo data
    attendee.photo = req.s3Data.url;
    attendee.photoS3Key = req.s3Data.key;
    attendee.photoUploadedAt = new Date();
    await attendee.save();

    res.json({
      success: true,
      message: 'Attendee photo uploaded successfully',
      data: {
        url: attendee.photo,
        key: attendee.photoS3Key
      }
    });
  } catch (error) {
    console.error('ATTENDEE UPLOAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

/**
 * POST /api/upload/system-asset
 * Endpoint for super admins to upload logos, favicons, etc.
 */
router.post('/system-asset', protect, upload.single('photo'), handleS3Upload('system-assets'), async (req, res) => {
  try {
    if (!req.s3Data) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }

    res.json({
      success: true,
      message: 'System asset uploaded successfully',
      data: {
        url: req.s3Data.url,
        key: req.s3Data.key
      }
    });
  } catch (error) {
    console.error('SYSTEM ASSET UPLOAD ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
});

module.exports = router;
