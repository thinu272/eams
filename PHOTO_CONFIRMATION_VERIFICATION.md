# Photo Confirmation Feature - Verification Checklist

## Pre-Launch Verification

### ✅ Backend Setup

- [ ] `/backend/uploads` directory exists
- [ ] Directory is writable (`chmod 755 backend/uploads` if needed)
- [ ] Multer package installed: `npm ls multer` shows version
- [ ] Server static file serving configured for `/uploads`

**Verification Command**:
```bash
cd backend
ls -la uploads/
npm start  # Should start without errors on port 5000
```

### ✅ Frontend Setup

- [ ] React app starts without errors: `npm start`
- [ ] Axios client properly configured
- [ ] FormData interceptor added to API client
- [ ] ConfirmOrderPage component loads without errors

**Verification Command**:
```bash
cd frontend
npm start  # Should start on port 3000
# Navigate to http://localhost:3000/
# Check browser console for no errors
```

### ✅ Database

- [ ] MongoDB running and accessible
- [ ] Attendee model has photo fields:
  ```bash
  # In MongoDB shell:
  db.attendees.findOne() | grep photo
  # Should show: photo, photoVerificationStatus, photoVerifiedBy, photoVerifiedAt
  ```
- [ ] Sample order and tickets exist for testing

**Verification Command**:
```bash
# In MongoDB:
db.attendees.findOne({photo: {$exists: true}})
# Or create test data first
```

### ✅ Code Changes

**Backend Files**:
- [ ] `backend/src/routes/tickets.js`
  - Line ~5: `const multer = require('multer');`
  - Line ~13-25: Multer upload configuration
  - Line ~28: `router.post('/assign', upload.single('photo'), [...`
  - Line ~68: `photo: req.file ? \`uploads/${req.file.filename}\` : undefined,`

**Frontend Files**:
- [ ] `frontend/src/pages/buyer/ConfirmOrderPage.jsx`
  - Line ~21-30: State includes `photo: null` and `photoPreview`
  - Line ~50: `FormData` usage when `assignForm.photo` exists
  - Line ~160-220: Photo input field in modal
  - Line ~280: Photo display in ticket card

**API Client**:
- [ ] `frontend/src/api/client.js`
  - Line ~15-18: FormData Content-Type handling

## 🧪 Functional Testing

### Test Case 1: Photo Upload (Without Photo)

**Steps**:
1. Open `http://localhost:3000/confirmation/{valid_token}`
2. Click "Assign Myself" button
3. Fill form without selecting photo
4. Click "Assign Ticket"

**Expected Results**:
- [ ] Form submits successfully
- [ ] Ticket status changes to ASSIGNED
- [ ] Attendee created without photo
- [ ] No errors in console

### Test Case 2: Photo Upload (With Photo)

**Steps**:
1. Open `http://localhost:3000/confirmation/{valid_token}`
2. Click "Assign Myself" button
3. Fill all form fields
4. Click "Choose File" and select a JPG/PNG image
5. Verify preview shows image
6. Click "Assign Ticket"

**Expected Results**:
- [ ] File input accepts jpg/png files
- [ ] Preview shows selected image
- [ ] Submit button still enabled
- [ ] Form submits successfully
- [ ] Backend returns 200 OK
- [ ] Response includes photo path
- [ ] Photo appears in ticket card (thumbnail)
- [ ] No errors in browser console
- [ ] No errors in server logs

### Test Case 3: Photo Preview and Remove

**Steps**:
1. Open assign modal
2. Select a photo file
3. Preview appears
4. Click X button on preview

**Expected Results**:
- [ ] Photo preview displays correctly
- [ ] Preview has remove button (X)
- [ ] Clicking X clears the selected photo
- [ ] File input resets
- [ ] Can select different photo

### Test Case 4: File Size Validation

**Steps**:
1. Create test file > 5MB
2. Try to upload in modal

**Expected Results**:
- [ ] Client-side shows toast: "Photo must be less than 5MB"
- [ ] File not included in form submission
- [ ] No network request made to backend

### Test Case 5: File Type Validation

**Steps**:
1. Try to select non-image file (e.g., .txt, .pdf)

**Expected Results**:
- [ ] File input filter prevents selection
- [ ] File dialog only shows image files
- [ ] Non-image files greyed out or hidden

### Test Case 6: Photo Display in Ticket

**Steps**:
1. Assign ticket with photo
2. Look at ticket card in confirmation portal

**Expected Results**:
- [ ] Photo thumbnail displays (48x48px)
- [ ] Photo positioned next to attendee name
- [ ] Photo has rounded corners and border
- [ ] Photo quality is clear and visible

### Test Case 7: Photo Storage Verification

**Steps**:
1. Upload photo via web UI
2. Check filesystem and database

**Expected Results**:
- [ ] File exists in `/backend/uploads/` directory
  ```bash
  ls -la backend/uploads/ | grep -v "^\." | tail -1
  ```
- [ ] File has correct image format (JPG/PNG)
- [ ] File size < 5MB
- [ ] Database record shows photo path
  ```bash
  # In MongoDB:
  db.attendees.findOne({_id: ObjectId("...")}).photo
  # Should show: "uploads/photo-1234567890-abcdef.jpg"
  ```

### Test Case 8: Photo URL Accessibility

**Steps**:
1. Get photo path from database
2. Access in browser

**Expected Results**:
- [ ] Direct URL works: `http://localhost:5000/uploads/{filename}`
- [ ] Image displays in browser
- [ ] No 404 or permission errors
- [ ] Status code is 200

## 🔄 Integration Testing

### Full User Journey

**Scenario**: New buyer purchases tickets and confirms with photos

1. [ ] Buyer receives confirmation email with token link
2. [ ] Opens `/confirmation/{token}` in browser
3. [ ] Sees order summary with 2 pending tickets
4. [ ] Clicks "Assign Myself" on first ticket
5. [ ] Fills form: John Doe, john@example.com, etc.
6. [ ] Selects photo (jpg/png)
7. [ ] Sees photo preview
8. [ ] Clicks "Assign Ticket"
9. [ ] Form submitted successfully
10. [ ] Photo uploaded to backend
11. [ ] Returns to confirmation page
12. [ ] First ticket shows "Assigned" status
13. [ ] Photo thumbnail displayed in ticket card
14. [ ] Repeats for second ticket
15. [ ] All tickets assigned → "Completion message" shown
16. [ ] Check database → both attendees have photos

## 🐛 Error Handling Testing

### Error Case 1: Network Error During Upload

**Test**:
1. Start upload
2. Disconnect network before completion

**Expected**:
- [ ] Error toast shown
- [ ] User can retry
- [ ] No partial data saved

### Error Case 2: Server Error (500)

**Test**:
1. Manually break backend multer config
2. Try upload

**Expected**:
- [ ] Server returns 500 error
- [ ] Error message displayed to user
- [ ] No ticket status changed
- [ ] No photo saved

### Error Case 3: Validation Error

**Test**:
1. Try to submit form with empty email
2. Try to submit with invalid date

**Expected**:
- [ ] Form validation error shown
- [ ] Photo upload doesn't proceed
- [ ] User can correct and resubmit

## 📊 Performance Testing

### File Upload Performance

**Large Image Test**:
1. Upload 5MB image (maximum size)
2. Measure upload time
3. Check server CPU/memory

**Expected**:
- [ ] Upload completes in < 10 seconds
- [ ] Server CPU usage stays normal
- [ ] Memory usage doesn't spike excessively

### Multiple Photos Test

1. Upload 10 photos quickly
2. Check storage and database

**Expected**:
- [ ] All photos stored correctly
- [ ] No filename collisions
- [ ] Database queries remain fast

## 🔐 Security Testing

### Access Control

**Test**:
1. Get photo URL from database
2. Try to access without authentication

**Expected**:
- [ ] Photo accessible (public uploads)
- [ ] Or authenticated if required by architecture

### File Validation

**Test**:
1. Try to upload PHP/executable file
2. Try to upload with malicious extension

**Expected**:
- [ ] Files rejected at extension level
- [ ] Only jpg/png/jpeg accepted
- [ ] No executable files stored

## 📋 Cross-Browser Testing

Test on multiple browsers:

- [ ] Chrome/Chromium
  - [ ] File upload works
  - [ ] Preview displays
  - [ ] Photo shows in ticket
  
- [ ] Firefox
  - [ ] File upload works
  - [ ] Preview displays
  - [ ] Photo shows in ticket
  
- [ ] Safari
  - [ ] File upload works
  - [ ] Preview displays
  - [ ] Photo shows in ticket
  
- [ ] Edge
  - [ ] File upload works
  - [ ] Preview displays
  - [ ] Photo shows in ticket

## 📱 Mobile Testing

- [ ] Modal form responsive on mobile
- [ ] File input works on mobile
- [ ] Photo preview visible on mobile
- [ ] Photo thumbnail displays on mobile
- [ ] All text readable

## ✅ Final Verification

### Components Working
- [ ] Backend multer middleware
- [ ] Photo file upload
- [ ] Photo storage in filesystem
- [ ] Photo path in database
- [ ] Frontend file input
- [ ] Photo preview
- [ ] FormData submission
- [ ] API client FormData handling
- [ ] Photo display in ticket card

### Documentation Complete
- [ ] PHOTO_CONFIRMATION_GUIDE.md exists
- [ ] PHOTO_CONFIRMATION_IMPLEMENTATION.md exists
- [ ] PHOTO_CONFIRMATION_QUICK_REF.md exists
- [ ] Test script (test_photo_confirmation.js) exists
- [ ] All docs are accurate and current

### No Errors
- [ ] Browser console clean (no errors/warnings)
- [ ] Server logs clean (no errors)
- [ ] MongoDB console clean
- [ ] Network requests all 200/201

## 🚀 Ready to Deploy

Once all items are checked:

- [ ] Code review completed
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Security review passed
- [ ] Documentation approved
- [ ] Deployment checklist completed
- [ ] Monitoring set up for uploads
- [ ] Backup strategy for photos

---

## Quick Test Script

Run this to test the complete workflow:
```bash
cd backend
npm install form-data  # One time
node test_photo_confirmation.js
```

Expected output:
```
🎫 Photo Confirmation Workflow Test
==================================================
✅ Test image created
✅ Found order
✅ Found ticket
✅ Photo upload successful!
   Attendee ID: ...
   Photo path: uploads/...
   Ticket status: ASSIGNED
✅ Uploads directory exists
==================================================
🎉 Photo confirmation workflow test completed successfully!
```

---

**Status**: Ready for Launch ✅
**Test Date**: _______________
**Tester Name**: _______________
**Notes**: _______________
