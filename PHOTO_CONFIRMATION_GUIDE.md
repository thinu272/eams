# Photo Confirmation Feature Documentation

## Overview
The Photo Confirmation feature enables attendees to upload their photos during ticket assignment in the Buyer Confirmation Portal. Photos are used for identity verification at event entry points.

## Features

### 1. Photo Upload During Ticket Assignment
- **Location**: Buyer Confirmation Portal (`/confirmation/:token`)
- **When**: During the "Assign Myself" workflow
- **File Requirements**:
  - Format: JPG, JPEG, or PNG
  - Maximum size: 5MB
  - Recommended: Clear face photo for identification purposes

### 2. Photo Preview
- Instant preview of selected photo before submission
- Option to remove and re-upload
- Visual feedback with removal button

### 3. Photo Storage
- Photos stored in `/backend/uploads/` directory
- Unique filenames to prevent collisions
- File path saved in attendee record as: `uploads/{filename}`

### 4. Photo Display
- Photo displayed in ticket card after confirmation
- Shows photo thumbnail (48x48px) next to attendee name
- Photo verification status indicator

## Implementation Details

### Backend Changes

#### 1. **Multer Configuration** (`backend/src/routes/tickets.js`)
```javascript
const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});
```

#### 2. **POST /api/tickets/assign Endpoint**
- **New Middleware**: `upload.single('photo')`
- **File Handling**: 
  - Optional photo file in multipart form data
  - Stored path: `uploads/{filename}` in Attendee document
  - Works with or without photo (photo is optional)

#### 3. **Photo Error Handling**
- File size limit validation (5MB)
- File type validation (jpg/jpeg/png only)
- Multer error middleware for graceful error responses

### Frontend Changes

#### 1. **ConfirmOrderPage Component** (`frontend/src/pages/buyer/ConfirmOrderPage.jsx`)

**State Management**:
```javascript
const [assignForm, setAssignForm] = useState({
  fullName: '',
  email: '',
  dateOfBirth: '',
  nationalId: '',
  passportNumber: '',
  photo: null  // NEW
});
const [photoPreview, setPhotoPreview] = useState(null);  // NEW
```

**Photo Input Field**:
- File input with accept filter (image/jpeg, image/png)
- File size validation (5MB client-side)
- Preview display with image thumbnail
- Remove button to clear selection

**Form Submission**:
```javascript
// If photo exists, use FormData
if (assignForm.photo) {
  data = new FormData();
  // ... append all fields
  data.append('photo', assignForm.photo);
} else {
  // Use regular JSON for non-file data
  data = { ... };
}
```

#### 2. **Attendee Photo Display**
Photo displayed in ticket card:
```jsx
{ticket.attendee.photo && (
  <img
    src={`http://localhost:5000/${ticket.attendee.photo}`}
    alt={ticket.attendee.fullName}
    className="w-12 h-12 rounded-lg object-cover"
  />
)}
```

#### 3. **Axios Client Update** (`frontend/src/api/client.js`)
```javascript
// If data is FormData, let axios set the correct Content-Type
if (config.data instanceof FormData) {
  delete config.headers['Content-Type'];
}
```

## API Endpoints

### POST /api/tickets/assign

**Request** (with photo):
```
Content-Type: multipart/form-data

Body:
- ticketId: string (mongoDB ID)
- fullName: string (required)
- email: string (required)
- dateOfBirth: string (optional, ISO date)
- nationalId: string (optional)
- passportNumber: string (optional)
- photo: file (optional, jpg/jpeg/png, max 5MB)
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Ticket assigned successfully",
  "data": {
    "attendee": {
      "_id": "...",
      "fullName": "Test User",
      "email": "test@example.com",
      "photo": "uploads/abc123def",
      "photoVerificationStatus": "pending",
      ...
    },
    "ticket": {
      "_id": "...",
      "status": "ASSIGNED",
      "categoryName": "VIP",
      "ticketNumber": "TK001"
    }
  }
}
```

**Response** (File size error):
```json
{
  "success": false,
  "message": "Photo file is too large. Maximum size is 5MB."
}
```

## Database Schema

### Attendee Model Changes
```javascript
photo: {
  type: String,
  default: null  // Path: "uploads/{filename}"
},
photoVerificationStatus: {
  type: String,
  enum: ['pending', 'verified', 'rejected'],
  default: 'pending'
},
photoVerifiedBy: {
  type: ObjectId,
  ref: 'User',
  default: null
},
photoVerifiedAt: {
  type: Date,
  default: null
}
```

## File Structure

```
backend/
├── src/
│   ├── routes/
│   │   └── tickets.js (updated with photo middleware)
│   └── models/
│       └── Attendee.js (already has photo fields)
├── uploads/  (stores uploaded photos)
│   └── {unique_filename}
└── test_photo_confirmation.js (test script)

frontend/
├── src/
│   ├── pages/
│   │   └── buyer/
│   │       └── ConfirmOrderPage.jsx (updated with photo input)
│   └── api/
│       ├── client.js (updated for FormData support)
│       └── attendees.js (assignTicket function)
```

## Usage Workflow

### User Flow
1. Open Buyer Confirmation Portal with valid order token
2. Click "Assign Myself" button on pending ticket
3. Fill in identity information (Full Name, Email, etc.)
4. **NEW**: Select photo file from device
5. Preview photo (optional)
6. Click "Assign Ticket" button
7. Photo is uploaded and stored with attendee record
8. Ticket status changes to "ASSIGNED"
9. Photo and verification status displayed in ticket card

### Admin/Staff Flow (Future)
1. Access attendee entry verification system
2. Retrieve attendee photo from ticket QR code scan
3. Compare photo with ID document  
4. Update `photoVerificationStatus` to 'verified' or 'rejected'
5. Set `photoVerifiedBy` and `photoVerifiedAt` metadata

## Testing

### Manual Testing
1. Start backend server: `npm start` (in /backend)
2. Start frontend dev server: `npm start` (in /frontend)
3. Navigate to `/confirmation/{valid_token}`
4. Click "Assign Myself" on a PENDING ticket
5. Fill in details
6. Select a JPG/PNG image file
7. Submit form
8. Verify:
   - Photo preview was shown
   - Form submitted successfully
   - Photo thumbnail appears in ticket card
   - Photo path stored in MongoDB

### Automated Testing
Run the test script:
```bash
cd backend
node test_photo_confirmation.js
```

This script will:
1. Create a test image
2. Fetch an order and ticket
3. Upload photo with assignment
4. Verify photo storage
5. Report test results

## Error Handling

### Client-Side Errors
- File size validation: User sees toast notification if > 5MB
- File type validation: Input filter prevents non-image files from selection
- Network errors: Standard error handling with user-friendly messages

### Server-Side Errors
- Multer file size limit: Returns 400 with "Photo file is too large" message
- Invalid file type: Returns 400 with "Only image files are allowed" message
- Validation errors: Returns 400 with field-level error details
- Server errors: Returns 500 with generic error message

## Configuration

### Environment Variables
- `MAX_FILE_SIZE`: Maximum file upload size (default: 5MB)
- Set in `.env` or production config

### Multer Options
File destination, size limits, and filters can be configured in:
`backend/src/routes/tickets.js` (lines 13-25)

## Security Considerations

1. **File Type Validation**: Only JPG/JPEG/PNG accepted
2. **File Size Limit**: 5MB maximum
3. **Filename Randomization**: Multer generates unique filenames
4. **Access Control**: Photos accessible via attendance portal only (future: add auth checks)
5. **Storage**: Files stored outside web root (not directly accessible)

## Future Enhancements

1. **Photo Verification UI**: Interface for staff to verify/reject photos
2. **Automated Face Detection**: Flag photos without clear faces
3. **Photo Comparison**: Compare uploaded photo with ID document
4. **Compression**: Automatically compress large photos
5. **Cloud Storage**: Move uploads to S3/Cloud Storage
6. **Recapture**: Allow attendees to retake photos
7. **Photo History**: Track photo changes and verification history

## Troubleshooting

### Photo not uploading
- Check file size (must be < 5MB)
- Check file format (jpg/jpeg/png only)
- Verify `/uploads` directory exists and is writable
- Check server logs for detailed error

### Photo not showing after upload
- Verify Backend is serving static files from `/uploads`
- Check photo path in database record
- Verify photo file exists in filesystem
- Check browser network tab for image loading errors

### FormData errors
- Ensure axios client has Content-Type handling (see client.js)
- Verify backend multer middleware is properly configured
- Check that `upload.single('photo')` is before validation middleware

## References

- [Multer Documentation](https://github.com/expressjs/multer)
- [FormData API](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
- [Axios File Upload](https://github.com/axios/axios)
- [MongoDB File Storage Patterns](https://docs.mongodb.com/manual/faq/storage/)
