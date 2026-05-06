# Attendee Photo Verification Guide

This guide documents the end-to-end workflow for attendee photo submission, storage, and verification within the EAMS platform.

---

## 1. Overview
The photo verification system ensures that every ticket is assigned to a unique, identifiable individual. This process involves three main stages:
1. **Submission**: Attendee uploads a photo during ticket assignment.
2. **Review**: Organisers or Volunteers review the photo via the dashboard.
3. **Approval**: Once approved, a secure QR ticket is generated and sent to the attendee.

---

## 2. Technical Architecture

### Cloud Storage (AWS S3)
Unlike previous versions, photos are no longer stored on the local server disk.
- **Service**: AWS S3 (or any S3-compatible provider).
- **Upload Flow**: Frontend → Backend (Multer-S3) → S3 Bucket.
- **Access**: Photos are accessed via Signed URLs or public S3 links, depending on privacy settings.
- **Cleanup**: Orphaned photos from cancelled assignments are automatically purged by the `s3Cleanup.js` scheduler.

### Verification Logic
- **Pending Status**: Every new photo starts with a `pending` verification status.
- **AI-Ready Hooks**: The system includes hooks for automated face detection and similarity scoring against ID documents.
- **Manual Override**: Organisers can manually approve or reject photos if they are blurry or incorrect.

---

## 3. Communication & Notifications

The system uses a **decoupled notification engine** to ensure that verification updates reach the attendee immediately.

- **On Approval**: The system triggers both an **Email** (with PDF ticket) and an **SMS** (with confirmation link).
- **On Rejection**: The attendee receives a notification with a **Resubmission Link**, allowing them to upload a new photo without needing to re-purchase.
- **Forced Sync**: Organiser approvals bypass "already sent" flags to ensure the latest ticket is always delivered.

---

## 4. UI/UX Workflow

### Attendee Experience
1. **Assignment**: During the "Confirm Identity" phase, a photo upload field is presented.
2. **Preview**: Users can preview and crop their photo before final submission.
3. **Status Tracking**: Attendees can check their verification status via their private portal.

### Organiser Experience
1. **Dashboard**: Navigate to **Attendees > Photo Verification**.
2. **Queue**: View a gallery of all pending photos.
3. **Action**: Click **Approve** (Green) or **Reject** (Red).
4. **Broadcast**: Approval actions broadcast real-time updates to connected staff dashboards.

---

## 5. Security & Validation
- **Formats**: Restricted to `JPG`, `JPEG`, and `PNG`.
- **File Size**: Capped at 5MB per photo.
- **Integrity**: Unique S3 keys prevent asset overwriting.
- **Privacy**: Photo access is restricted to authorised organisers and gate staff.
