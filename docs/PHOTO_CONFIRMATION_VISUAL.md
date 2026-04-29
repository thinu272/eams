# [Icon: Ticket] Photo Confirmation Feature - Visual Reference

## [Icon: Play] User Interface Walkthrough

### Before (Without Photo Confirmation)
```
┌─────────────────────────────────────┐
│  Buyer Confirmation Portal          │
│  Order #ORD-12345                   │
├─────────────────────────────────────┤
│                                     │
│  VIP Ticket #TK001   [PENDING]      │
│  ─────────────────────────────────  │
│  [Assign Myself]  [Send Invite]     │
│                                     │
│  Standard Ticket #TK002 [PENDING]   │
│  ─────────────────────────────────  │
│  [Assign Myself]  [Send Invite]     │
│                                     │
└─────────────────────────────────────┘
```

### After (With Photo Confirmation)
```
┌─────────────────────────────────────┐
│  Buyer Confirmation Portal          │
│  Order #ORD-12345                   │
├─────────────────────────────────────┤
│                                     │
│  VIP Ticket #TK001   [ASSIGNED ✓]   │
│  ─────────────────────────────────  │
│  [[Icon: Camera]] John Doe         [Icon: Camera] pending    │
│      john@example.com                │
│                                     │
│  Standard Ticket #TK002 [PENDING]   │
│  ─────────────────────────────────  │
│  [Assign Myself]  [Send Invite]     │
│                                     │
└─────────────────────────────────────┘
```

---

## [Icon: Document] Modal Form Evolution

### Assign Myself Modal - Before
```
┌──────────────────────────────┐
│ Assign Ticket to Yourself    │
├──────────────────────────────┤
│                              │
│ Full Name *                  │
│ [________________________]    │
│                              │
│ Email Address *              │
│ [________________________]    │
│                              │
│ Date of Birth                │
│ [________________________]    │
│                              │
│ National ID / NIC            │
│ [________________________]    │
│                              │
│ Passport Number              │
│ [________________________]    │
│                              │
│ [Cancel]  [Assign Ticket]    │
│                              │
└──────────────────────────────┘
```

### Assign Myself Modal - After (WITH PHOTO) [Icon: Feature]
```
┌──────────────────────────────┐
│ Assign Ticket to Yourself    │
├──────────────────────────────┤
│                              │
│ Full Name *                  │
│ [________________________]    │
│                              │
│ Email Address *              │
│ [________________________]    │
│                              │
│ Date of Birth                │
│ [________________________]    │
│                              │
│ National ID / NIC            │
│ [________________________]    │
│                              │
│ Passport Number              │
│ [________________________]    │
│                              │
│ [Icon: Feature] Your Photo (Optional)     │
│ ┌──────────────────────────┐ │
│ │ [Choose File] [Browse]   │ │
│ └──────────────────────────┘ │
│                              │
│ Photo Preview:               │
│ ┌──────────────────────────┐ │
│ │      [[Icon: Camera] Photo]        ✕ │ │
│ │      Shows uploaded     │ │
│ │      image preview      │ │
│ └──────────────────────────┘ │
│                              │
│ [Icon: Camera] Clear face photo rec.     │
│                              │
│ [Cancel]  [Assign Ticket]    │
│                              │
└──────────────────────────────┘
```

---

## [Icon: Refresh] Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  BUYER CONFIRMATION PORTAL (Frontend)                        │
│  /confirmation/{token}                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User clicks "Assign Myself"                             │
│     │                                                        │
│     ▼                                                        │
│  2. Modal opens with form + PHOTO INPUT [Icon: Feature]                  │
│     │                                                        │
│     ├─ Full Name input                                      │
│     ├─ Email input                                          │
│     ├─ DOB input                                            │
│     ├─ ID input                                             │
│     ├─ Passport input                                       │
│     └─ PHOTO FILE INPUT [Icon: Feature] ← NEW FEATURE                    │
│           │                                                 │
│           ▼                                                 │
│     3. User selects photo file                              │
│           │                                                 │
│           ▼                                                 │
│     4. Photo preview displays [Icon: Feature] ← NEW                       │
│           │                                                 │
│           ▼                                                 │
│     5. User clicks "Assign Ticket"                          │
│           │                                                 │
│           ▼───────────────────────────────────┐             │
│           FormData Created:                    │             │
│           ├─ ticketId                         │             │
│           ├─ fullName                         │             │
│           ├─ email                            │             │
│           ├─ dateOfBirth                      │             │
│           ├─ nationalId                       │             │
│           ├─ passportNumber                   │             │
│           └─ photo (File object) [Icon: Feature] ← NEW     │             │
│                                               │             │
│           POST /api/tickets/assign ────────────┤             │
└─────────────────────────────────────────────────|─────────────┘
                                                 │
                                                 ▼
                        ┌─────────────────────────────────────┐
                        │  EXPRESS BACKEND (Node.js)          │
                        │  /api/tickets/assign               │
                        ├─────────────────────────────────────┤
                        │                                     │
                        │  6. Multer middleware processes    │
                        │     ├─ Validate file type (jpg/...) │
                        │     ├─ Validate file size (<5MB)   │
                        │     └─ Save to /uploads/ [Icon: Feature] ← NEW   │
                        │           {unique_filename}         │
                        │                                     │
                        │  7. Create Attendee record         │
                        │     ├─ Save all form fields        │
                        │     ├─ Save photo path [Icon: Feature] ← NEW     │
                        │     │   "uploads/{filename}"        │
                        │     └─ Generate QR token           │
                        │                                     │
                        │  8. Return response                │
                        │     └─ Include photo path [Icon: Feature] ← NEW  │
                        │                                     │
                        └─────┬───────────────────────────────┘
                              │
                              ├─────────────────────────┐
                              │                         │
                              ▼                         ▼
                    ┌──────────────────┐   ┌──────────────────┐
                    │   MongoDB Store  │   │  File System     │
                    │                  │   │  /uploads/       │
                    │  Attendee:       │   │                  │
                    │  ├─ photo:       │   │  photo-123-abc   │
                    │  │  "uploads/..." │   │  photo-456-def   │
                    │  ├─ verified:    │   │  photo-789-ghi   │
                    │  │  "pending" [Icon: Feature] │   │  ...             │
                    │  └─ ...          │   │                  │
                    │                  │   │                  │
                    └──────────────────┘   └──────────────────┘
                              ▲
                              │
                              └──────────────┐
                                            │
                        ┌───────────────────┤
                        │ Response:         │
                        │ {                │
                        │   success: true, │
                        │   data: {        │
                        │     attendee: {  │
                        │       photo:     │
                        │       "uploads.."│
                        │   }              │
                        │ }                │
                        │               [Icon: Feature] │
                        └───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND - Display Photo [Icon: Feature] (NEW)                           │
│                                                              │
│  Ticket Card:                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ VIP Ticket #TK001              [ASSIGNED ✓]          │  │
│  │ ───────────────────────────────────────────────────  │  │
│  │ [[Icon: Camera]] John Doe                  [Icon: Camera] pending             │  │
│  │      john@example.com           [Icon: Feature] PHOTO SHOWN        │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## [Icon: Stats] Component Architecture

```
ConfirmOrderPage (Main Component)
├── State Management
│   ├── data (order, tickets, attendees)
│   ├── assignForm
│   │   ├─ fullName
│   │   ├─ email
│   │   ├─ dateOfBirth
│   │   ├─ nationalId
│   │   ├─ passportNumber
│   │   └─ photo ✨ NEW
│   ├─ photoPreview ✨ NEW
│   └─ assignErrors
│
├── Components
│   ├── Header Section
│   ├── Progress Bar
│   ├── Order Summary
│   │   └─ Buyer Information Grid
│   ├── Tickets Grid
│   │   ├── Ticket Card
│   │   │   ├─ Status Badge
│   │   │   └─ Attendee Info + Photo ✨ NEW
│   │   │       └─ Photo Thumbnail ✨ NEW
│   │   │       └─ Photo Status Badge ✨ NEW
│   │   └─ Action Buttons
│   │       ├─ Assign Myself → Opens Modal
│   │       └─ Send Invite
│   │
│   └── AssignModal ✨ ENHANCED
│       ├─ Form Inputs (5 fields)
│       └─ Photo Upload Section ✨ NEW
│           ├─ File Input
│           ├─ Photo Preview ✨ NEW
│           └─ Remove Button ✨ NEW
│
└── API Calls
    ├─ getOrderByToken (GET)
    ├─ assignTicket (POST with FormData) ✨ ENHANCED
    └─ inviteTicket (POST)
```

---

## [Icon: Security] Security Layers

```
                    USER INPUT
                       │
                       ▼
        ┌─────────────────────────────┐
        │  CLIENT-SIDE VALIDATION     │
        │  ───────────────────────── │
        │  ✓ File input filter        │
        │    (accept="image/...")     │
        │  ✓ File size check          │
        │    (< 5MB toast warning)    │
        │  ✓ File type check          │
        │    (jpg/png only)           │
        └────────┬────────────────────┘
                 │ FormData
                 ▼
        ┌─────────────────────────────┐
        │  NETWORK LAYER              │
        │  ───────────────────────── │
        │  ✓ HTTPS (production)       │
        │  ✓ CORS checks              │
        │  ✓ Auth headers             │
        │  ✓ multipart/form-data      │
        └────────┬────────────────────┘
                 │ POST /tickets/assign
                 ▼
        ┌─────────────────────────────┐
        │  MULTER MIDDLEWARE          │
        │  ───────────────────────── │
        │  ✓ File size limit (5MB)    │
        │  ✓ File extension check     │
        │  ✓ MIME type validation     │
        │  ✓ Unique filename gen      │
        └────────┬────────────────────┘
                 │ File validated
                 ▼
        ┌─────────────────────────────┐
        │  FILE STORAGE               │
        │  ───────────────────────── │
        │  ✓ /uploads/ directory      │
        │  ✓ 755 permissions          │
        │  ✓ Outside web root         │
        │  ✓ Unique names only        │
        └────────┬────────────────────┘
                 │ File saved
                 ▼
        ┌─────────────────────────────┐
        │  DATABASE STORAGE           │
        │  ───────────────────────── │
        │  ✓ Relative path stored     │
        │  ✓ Linked to Attendee ID    │
        │  ✓ Verification status      │
        │  ✓ Audit trail fields       │
        └────────┬────────────────────┘
                 │ Data persisted
                 ▼
        ┌─────────────────────────────┐
        │  API RESPONSE               │
        │  ───────────────────────── │
        │  ✓ Photo path returned      │
        │  ✓ Status set to ASSIGNED   │
        │  ✓ Success confirmation     │
        └────────┬────────────────────┘
                 │ Response
                 ▼
        ┌─────────────────────────────┐
        │  FRONTEND DISPLAY           │
        │  ───────────────────────── │
        │  ✓ Photo URL constructed    │
        │  ✓ Thumbnail displayed      │
        │  ✓ Status badge shown       │
        │  ✓ Error handling           │
        └─────────────────────────────┘
```

---

## [Icon: Stats] Database Schema

### Before
```
Attendee Document
{
  _id: ObjectId,
  fullName: String,
  email: String,
  dateOfBirth: Date,
  nationalId: String,
  passportNumber: String,
  order: ObjectId (ref: Order),
  event: ObjectId (ref: Event),
  ticket: ObjectId (ref: Ticket),
  confirmationStatus: String,
  confirmedAt: Date,
  qrCode: String,
  qrToken: String
  // ... other fields
}
```

### After (WITH PHOTO) ✨
```
Attendee Document
{
  _id: ObjectId,
  fullName: String,
  email: String,
  dateOfBirth: Date,
  nationalId: String,
  passportNumber: String,
  photo: String ✨ NEW (path: "uploads/...")
  photoVerificationStatus: String ✨ NEW (pending/verified/rejected)
  photoVerifiedBy: ObjectId ✨ NEW (ref: User),
  photoVerifiedAt: Date ✨ NEW,
  order: ObjectId (ref: Order),
  event: ObjectId (ref: Event),
  ticket: ObjectId (ref: Ticket),
  confirmationStatus: String,
  confirmedAt: Date,
  qrCode: String,
  qrToken: String
  // ... other fields
}
```

---

## [Icon: Package] API Request/Response Examples

### Request (With Photo)
```
POST /api/tickets/assign
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="ticketId"

507f1f77bcf86cd799439011
------FormBoundary
Content-Disposition: form-data; name="fullName"

John Doe
------FormBoundary
Content-Disposition: form-data; name="email"

john@example.com
------FormBoundary
Content-Disposition: form-data; name="dateOfBirth"

1990-01-01
------FormBoundary
Content-Disposition: form-data; name="photo"; filename="photo.jpg"
Content-Type: image/jpeg

[Binary photo data... 256KB]
------FormBoundary--
```

### Response (Success)
```json
{
  "success": true,
  "message": "Ticket assigned successfully",
  "data": {
    "attendee": {
      "_id": "507f1f77bcf86cd799439012",
      "fullName": "John Doe",
      "email": "john@example.com",
      "photo": "uploads/photo-1234567890-abcdef",
      "photoVerificationStatus": "pending",
      "confirmationStatus": "confirmed",
      "qrToken": "uuid-token-here"
    },
    "ticket": {
      "_id": "507f1f77bcf86cd799439011",
      "status": "ASSIGNED",
      "categoryName": "VIP",
      "ticketNumber": "TK001"
    }
  }
}
```

### Response (File Too Large)
```json
{
  "success": false,
  "message": "Photo file is too large. Maximum size is 5MB."
}
```

---

## [Icon: Rocket] Deployment Architecture

```
Production Environment:
┌─────────────────────────────────────────────────┐
│  WEB SERVER (nginx/Apache)                      │
├─────────────────────────────────────────────────┤
│  - Reverse proxy to Node.js backend             │
│  - Serves static files (/uploads)               │
│  - Handles SSL/TLS                              │
└────────────┬────────────────────────────────────┘
             │
             ├─────────────────────┬──────────────┐
             │                     │              │
             ▼                     ▼              ▼
    ┌───────────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Express Backend  │  │   MongoDB    │  │   Storage    │
    │  PORT: 5000       │  │   Database   │  │  /uploads/   │
    │  - API endpoints  │  │  - Attendees │  │  - Photos    │
    │  - Multer upload  │  │  - Tickets   │  │  - Backups   │
    │  - File handling  │  │  - Orders    │  │              │
    └───────────────────┘  └──────────────┘  └──────────────┘
             ▲
             │
    ┌────────┴───────────────┐
    │  Frontend (React)      │
    │  http://domain.com     │
    │  ├─ ConfirmOrderPage  │
    │  ├─ Photo Upload UI    │
    │  └─ Ticket Display    │
    └───────────────────────┘
```

---

## [Icon: Feature] Summary

The Photo Confirmation Feature has been successfully implemented with:

[Icon: Success] **Backend**: Multer integration for file upload and validation
[Icon: Success] **Frontend**: Photo input, preview, and display components
[Icon: Success] **Database**: Photo storage with verification status tracking
[Icon: Success] **Security**: Multiple validation layers and file restrictions
[Icon: Success] **Documentation**: Comprehensive guides and test scripts
[Icon: Success] **Testing**: Automated test script and verification checklist

**Ready for Production Deployment** [Icon: Rocket]
