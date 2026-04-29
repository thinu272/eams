const AWS = require('aws-sdk');
const sharp = require('sharp');
const crypto = require('crypto');
const Attendee = require('../models/Attendee');

// Configure Rekognition
const rekognition = new AWS.Rekognition({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Validates an uploaded photo for ENTRYNEX standards
 * @param {Buffer} buffer - Image buffer
 * @param {String} eventId - Event ID for duplicate checking
 * @returns {Promise<Object>} - Validation results
 */
const validatePhoto = async (buffer, eventId) => {
  const results = {
    isValid: true,
    reason: null,
    metrics: {
      faceCount: 0,
      faceConfidence: 0,
      sharpness: 0,
      brightness: 0,
      isDuplicate: false,
    },
    hash: null,
  };

  try {
    // 1. CLARITY CHECK (Sharpness)
    // We use sharp to detect edges. Higher variance of Laplacian means sharper image.
    // Note: Sharp doesn't have a direct Laplacian, so we use a convolution kernel.
    const metadata = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    
    // Simple sharpness estimate based on edge detection convolution
    const laplacianKernel = {
      width: 3,
      height: 3,
      kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
    };
    
    // We'll use a simpler proxy for sharpness: average of color standard deviations
    const sharpness = stats.channels.reduce((acc, c) => acc + c.stdev, 0) / stats.channels.length;
    results.metrics.sharpness = sharpness;
    results.metrics.brightness = stats.channels.reduce((acc, c) => acc + c.mean, 0) / stats.channels.length;

    if (sharpness < 20) { // Threshold for "blurry"
      results.isValid = false;
      results.reason = 'IMAGE_BLURRY';
      return results;
    }

    // 2. DUPLICATE DETECTION
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    results.hash = hash;
    const existing = await Attendee.findOne({ event: eventId, photoHash: hash });
    if (existing) {
      results.isValid = false;
      results.reason = 'DUPLICATE_PHOTO';
      results.metrics.isDuplicate = true;
      return results;
    }

    // 3. FACE DETECTION (AWS Rekognition)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const params = {
        Image: { Bytes: buffer },
        Attributes: ['DEFAULT'],
      };

      const data = await rekognition.detectFaces(params).promise();
      const faceCount = data.FaceDetails.length;
      results.metrics.faceCount = faceCount;

      if (faceCount === 0) {
        results.isValid = false;
        results.reason = 'NO_FACE_DETECTED';
      } else if (faceCount > 1) {
        results.isValid = false;
        results.reason = 'MULTIPLE_FACES_DETECTED';
      } else {
        results.metrics.faceConfidence = data.FaceDetails[0].Confidence;
        if (results.metrics.faceConfidence < 80) {
          results.isValid = false;
          results.reason = 'LOW_FACE_CONFIDENCE';
        }
      }
    } else {
      console.warn('AWS Rekognition not configured. Skipping AI face detection.');
    }

    return results;
  } catch (error) {
    console.error('PHOTO VALIDATION ERROR:', error);
    // On error, we allow the photo but flag it for manual review
    results.isValid = true;
    results.reason = 'VALIDATION_FAILED_SYSTEM_ERROR';
    return results;
  }
};

module.exports = {
  validatePhoto,
};
