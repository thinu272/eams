/**
 * AWS S3 Setup Guide
 * 
 * This file provides setup instructions for implementing S3 image storage
 */

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PREREQUISITES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Install required npm packages:
  npm install aws-sdk sharp node-schedule

Required packages: aws-sdk, sharp, node-schedule

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. ENVIRONMENT VARIABLES (.env)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=eams-photos

Optional:
S3_CLEANUP_AGE_DAYS=90          (default: 90 days)
SKIP_S3_CLEANUP=false            (set to 'true' to disable auto-cleanup in dev)
NODE_ENV=production              (enable cleanup scheduler)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AWS S3 BUCKET POLICY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create a bucket policy to restrict public access:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::eams-photos/*",
        "arn:aws:s3:::eams-photos"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}

Block Public Access settings:
- Block all public access: ON
- Ignore all public ACLs: ON
- Block public ACLs: ON
- Block public bucket policies: ON
- Restrict public bucket policies: ON

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. IAM POLICY FOR BACKEND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create IAM user with S3 policy:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:ListBucketVersions"
      ],
      "Resource": [
        "arn:aws:s3:::eams-photos",
        "arn:aws:s3:::eams-photos/*"
      ]
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. FILE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files created:
  backend/src/services/s3Service.js       - S3 operations (upload, delete, cleanup)
  backend/src/middleware/s3Upload.js      - Multer middleware for S3 uploads
  backend/src/utils/s3Cleanup.js          - Scheduled cleanup task

Files modified:
  backend/src/models/Attendee.js          - Added photoS3Key, photoUploadedAt
  backend/src/routes/attendees.js         - Updated photo upload endpoints to use S3
  backend/src/routes/verification.js      - Added cleanup-s3 admin endpoint
  backend/src/server.js                   - Initialize cleanup scheduler

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Image Compression: Sharp reduces file size (quality: 85%, progressive JPEG)
✓ Private Access: S3 ACL set to 'private' - no public access by default
✓ Signed URLs: Optional support for temporary public access via signed URLs
✓ Auto-Cleanup: Scheduled job removes images older than 90 days (configurable)
✓ Batch Deletion: Efficiently handles bulk deletions (1000 items per batch)
✓ Old Photo Management: Automatically deletes old photo when resubmitting
✓ Error Handling: Graceful fallback if S3 operations fail

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. API ENDPOINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Existing endpoints (updated to use S3):
  POST /api/attendees/confirm/:token        - Confirm identity + photo upload
  POST /api/attendees/resubmit/photo        - Resubmit rejected photo

New admin endpoint:
  POST /api/verification/cleanup-s3         - Trigger manual S3 cleanup
  
  Body: { ageInDays: 90 }  (30-365 range)
  Response: { deleted: number, failed: number }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. USAGE EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Upload photo (automatic S3 + compression):
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('token', resubmitToken);
  const response = await fetch('/api/attendees/resubmit/photo', {
    method: 'POST',
    body: formData
  });

Get signed URL (optional - for temporary access):
  import { getSignedUrl } from './services/s3Service';
  const signedUrl = await getSignedUrl(s3Key, 3600); // 1 hour expiry

Manual cleanup (admin):
  curl -X POST http://localhost:5000/api/verification/cleanup-s3 \
    -H "Authorization: Bearer TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"ageInDays": 90}'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. CLEANUP SCHEDULER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Runs daily at: 2:00 AM UTC (configurable in s3Cleanup.js)

Automatically deletes images:
  - Older than 90 days (or S3_CLEANUP_AGE_DAYS env var)
  - From 'attendee-photos/' folder
  - In batches of 1000 to stay within AWS limits

Logs output:
  [S3 Cleanup] Starting scheduled cleanup...
  [S3 Cleanup] Completed: 150 deleted, 0 failed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. SECURITY NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Private S3 bucket: No public read access
✓ IAM restricted: Only backend service can access
✓ HTTPS enforced: Bucket policy requires SSL/TLS
✓ Signed URLs: Optional temp access with expiration
✓ Meta tracking: Original filename stored for audit
✓ Compression: Images reduced in size for efficiency
✓ No local storage: Files don't remain on server

*/
