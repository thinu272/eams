# Buyer Confirmation Portal - Troubleshooting Guide

## Issue: Order Summary Not Showing Correctly & No Action Buttons

### Quick Fixes

#### 1. Restart Services
```bash
# Terminal 1: Stop backend
cd backend
npm run dev

# Terminal 2: In a new terminal, go to project root
cd frontend
npm start
```

Wait for both to compile successfully before testing.

#### 2. Check Browser Console
Open DevTools (F12) and check Console tab for errors:
- Red errors indicate problems
- Look for network errors or syntax errors

#### 3. Check Network Tab
In DevTools Network tab:
1. Reload the page
2. Look for API calls `/api/orders/confirm/...`
3. Click on the request to see Response
4. Verify the order data is being returned

---

## Detailed Diagnosis Steps

### Step 1: Verify Backend is Running

```bash
# Check if backend responds
curl http://localhost:5000/

# Should return: "API Running..."
```

If this fails:
- Backend is not running
- Solution: `cd backend && npm run dev`

### Step 2: Verify Database Connection

```bash
# Run diagnostic script
cd backend
node diagnose_confirmation_portal.js
```

This will tell you:
- ✅/❌ Is MongoDB connected?
- ✅/❌ Are there orders in the database?
- ✅/❌ What's the latest order token?
- ✅/❌ Are event details populated?
- ✅/❌ What are the ticket statuses?

### Step 3: Test API Endpoint Directly

```bash
# Get an order token first
node diagnose_confirmation_portal.js

# Then test with that token:
curl "http://localhost:5000/api/orders/confirm/{TOKEN_HERE}"
```

Expected response should include:
```json
{
  "success": true,
  "data": {
    "order": {
      "buyerName": "...",
      "buyerEmail": "...",
      "event": {
        "name": "...",
        "venue": { "name": "...", "address": "..." },
        "startDate": "..."
      }
    },
    "tickets": [
      {
        "_id": "...",
        "status": "PENDING",
        "categoryName": "...",
        "ticketNumber": "..."
      }
    ]
  }
}
```

### Step 4: Check Frontend Data

In browser DevTools Console, run:

```javascript
// Check what data the page has
console.log('Data state:', window.localStorage);
console.log('URL:', window.location.pathname);

// Try fetching the order directly
fetch('/api/orders/confirm/{YOUR_TOKEN_HERE}')
  .then(r => r.json())
  .then(data => {
    console.log('API Response:', data);
    if (data.data?.tickets) {
      console.log('Tickets:', data.data.tickets);
      console.log('Statuses:', data.data.tickets.map(t => t.status));
    }
  });
```

---

## Common Issues & Solutions

### Issue 1: "Order Not Found" Message

**Cause:** Invalid or expired confirmation token

**Solution:**
1. Check you're using correct token from order creation
2. Verify token is in the URL correctly
3. Create a new order and get the token

```bash
# Get orders from database
cd backend && node
> const Order = require('./src/models/Order');
> await Order.findOne().lean();
> exit
```

### Issue 2: Order Summary is Empty

**Cause:** Event data not being populated

**Solutions:**

A) Check event exists in database:
```bash
node -e "require('dotenv').config(); require('mongoose').connect(process.env.MONGO_URI).then(() => require('./src/models/Event').findOne().lean().then(e => console.log(e))).then(() => process.exit());"
```

B) Verify order has eventId:
```bash
# In backend shell
await require('./src/models/Order').findOne().select('eventId buyerName').lean();
```

C) Check API response manually:
```bash
curl "http://localhost:5000/api/orders/confirm/{TOKEN}" | jq '.data.order.event'
```

### Issue 3: Buttons Not Showing

**Cause:** Ticket status is not 'PENDING'

**Solutions:**

1) Check ticket statuses in database:
```bash
cd backend && node
> const db = require('mongoose');
> await db.connect(process.env.MONGO_URI);
> const Ticket = require('./src/models/Ticket');
> await Ticket.find().select('status categoryName').lean();
```

2) Verify from API response:
```javascript
// In browser DevTools
fetch('/api/orders/confirm/{TOKEN}')
  .then(r => r.json())
  .then(d => {
    d.data.tickets.forEach((t, i) => {
      console.log(`Ticket ${i}: status=${t.status}, category=${t.categoryName}`);
    });
  });
```

3) Check ticket creation in orders.js:
```javascript
// In backend/src/routes/orders.js around line 165-175
// Should have: status: 'PENDING'
// NOT: status: 'unassigned'
```

### Issue 4: Modal Doesn't Open

**Cause:** JavaScript error or button click not working

**Solutions:**

1) Check console for errors (F12 > Console tab)

2) Verify button is clickable:
```javascript
// In browser DevTools console
document.querySelectorAll('button').forEach((b, i) => {
  console.log(`${i}: ${b.innerText}`);
});
```

3) Test clicking button manually:
```javascript
// Find and click first button
document.querySelector('button')?.click();
```

### Issue 5: Form Submission Fails

**Causes:** Validation error or API endpoint issue

**Solutions:**

1) Check form validation in console:
```javascript
// See what's being sent
const form = document.querySelector('form');
const data = new FormData(form);
for (let [k, v] of data) console.log(`${k}: ${v}`);
```

2) Check API response:
```javascript
// Try assignment manually in console
fetch('/api/tickets/assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ticketId: '507f...',
    fullName: 'Test Name',
    email: 'test@example.com',
    dateOfBirth: '1990-01-01'
  })
})
  .then(r => r.json())
  .then(d => console.log(d));
```

---

## Debug Checklist

- [ ] Run `npm run dev` in backend - check for errors
- [ ] Run `npm start` in frontend - check for errors
- [ ] Backend is accessible: `curl http://localhost:5000/`
- [ ] Frontend is accessible: `http://localhost:3000`
- [ ] Run: `node diagnose_confirmation_portal.js`
- [ ] Create fresh test order to get new token
- [ ] Navigate to `/confirmation/{TOKEN}` URL
- [ ] Open DevTools (F12)
- [ ] Check Console tab for errors
- [ ] Check Network tab > find `/api/orders/confirm/` request
- [ ] Verify response has order + tickets + event data
- [ ] Check ticket statuses are 'PENDING'
- [ ] Try clicking "Assign Myself" button
- [ ] Try submitting form
- [ ] Check browser console for errors during submit

---

## Advanced Debugging

### Enable Verbose Logging

Edit `backend/src/server.js`:
```javascript
// Already enabled, but add to any route:
router.get('/confirm/:token', async (req, res) => {
  console.log('🔍 GET /orders/confirm/:token');
  console.log('Token:', req.params.token);
  // ... rest of code
  console.log('Response:', response);
});
```

### Database Connection Test

```bash
# Test MongoDB directly
mongo  # or mongosh for newer versions
> use admin
> show dbs
> use eams  # Your DB name
> db.orders.findOne()
> db.tickets.find({}, {status: 1, categoryName: 1})
```

### Frontend React DevTools

1. Install React DevTools browser extension
2. Open DevTools and go to Components tab
3. Search for "ConfirmOrderPage"
4. Check the state and props
5. Look for data, loading, tickets array

---

## File Changes Made

These files were just updated to fix the issue:

1. **backend/src/routes/orders.js** (GET /orders/confirm/:token)
   - Improved populate query
   - Better event data extraction
   - Added proper response structure

2. **frontend/src/pages/buyer/ConfirmOrderPage.jsx**
   - Added buyer info section to order summary
   - Updated import to use new API functions
   - Changed inviteAttendeeByTicket → inviteTicket
   - Better null checks for missing data

3. **frontend/src/api/attendees.js**
   - Already has assignTicket and inviteTicket functions

---

## Testing Guide

Once everything is working:

### Test 1: Create Order
```
1. Go to /checkout
2. Select event and tickets
3. Fill buyer info
4. Complete purchase
5. Note the confirmation token
```

### Test 2: Access Portal
```
1. Go to /confirmation/{token}
2. Verify order summary shows
3. Verify buyer info shows
4. Verify tickets list shows
```

### Test 3: Assign Ticket
```
1. Click "Assign Myself" on first ticket
2. Modal should open
3. Fill: Name, Email, DOB
4. Click "Assign Ticket"
5. Verify success message
6. Check ticket shows as "Assigned"
7. Progress bar should update
```

### Test 4: Send Invite
```
1. Click "Send Invite" on second ticket
2. Enter email: test@example.com
3. Click OK
4. Verify success message
5. Check ticket shows as "Invited"
```

---

## Getting More Help

If issues persist:

1. **Run diagnostics:** `node diagnose_confirmation_portal.js`
2. **Check browser console:** F12 > Console tab
3. **Check network requests:** F12 > Network tab, reload page
4. **Check backend logs:** Look at terminal where you ran `npm run dev`
5. **Check database:** Verify orders and tickets exist

---

## Contact Support

Provide:
- Diagnostic output: `node diagnose_confirmation_portal.js`
- Browser console error screenshot
- Network request/response from DevTools
- Error message from backend terminal
