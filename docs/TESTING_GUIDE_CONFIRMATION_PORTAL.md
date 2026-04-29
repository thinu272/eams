# Buyer Confirmation Portal - API Testing Guide

## Setup & Prerequisites

### 1. Ensure Backend is Running
```bash
cd backend
npm run dev
# Should see: "Server running on port 5000"
```

### 2. Create Test Order
Run the order creation flow or use MongoDB directly:
```javascript
// Using the POST /api/orders endpoint:
const orderPayload = {
  eventId: "your-event-id",
  buyerName: "John Doe",
  buyerEmail: "john@example.com",
  buyerPhone: "+1234567890",
  tickets: [
    { categoryName: "VIP", quantity: 2, price: 5000 },
    { categoryName: "General", quantity: 1, price: 2000 }
  ]
};
```

---

## Test Scenarios

### Scenario 1: Basic Order Fetch
```bash
GET http://localhost:5000/api/orders/confirm/{confirmationToken}

# Expected: 200 OK
# Response includes:
# - order object with allAssigned: false
# - tickets array with status: PENDING
```

**Sample Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "507f1f77bcf86cd799439012",
      "orderNumber": "ORD-1704067200000-A1B2C3",
      "buyerName": "John Doe",
      "buyerEmail": "john@example.com",
      "totalAmount": 12000,
      "status": "PENDING",
      "allAssigned": false,
      "confirmationToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "eventId": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Tech Conference 2024",
        "startDate": "2024-01-20T09:00:00Z",
        "venue": {
          "name": "Convention Center",
          "address": "123 Main St"
        }
      },
      "tickets": [
        { "categoryName": "VIP", "quantity": 2, "price": 5000 },
        { "categoryName": "General", "quantity": 1, "price": 2000 }
      ]
    },
    "tickets": [
      {
        "_id": "507f1f77bcf86cd799439020",
        "categoryName": "VIP",
        "slotIndex": 1,
        "status": "PENDING",
        "ticketNumber": "ORD-1704067200000-A1B2C3-1",
        "price": 5000,
        "attendee": null,
        "inviteEmail": null
      },
      {
        "_id": "507f1f77bcf86cd799439021",
        "categoryName": "VIP",
        "slotIndex": 2,
        "status": "PENDING",
        "ticketNumber": "ORD-1704067200000-A1B2C3-2",
        "price": 5000,
        "attendee": null,
        "inviteEmail": null
      },
      {
        "_id": "507f1f77bcf86cd799439022",
        "categoryName": "General",
        "slotIndex": 3,
        "status": "PENDING",
        "ticketNumber": "ORD-1704067200000-A1B2C3-3",
        "price": 2000,
        "attendee": null,
        "inviteEmail": null
      }
    ]
  }
}
```

---

### Scenario 2: Assign Ticket to Self

**Step 1: Get order details**
```bash
GET http://localhost:5000/api/orders/confirm/{confirmationToken}
```
Save a ticket ID (e.g., `507f1f77bcf86cd799439020`)

**Step 2: Assign ticket**
```bash
POST http://localhost:5000/api/tickets/assign
Content-Type: application/json

{
  "ticketId": "507f1f77bcf86cd799439020",
  "fullName": "Jane Smith",
  "email": "jane.smith@example.com",
  "dateOfBirth": "1990-05-15",
  "nationalId": "123456789V",
  "passportNumber": "AB123456"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "attendee": {
      "_id": "507f1f77bcf86cd799439030",
      "fullName": "Jane Smith",
      "email": "jane.smith@example.com",
      "dateOfBirth": "1990-05-15T00:00:00Z",
      "nationalId": "123456789V",
      "passportNumber": "AB123456",
      "order": "507f1f77bcf86cd799439012",
      "event": "507f1f77bcf86cd799439011",
      "ticket": "507f1f77bcf86cd799439020",
      "categoryName": "VIP",
      "confirmationStatus": "confirmed",
      "confirmationToken": "x9y8z7w6-v5u4-t3s2-r1q0-p9o8n7m6l5k4",
      "qrToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
      "confirmedAt": "2024-01-10T14:30:00Z",
      "confirmedBy": "self",
      "addedVia": "self_purchase"
    },
    "ticket": {
      "_id": "507f1f77bcf86cd799439020",
      "status": "ASSIGNED",
      "categoryName": "VIP",
      "ticketNumber": "ORD-1704067200000-A1B2C3-1"
    }
  },
  "message": "Ticket assigned successfully"
}
```

**Step 3: Verify ticket updated**
```bash
GET http://localhost:5000/api/orders/confirm/{confirmationToken}
```
Response should show:
- First ticket status: `ASSIGNED`
- Attendee populated with Jane's info
- Progress: `1 of 3 assigned`
- `allAssigned`: still `false`

---

### Scenario 3: Send Invite to Ticket

**Step 1: Identify second pending ticket**
```bash
# From previous GET response, use ticket ID: 507f1f77bcf86cd799439021
```

**Step 2: Send invite**
```bash
POST http://localhost:5000/api/tickets/invite
Content-Type: application/json

{
  "ticketId": "507f1f77bcf86cd799439021",
  "email": "guest@example.com"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "507f1f77bcf86cd799439021",
      "status": "INVITED",
      "inviteEmail": "guest@example.com"
    }
  },
  "message": "Invite sent successfully"
}
```

**Step 3: Check email** (if email configured)
- Guest receives email with `/attendee/confirm/:confirmationToken` link
- Email subject: Invite to confirm event attendance

**Step 4: Verify ticket updated**
```bash
GET http://localhost:5000/api/orders/confirm/{confirmationToken}
```
Response should show:
- Second ticket status: `INVITED`
- `inviteEmail`: `guest@example.com`
- Progress: `1 of 3 assigned, 1 of 3 invited`

---

### Scenario 4: Invited Guest Confirms Identity

**Step 1: Guest clicks email link**
```
Link: http://localhost:3000/attendee/confirm/{confirmationToken}
```

**Step 2: Guest fills form and submits**
```bash
POST http://localhost:5000/api/attendees/confirm/{confirmationToken}
Content-Type: application/json

{
  "fullName": "Guest Person",
  "email": "guest@example.com",
  "dateOfBirth": "1995-03-20",
  "nationalId": "987654321V",
  "passportNumber": "CD789012"
}
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "attendee": {
      "_id": "507f1f77bcf86cd799439031",
      "fullName": "Guest Person",
      "email": "guest@example.com",
      "confirmationStatus": "confirmed",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
      "confirmedAt": "2024-01-10T14:35:00Z"
    }
  },
  "message": "Identity confirmed successfully"
}
```

**Step 3: Verify backend status update**
```bash
GET http://localhost:5000/api/orders/confirm/{confirmationToken}
```
Response should show:
- Second ticket status: `CONFIRMED` (changed from INVITED)
- Progress: `2 of 3 assigned/confirmed`

---

### Scenario 5: Complete Order - All Tickets Assigned

**Step 1: Assign remaining ticket**
```bash
POST http://localhost:5000/api/tickets/assign
Content-Type: application/json

{
  "ticketId": "507f1f77bcf86cd799439022",
  "fullName": "Third Person",
  "email": "third@example.com",
  "dateOfBirth": "1988-07-10",
  "nationalId": "555555555V"
}
```

**Step 2: Verify allAssigned is true**
```bash
GET http://localhost:5000/api/orders/confirm/{confirmationToken}
```
Response should show:
- All three tickets with status: `ASSIGNED` or `CONFIRMED`
- `allAssigned`: `true` ✓
- Progress: `3 of 3 assigned/confirmed`

---

## Error Scenarios

### Error 1: Invalid Ticket ID
```bash
POST /api/tickets/assign
{
  "ticketId": "invalid-id",
  "fullName": "Jane",
  "email": "jane@example.com"
}
```
**Response (404):**
```json
{
  "success": false,
  "message": "Ticket not found"
}
```

### Error 2: Missing Required Field
```bash
POST /api/tickets/assign
{
  "ticketId": "507f1f77bcf86cd799439020",
  "fullName": "", // Empty!
  "email": "jane@example.com"
}
```
**Response (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "value": "",
      "msg": "Full name is required",
      "param": "fullName",
      "location": "body"
    }
  ]
}
```

### Error 3: Invalid Email
```bash
POST /api/tickets/assign
{
  "ticketId": "507f1f77bcf86cd799439020",
  "fullName": "Jane Smith",
  "email": "not-an-email"
}
```
**Response (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Valid email is required",
      "param": "email"
    }
  ]
}
```

### Error 4: Ticket Already Assigned
```bash
POST /api/tickets/assign
{
  "ticketId": "507f1f77bcf86cd799439020", // Already ASSIGNED
  "fullName": "Another Person",
  "email": "another@example.com"
}
```
**Response (400):**
```json
{
  "success": false,
  "message": "Ticket is already assigned or invited"
}
```

### Error 5: Invalid Confirmation Token
```bash
GET /api/orders/confirm/invalid-token-xyz
```
**Response (404):**
```json
{
  "success": false,
  "message": "Order not found"
}
```

---

## Frontend Testing Workflow

### 1. Access Portal
```
Navigate to: http://localhost:3000/confirmation/{confirmationToken}
```

### 2. Verify Page Loads
- [ ] Order summary displays
- [ ] Event details show
- [ ] All tickets listed with PENDING status
- [ ] Progress bar shows 0%

### 3. Test "Assign Myself"
- [ ] Click first ticket's "Assign Myself" button
- [ ] Modal opens with form
- [ ] Fill in: Full Name, Email, Date of Birth, ID
- [ ] Submit form
- [ ] Modal closes
- [ ] Toast shows "Ticket assigned successfully!"
- [ ] Page reloads automatically
- [ ] Ticket shows as "Assigned" with attendee name
- [ ] Progress bar updates to 33%

### 4. Test "Send Invite"
- [ ] Click second ticket's "Send Invite" button
- [ ] Prompt appears for email
- [ ] Enter test email
- [ ] Toast shows "Invite sent to test@example.com"
- [ ] Ticket shows as "Invited" with email icon

### 5. Test Form Validation
- [ ] Try submit with empty Name → Error appears
- [ ] Try submit with invalid email → Error message
- [ ] Try submit duplicate assignment → Error message

### 6. Test Complete State
- [ ] After assigning all 3 tickets
- [ ] Progress bar reaches 100%
- [ ] "All tickets confirmed!" message appears
- [ ] "Complete Confirmation" button visible

---

## Database Verification

### Check Order Status
```javascript
// MongoDB shell or Mongo Atlas UI
db.orders.findOne({ 
  confirmationToken: "your-token" 
});

// Should show:
// allAssigned: true/false (correct based on tickets)
```

### Check Ticket Statuses
```javascript
db.tickets.find({ 
  order: ObjectId("order-id") 
});

// Should show all statuses
```

### Check Attendee Records
```javascript
db.attendees.find({ 
  order: ObjectId("order-id") 
});

// Should show attendees with qrTokens
```

---

## Performance Metrics

### Response Times (Expected)
- `GET /orders/confirm/:token` → <100ms
- `POST /tickets/assign` → <200ms
- `POST /tickets/invite` → <300ms (includes email send)
- `POST /attendees/confirm/:token` → <250ms

### Load Testing
```bash
# Using Apache Bench
ab -n 100 -c 10 http://localhost:5000/api/orders/confirm/{token}

# Should handle without errors
```

---

## Debugging Tips

### 1. Check Backend Logs
```bash
# Look for:
# - "Ticket assignment error:"
# - "INVITE BY TICKET ERROR:"
# - Validation errors
```

### 2. Check Frontend Console
```javascript
// Frontend errors appear in DevTools Console
// Look for:
// - API call failures
// - Form validation issues
// - State update problems
```

### 3. Verify Email Sent
```javascript
// If email configured, check:
// - Email service logs
// - Email provider (Gmail, SendGrid, etc.)
// - Spam folder
```

### 4. Check Database
```bash
# MongoDB Compass or Atlas UI
# Verify:
# - Tickets created with correct status
# - Attendees linked to tickets
# - Order allAssigned flag updated
```

---

## Postman Collection Template

```json
{
  "info": {
    "name": "Buyer Confirmation Portal",
    "description": "API tests for ticket assignment"
  },
  "item": [
    {
      "name": "Get Order by Token",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/orders/confirm/{{order_token}}"
      }
    },
    {
      "name": "Assign Ticket to Self",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/tickets/assign",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"ticketId\": \"{{ticket_id}}\",\n  \"fullName\": \"Jane Smith\",\n  \"email\": \"jane@example.com\",\n  \"dateOfBirth\": \"1990-05-15\",\n  \"nationalId\": \"123456789V\"\n}"
        }
      }
    },
    {
      "name": "Send Invite",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/tickets/invite",
        "body": {
          "mode": "raw",
          "raw": "{\n  \"ticketId\": \"{{ticket_id}}\",\n  \"email\": \"guest@example.com\"\n}"
        }
      }
    }
  ]
}
```

---

## Common Testing Patterns

### Pattern 1: Complete Single Flow
1. Create order → 2. Fetch order → 3. Assign ticket → 4. Verify status

### Pattern 2: Mixed Assignment
1. Assign some myself → 2. Invite others → 3. Verify mix of statuses

### Pattern 3: Error Recovery
1. Try invalid email → 2. See error → 3. Correct and retry

### Pattern 4: Status Progression
1. PENDING → 2. ASSIGNED → 3. CONFIRMED (after invitee confirms)
