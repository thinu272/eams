# Buyer Confirmation Portal - Quick Start Guide

## 🚀 5-Minute Setup

### Prerequisites
```bash
✓ Node.js v16+
✓ MongoDB (local or Atlas)
✓ npm installed
✓ Backend running on port 5000
✓ Frontend running on port 3000
```

---

## Step 1: Start Backend

```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server running on port 5000
MongoDB connected
```

---

## Step 2: Start Frontend

In new terminal:
```bash
cd frontend
npm start
```

**Expected Output:**
```
Compiled successfully!
Listening on port 3000
```

---

## Step 3: Create a Test Order

Option A: Via API (Postman/curl)
```bash
POST http://localhost:5000/api/orders
Content-Type: application/json

{
  "eventId": "your-event-id",
  "buyerName": "Test Buyer",
  "buyerEmail": "buyer@test.com",
  "buyerPhone": "+1234567890",
  "tickets": [
    { "categoryName": "VIP", "quantity": 2, "price": 5000 },
    { "categoryName": "General", "quantity": 1, "price": 2000 }
  ]
}
```

**Extract from response:**
```json
{
  "confirmationToken": "abc-123-def-456"
}
```

Option B: Via Frontend Checkout
1. Navigate to `/checkout`
2. Select event and tickets
3. Fill buyer details
4. Complete purchase
5. Copy confirmation token from response

---

## Step 4: Access Confirmation Portal

Navigate to:
```
http://localhost:3000/confirmation/{confirmationToken}
```

Example:
```
http://localhost:3000/confirmation/abc-123-def-456
```

---

## Step 5: Test Features

### Feature 1: Assign Myself
1. Click "Assign Myself" on first ticket
2. Modal opens
3. Fill form:
   - Full Name: Jane Smith
   - Email: jane@example.com
   - DOB: 1990-05-15
   - ID: 123456789V
4. Click "Assign Ticket"
5. ✅ Verify:
   - Modal closes
   - Toast: "Ticket assigned successfully!"
   - Progress bar updates: 1/3
   - Ticket shows "Assigned" status
   - Attendee name visible

### Feature 2: Send Invite
1. Click "Send Invite" on second ticket
2. Prompt: "Enter email address"
3. Enter: guest@test.com
4. ✅ Verify:
   - Toast: "Invite sent to guest@test.com"
   - Progress bar updates
   - Ticket shows "Invited" status
   - Email icon displayed

### Feature 3: Verify Progress
1. After 2 actions
2. Progress bar should show: 33% (1 of 3)
3. Text shows: "1 of 3 assigned"

### Feature 4: Complete All
1. Assign third ticket
2. ✅ Verify:
   - Progress bar at 100%
   - "All tickets confirmed!" message
   - "Complete Confirmation" button visible

---

## Troubleshooting

### Error: Cannot GET /confirmation/:token
**Solution:** Ensure frontend is running and route exists in App.jsx

### Error: "Order not found"
**Solution:** 
- Verify token is correct
- Check MongoDB has the order
- Token might be expired

```bash
# Check in MongoDB
db.orders.findOne({ confirmationToken: "your-token" })
```

### Error: "Ticket not found"
**Solution:**
- Ensure tickets were created with order
- Check all 3 tickets exist in DB

```bash
db.tickets.find({ order: ObjectId("order-id") })
```

### Error: Modal won't close
**Solution:** Check browser console for errors
```javascript
// If stuck, try:
window.location.reload() // Refresh page
```

### Error: Form shows cryptic errors
**Solution:** Check console for response details
```javascript
// Open DevTools > Console
// Look for: "Failed to assign ticket"
```

### Progress bar doesn't update
**Solution:** 
1. Check backend is responding
2. Verify load() is being called
3. Check data structure in state

```javascript
// Log ticket count
console.log(data.tickets.length)
console.log(data.tickets.map(t => t.status))
```

---

## Testing Without Email

If invite emails aren't sending:

### Option 1: Check Email Config
```bash
# Backend .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
```

### Option 2: Disable Email (for testing)
Edit `backend/src/routes/tickets.js`:
```javascript
// Comment out email send for invites
// await sendAttendeeInvite(attendee, ticket.event);
console.log('Invite email would be sent to:', email);
```

### Option 3: Check Email Service
```bash
# Look for errors in backend logs
# Search for: "Email sent" or "Email error"
```

---

## Database Inspection

### View Order Status
```javascript
// MongoDB shell or Atlas
db.orders.findOne({ 
  confirmationToken: "your-token" 
});
```

Output should show:
```json
{
  "allAssigned": false,
  "status": "PENDING"
}
```

### View Tickets
```javascript
db.tickets.find({ 
  order: ObjectId("order-id") 
}).pretty();
```

Output should show:
```json
{
  "status": "PENDING",
  "categoryName": "VIP",
  "slotIndex": 1,
  "attendee": null
}
```

### View Attendees
```javascript
db.attendees.find({ 
  order: ObjectId("order-id") 
}).pretty();
```

Output should show created attendees with qrToken.

---

## API Testing

### Test 1: Get Order
```bash
curl -X GET "http://localhost:5000/api/orders/confirm/abc-123-def-456"
```

Expected: 200 OK with order data

### Test 2: Assign Ticket
```bash
curl -X POST "http://localhost:5000/api/tickets/assign" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "ticket-id",
    "fullName": "Jane Smith",
    "email": "jane@example.com",
    "dateOfBirth": "1990-05-15",
    "nationalId": "123456789V"
  }'
```

Expected: 200 OK with attendee data

### Test 3: Send Invite
```bash
curl -X POST "http://localhost:5000/api/tickets/invite" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": "ticket-id",
    "email": "guest@example.com"
  }'
```

Expected: 200 OK

---

## Performance Checklist

- [ ] First load < 2 seconds
- [ ] Assign action < 1 second
- [ ] Invite action < 2 seconds (includes email)
- [ ] Progress bar smooth animation
- [ ] No console errors
- [ ] Toast notifications appear instantly
- [ ] Modal opens/closes smoothly

---

## Common Workflows

### Workflow 1: All Self-Assign
```
1. Click "Assign Myself" on ticket 1
2. Fill form → Submit
3. Click "Assign Myself" on ticket 2
4. Fill form → Submit
5. Click "Assign Myself" on ticket 3
6. Fill form → Submit
7. See "All confirmed!" message
```

### Workflow 2: All Invites
```
1. Click "Send Invite" on ticket 1 → guest1@ex.com
2. Click "Send Invite" on ticket 2 → guest2@ex.com
3. Click "Send Invite" on ticket 3 → guest3@ex.com
4. Wait for guests to click email links
5. Guests confirm identities
6. See progress update to 100%
```

### Workflow 3: Mixed
```
1. Assign myself: ticket 1
2. Send invite: ticket 2 → guest
3. Send invite: ticket 3 → guest
4. Guest 1 confirms
5. Guest 2 confirms
6. All done!
```

---

## Feature Checklist

After testing, verify:

- [ ] Modal opens on "Assign Myself"
- [ ] Form fields accept input
- [ ] Submit button shows loading state
- [ ] Modal closes on success
- [ ] Toast shows success message
- [ ] Ticket card updates with attendee name
- [ ] Status badge changes to "Assigned"
- [ ] Progress bar updates percentage
- [ ] Invite email prompt appears
- [ ] Email validation works
- [ ] Form errors display inline
- [ ] Progress calculation is correct
- [ ] Completion message shows when done
- [ ] Database reflects changes

---

## Debug Mode

To enable verbose logging:

### Backend
```javascript
// server.js - Already has:
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

### Frontend
```javascript
// Add to ConfirmOrderPage.jsx
console.log('Data:', data);
console.log('Progress:', assigned, '/', tickets.length);
console.log('Assigning state:', assigning);
```

---

## Reset & Cleanup

### Clear All Test Data
```bash
# Never run in production!

# MongoDB shell
db.orders.deleteMany({})
db.tickets.deleteMany({})
db.attendees.deleteMany({})
```

### Restart Services
```bash
# Backend
ctrl+c
npm run dev

# Frontend (in another terminal)
ctrl+c
npm start
```

---

## File Locations

```
Key files to modify:

Backend:
  src/routes/tickets.js           (NEW - main logic)
  src/models/Ticket.js            (status enum)
  src/models/Order.js             (allAssigned field)
  src/server.js                   (route registration)

Frontend:
  pages/buyer/ConfirmOrderPage.jsx (main component)
  api/attendees.js                (API calls)

Config:
  backend/.env                    (database, email)
  frontend/.env                   (API URL)
```

---

## Next Steps After Testing

1. **Verify Everything Works**
   - [ ] All features functional
   - [ ] No console errors
   - [ ] Data persists in DB

2. **Test Error Cases**
   - [ ] Invalid email
   - [ ] Duplicate assignment
   - [ ] Missing fields
   - [ ] Network errors

3. **Review Documentation**
   - [ ] Read IMPLEMENTATION_SUMMARY.md
   - [ ] Check QUICK_REF.md for API details
   - [ ] Review TESTING_GUIDE.md for scenarios

4. **Deploy**
   - [ ] Update environment variables
   - [ ] Configure email service
   - [ ] Set up database backups
   - [ ] Enable CORS for production

---

## Support Resources

| Issue | File |
|-------|------|
| How does it work? | BUYER_CONFIRMATION_PORTAL_GUIDE.md |
| How to use APIs? | CONFIRMATION_PORTAL_QUICK_REF.md |
| How to test? | TESTING_GUIDE_CONFIRMATION_PORTAL.md |
| Visual diagrams | VISUAL_ARCHITECTURE_DIAGRAMS.md |
| All changes | IMPLEMENTATION_SUMMARY.md |

---

## Success Indicators ✅

When everything is working:
- ✅ Portal loads at /confirmation/:token
- ✅ Order and tickets display correctly
- ✅ Can assign tickets with form
- ✅ Can send invites via email
- ✅ Progress bar updates in real-time
- ✅ Attendee data saved to DB
- ✅ Completion detected when all assigned
- ✅ No errors in console
- ✅ Database shows changes

---

**You're all set! Start with "Step 1: Start Backend" above.** 🎉
