/**
 * AWS S3 Configuration and Image Storage Service
 */

const AWS = require('aws-sdk');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const hasS3Config = () => !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET
);

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'entrynex-photos';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
const LOCAL_UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

const ensureLocalDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const saveImageLocally = async (fileBuffer, filename, category = 'attendee-photos') => {
  const compressedBuffer = await sharp(fileBuffer)
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();

  const uniqueId = uuidv4();
  const key = `${category}/${Date.now()}-${uniqueId}.jpg`;
  const absolutePath = path.join(LOCAL_UPLOAD_ROOT, key);
  await ensureLocalDir(path.dirname(absolutePath));
  await fs.promises.writeFile(absolutePath, compressedBuffer);

  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return {
    key: null,
    url: `${backendUrl}/uploads/${key.replace(/\\/g, '/')}`,
    bucket: 'local',
    storage: 'local',
    localPath: absolutePath,
  };
};

/**
 * Upload and compress image to S3 or local disk fallback
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {string} category - Upload category (e.g., 'attendee-photos')
 * @returns {Promise<{key: String|null, url: String}>}
 */
const uploadImageToS3 = async (fileBuffer, filename, category = 'attendee-photos') => {
  try {
    if (!hasS3Config()) {
      return saveImageLocally(fileBuffer, filename, category);
    }

    // Compress image using sharp
    const compressedBuffer = await sharp(fileBuffer)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const uniqueId = uuidv4();
    const key = `${category}/${Date.now()}-${uniqueId}.jpg`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: compressedBuffer,
      ContentType: 'image/jpeg',
      ACL: 'private',
      Metadata: {
        'original-filename': filename,
        'upload-timestamp': new Date().toISOString(),
      },
      CacheControl: 'max-age=2592000, public',
    };

    const uploadResult = await s3.upload(params).promise();

    return {
      key: uploadResult.Key,
      url: uploadResult.Location,
      bucket: uploadResult.Bucket,
      storage: 's3',
    };
  } catch (err) {
    console.error('S3 upload error:', err);
    if (!hasS3Config()) {
      return saveImageLocally(fileBuffer, filename, category);
    }
    throw new Error(`Failed to upload image to S3: ${err.message}`);
  }
};

/**
 * Generate signed URL for private S3 object
 * @param {string} s3Key - S3 object key
 * @param {number} expirySeconds - URL expiry time in seconds (default: 1 hour)
 * @returns {Promise<String>} Signed URL
 */
const getSignedUrl = async (s3Key, expirySeconds = SIGNED_URL_EXPIRY) => {
  try {
    if (!s3Key) return null;

    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Expires: expirySeconds,
    };

    return s3.getSignedUrl('getObject', params);
  } catch (err) {
    console.error('Signed URL generation error:', err);
    throw new Error(`Failed to generate signed URL: ${err.message}`);
  }
};

/**
 * Delete image from S3 or local disk
 * @param {string} s3Key - S3 object key
 * @returns {Promise<void>}
 */
const deleteImageFromS3 = async (s3Key) => {
  try {
    if (!s3Key) return;

    if (!hasS3Config()) {
      const localPath = path.join(LOCAL_UPLOAD_ROOT, s3Key);
      await fs.promises.unlink(localPath).catch(() => null);
      return;
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
    };

    await s3.deleteObject(params).promise();
    console.log(`Deleted S3 object: ${s3Key}`);
  } catch (err) {
    console.error('S3 delete error:', err);
    throw new Error(`Failed to delete image from S3: ${err.message}`);
  }
};

const deleteImagesFromS3 = async (s3Keys) => {
  if (!s3Keys || s3Keys.length === 0) return;

  try {
    if (!hasS3Config()) {
      await Promise.all(s3Keys.map((key) => deleteImageFromS3(key)));
      return;
    }

    const params = {
      Bucket: BUCKET_NAME,
      Delete: {
        Objects: s3Keys.map((key) => ({ Key: key })),
      },
    };

    await s3.deleteObjects(params).promise();
    console.log(`Deleted ${s3Keys.length} S3 objects`);
  } catch (err) {
    console.error('S3 batch delete error:', err);
    throw new Error(`Failed to delete images from S3: ${err.message}`);
  }
};

const getOldImagesInS3 = async (ageInDays = 30, prefix = 'attendee-photos/') => {
  try {
    if (!hasS3Config()) return [];

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ageInDays);

    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    };

    const results = [];
    let continuationToken;

    do {
      if (continuationToken) {
        params.ContinuationToken = continuationToken;
      }

      const listResult = await s3.listObjectsV2(params).promise();

      if (listResult.Contents) {
        listResult.Contents.forEach((obj) => {
          if (obj.LastModified < cutoffDate) {
            results.push(obj);
          }
        });
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return results;
  } catch (err) {
    console.error('S3 list error:', err);
    throw new Error(`Failed to list objects from S3: ${err.message}`);
  }
};

const cleanupOldImages = async (ageInDays = 90) => {
  try {
    if (!hasS3Config()) {
      return { deleted: 0, failed: 0 };
    }

    console.log(`Starting S3 cleanup: removing images older than ${ageInDays} days`);

    const oldImages = await getOldImagesInS3(ageInDays);
    const keysToDelete = oldImages.map((obj) => obj.Key);

    if (keysToDelete.length === 0) {
      console.log('No old images found for cleanup');
      return { deleted: 0, failed: 0 };
    }

    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < keysToDelete.length; i += 1000) {
      const batch = keysToDelete.slice(i, i + 1000);
      try {
        await deleteImagesFromS3(batch);
        deleted += batch.length;
      } catch (err) {
        console.error(`Failed to delete batch: ${err.message}`);
        failed += batch.length;
      }
    }

    console.log(`Cleanup complete: deleted=${deleted}, failed=${failed}`);
    return { deleted, failed };
  } catch (err) {
    console.error('Cleanup error:', err);
    throw err;
  }
};

const getPublicUrl = (s3Key) => {
  return `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
};

module.exports = {
  s3,
  uploadImageToS3,
  getSignedUrl,
  deleteImageFromS3,
  deleteImagesFromS3,
  getOldImagesInS3,
  cleanupOldImages,
  getPublicUrl,
  BUCKET_NAME,
  SIGNED_URL_EXPIRY,
  hasS3Config,
};
