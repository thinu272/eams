/**
 * Multer middleware for S3 uploads
 * Handles file validation before sending to S3
 */

const multer = require('multer');
const { uploadImageToS3 } = require('../services/s3Service');

// Memory storage for S3 upload (don't save to disk)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only JPG and PNG files are allowed'));
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return cb(new Error('File size exceeds 5MB limit'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Specialized filter for Excel/CSV bulk uploads
const excelFileFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/octet-stream' // fallback for some browsers
  ];

  if (!allowed.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
    return cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'));
  }

  cb(null, true);
};

const excelUpload = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for larger sheets
  },
});

/**
 * Middleware to handle S3 upload after multer processing
 * Attaches s3Data to req for use in route handlers
 */
const handleS3Upload = (category = 'attendee-photos') => {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        return next();
      }

      // Validate file
      const minSize = 50 * 1024; // 50KB
      if (req.file.size < minSize) {
        return res.status(400).json({
          success: false,
          message: 'File size too small (minimum 50KB)',
        });
      }

      // Upload to S3
      const s3Data = await uploadImageToS3(
        req.file.buffer,
        req.file.originalname,
        category,
      );

      // Attach S3 data to request
      req.s3Data = s3Data;

      next();
    } catch (err) {
      console.error('S3 upload middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image to S3',
        error: err.message,
      });
    }
  };
};

module.exports = {
  upload,
  excelUpload,
  handleS3Upload,
};
