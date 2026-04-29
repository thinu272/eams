# Buyer Confirmation Portal - Quick Reference

## API Endpoints

### 1. Get Order with Tickets
```bash
GET /api/orders/confirm/:token
```
**What it does:** Fetches complete order data including all tickets
**Used by:** ConfirmOrderPage on page load
**Returns:** Order + array of Tickets with attendee info

### 2. Assign Ticket to Self
```bash
POST /api/tickets/assign
Content-Type: application/json

{
  "ticketId": "...",
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "dateOfBirth": "1990-05-15",
  "nationalId": "123456789V",
  "passportNumber": "CD789012"
}
```
**What it does:** Creates attendee and assigns to ticket
**Used by:** "Assign Myself" button in modal
**Returns:** Created attendee + updated ticket
**Status Changes:** PENDING → ASSIGNED → CONFIRMED

### 3. Send Invite
```bash
POST /api/tickets/invite
Content-Type: application/json

{
  "ticketId": "...",
  "email": "invitee@example.com"
}
```
**What it does:** Creates placeholder attendee and sends invite email
**Used by:** "Send Invite" button
**Returns:** Updated ticket with invite email
**Status Changes:** PENDING → INVITED

---

## Component States

### Modal States
```javascript
// Closed
{ open: false, ticketId: null }

// Open for ticket assignment
{ open: true, ticketId: "507f1f77bcf86cd799439020" }
```

### Ticket Status Values
| Status    | Meaning | User Action |
|-----------|---------|------------|
| PENDING   | Not yet assigned | Assign Myself or Send Invite |
| ASSIGNED  | Assigned by buyer | Waiting for attendee confirmation |
| INVITED   | Invite sent | Waiting for invitee to confirm |
| CONFIRMED | Attendee confirmed | ✓ Complete |
| CANCELLED | Not sold | - |

### Progress Calculation
```javascript
const assigned = tickets.filter(t => 
  t.status === 'ASSIGNED' || t.status === 'CONFIRMED'
).length;
const progress = (assigned / totalTickets) * 100;
```

---

## Data Flow Diagrams

### Self-Assignment Flow
```
User clicks "Assign Myself"
            ↓
Modal opens with form
            ↓
User fills: fullName, email, dateOfBirth, nationalId, passportNumber
            ↓
User clicks "Assign Ticket"
            ↓
POST /tickets/assign
            ↓
Backend:
  - Create Attendee with confirmationStatus='confirmed'
  - Generate QR code
  - Update Ticket: attendee=newAttendee, status='ASSIGNED'
  - Check if all tickets assigned
  - Update Order: allAssigned=true (if complete)
            ↓
Frontend:
  - Close modal
  - Reload order data
  - Update progress bar
  - Show toast: "Ticket assigned successfully!"
            ↓
UI updates:
  - Ticket shows attendee name
  - Status changes to "Assigned"
  - Buttons hidden, checkmark shown
```

### Invite Flow
```
User clicks "Send Invite"
            ↓
Prompt: "Enter email address"
            ↓
User enters email
            ↓
POST /tickets/invite
            ↓
Backend:
  - Create Attendee with email only
  - Generate confirmationToken & inviteToken
  - Update Ticket: attendee=newAttendee, status='INVITED'
  - Send invite email with link
            ↓
Frontend:
  - Reload order data
  - Update progress bar
  - Show toast: "Invite sent to {email}"
            ↓
UI updates:
  - Ticket status changes to "Invited"
  - Shows email icon and email address
  - Buttons hidden
            ↓
Later: Invitee receives email and clicks link
            ↓
Visits /attendee/confirm/:confirmationToken
            ↓
POST /attendees/confirm/:token (identity confirmation)
            ↓
Backend:
  - Update Attendee: confirmationStatus='confirmed'
  - Update Ticket: status='CONFIRMED'
  - Check if all tickets confirmed
  - Update Order: allAssigned=true (if complete)
  - Send final confirmation email to buyer
```

---

## Form Validation

### Required Fields
- `fullName`: Non-empty string
- `email`: Valid email format (name@domain.com)

### Optional Fields (with validation)
- `dateOfBirth`: ISO 8601 date format (YYYY-MM-DD)
- `nationalId`: Any string (min 3 chars recommended)
- `passportNumber`: Any string (min 3 chars recommended)

### Error Handling
```javascript
try {
  await assignTicket(formData);
} catch (err) {
  if (err.response?.data?.errors) {
    // Server validation errors
    const errors = {};
    err.response.data.errors.forEach(error => {
      errors[error.path] = error.msg;  // e.g., errors.fullName = "Full name is required"
    });
    setAssignErrors(errors);
  } else {
    toast.error('Failed to assign ticket');
  }
}
```

---

## Key Implementation Details

### 1. UUID Usage
- **confirmationToken** (Order): Generated when order created, sent via email
- **inviteToken** (Ticket): Generated when invite sent
- **confirmationToken** (Attendee): Generated when attendee created, sent to invitee
- **qrToken** (Attendee): Generated for QR code scanning at entry

### 2. Status Transitions
```
Order Level:
  - Initial: allAssigned = false
  - When all tickets assigned/confirmed: allAssigned = true

Ticket Level:
  PENDING → ASSIGNED (or INVITED)
    ↓
  ASSIGNED/INVITED → CONFIRMED (when attendee confirms)
```

### 3. Real-time Updates
After each action:
1. Call `load()` to fetch fresh order data
2. Progress bar recalculates
3. Badges update based on new statuses
4. Buttons enable/disable based on status

---

## Common Issues & Solutions

### Issue: "Ticket is already assigned"
- **Cause:** User clicked button twice or ticket already has attendee
- **Solution:** Check ticket.status !== 'PENDING' before allowing action

### Issue: Form shows validation errors
- **Cause:** Missing required fields or invalid email format
- **Solution:** Display error messages near each field, use Input component's error prop

### Issue: Progress bar doesn't update
- **Cause:** Page not reloading after assignment
- **Solution:** Ensure `load()` is called after successful API response

### Issue: allAssigned flag not updating
- **Cause:** Backend not checking all tickets after assignment
- **Solution:** Verify tickets.js POST /assign endpoint calculates allAssigned

---

## Testing Checklist

- [ ] Create order with 3 tickets
- [ ] Access /confirmation/:token
- [ ] Verify order data displays correctly
- [ ] Assign first ticket to self
- [ ] Verify progress updates to 1/3
- [ ] Send invite for second ticket
- [ ] Verify invite email received
- [ ] Confirm invite (from email link)
- [ ] Verify ticket status updates to CONFIRMED
- [ ] Verify progress updates to 2/3
- [ ] Manually assign third ticket
- [ ] Verify allAssigned flag becomes true
- [ ] Verify "Complete Confirmation" button appears
- [ ] Test form validation (empty name, invalid email)
- [ ] Test duplicate assignment prevention
- [ ] Check QR code generation for assigned attendees

---

## Environment Variables (Backend)

```env
# .env
MONGO_URI=mongodb://...
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
```

## Running Tests

```bash
# Backend test
node backend/test_confirmation_flow.js

# Frontend - manual testing in browser
# 1. Create order via checkout
# 2. Visit /confirmation/:token
# 3. Test assign and invite flows
```

---

## Database Queries

### Find all pending tickets for an order
```javascript
Ticket.find({ order: orderId, status: 'PENDING' })
```

### Find all assigned/confirmed tickets
```javascript
Ticket.find({ 
  order: orderId, 
  status: { $in: ['ASSIGNED', 'CONFIRMED'] }
})
```

### Get order with full ticket data
```javascript
Order.findOne({ confirmationToken: token })
  .populate('eventId')
  .populate({
    path: 'tickets',
    populate: [
      { path: 'attendee', select: 'fullName email' },
      { path: 'order' }
    ]
  })
```

---

## File Structure

```
backend/src/
├── models/
│   ├── Order.js          (allAssigned field added)
│   ├── Ticket.js         (status enum updated)
│   └── Attendee.js       (unchanged)
├── routes/
│   ├── orders.js         (GET /confirm/:token)
│   ├── tickets.js        (NEW - POST /assign, /invite)
│   └── attendees.js      (status values updated)
└── server.js             (tickets route added)

frontend/src/
├── pages/buyer/
│   └── ConfirmOrderPage.jsx  (UPDATED - main portal)
├── api/
│   └── attendees.js          (assignTicket, inviteTicket added)
└── components/ui/
    ├── Modal.jsx             (used for assign form)
    └── Input.jsx             (used in form)
```
