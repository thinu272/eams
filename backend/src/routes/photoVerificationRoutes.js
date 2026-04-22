const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const { upload, handleS3Upload } = require('../middleware/s3Upload');
const {
  listPendingPhotos,
  verifyPhoto,
  resubmitPhoto,
} = require('../controllers/photoVerificationController');

const router = express.Router();

router.get('/pending-photos', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser'), listPendingPhotos);
router.post('/verify-photo', protect, restrictTo('main_admin', 'main_organiser', 'sub_organiser'), verifyPhoto);
router.post('/resubmit-photo/:token', upload.single('photo'), handleS3Upload('attendee-photos'), resubmitPhoto);

module.exports = router;
