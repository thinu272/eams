# Buyer Confirmation Portal - Complete Implementation Guide

## Overview
The Buyer Confirmation Portal is a comprehensive ticket-to-attendee assignment system that enables event buyers to manage ticket assignments through a user-friendly interface.

## Table of Contents
1. [MongoDB Schema Design](#mongodb-schema-design)
2. [Backend API Documentation](#backend-api-documentation)
3. [Frontend Component Architecture](#frontend-component-architecture)
4. [Workflow & User Experience](#workflow--user-experience)
5. [Sample API Responses](#sample-api-responses)

---

## MongoDB Schema Design

### 1. Order Model (`backend/src/models/Order.js`)
```javascript
{
  orderNumber: String (unique),
  eventId: ObjectId (ref: 'Event'),
  buyerName: String (required),
  buyerEmail: String (required, lowercase),
  buyerPhone: String,
  tickets: [{
    categoryName: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: String (enum: ['PENDING', 'CONFIRMED', 'CANCELLED']),
  confirmationToken: String (UUID),
  allAssigned: Boolean (default: false) /* NEW - tracks if all tickets assigned */,
  timestamps: { createdAt, updatedAt }
}
```

**Key Relationships:**
- One Order → Many Tickets (1:N)
- One Order → One Event (N:1)
- One Order → Many Attendees (1:N via Ticket)

### 2. Ticket Model (`backend/src/models/Ticket.js`)
```javascript
{
  order: ObjectId (ref: 'Order'),
  event: ObjectId (ref: 'Event'),
  attendee: ObjectId (ref: 'Attendee', nullable) /* Assigned attendee */,
  
  categoryName: String,
  categoryId: String,
  price: Number,
  slotIndex: Number (1-based index within order),
  
  status: String (enum: ['PENDING', 'ASSIGNED', 'INVITED', 'CONFIRMED', 'CANCELLED']),
  /* Status flow:
     PENDING → ASSIGNED (self-assignment) or INVITED (send to someone)
     ASSIGNED → CONFIRMED (when attendee confirms identity)
     INVITED → ASSIGNED (when invitee confirms) → CONFIRMED
  */
  
  // Invitation tracking
  inviteEmail: String (nullable),
  inviteToken: String (UUID),
  inviteSentAt: Date,
  
  ticketNumber: String (unique, auto-generated),
  timestamps: { createdAt, updatedAt }
}
```

**Status Enum Values:**
- `PENDING`: Ticket awaiting assignment (initial state)
- `ASSIGNED`: Attendee assigned but not yet confirmed
- `INVITED`: Invite sent to external email, pending response
- `CONFIRMED`: Attendee identity verified and confirmed
- `CANCELLED`: Ticket cancelled

### 3. Attendee Model (`backend/src/models/Attendee.js`)
```javascript
{
  // Identity
  fullName: String,
  email: String (lowercase),
  phone: String,
  dateOfBirth: Date,
  nationalId: String,
  passportNumber: String,
  nationality: String,
  photo: String (file path/URL),
  
  // Linkages
  event: ObjectId (ref: 'Event', required),
  order: ObjectId (ref: 'Order'),
  ticket: ObjectId (ref: 'Ticket'),
  categoryId: String,
  categoryName: String,
  
  // Confirmation
  confirmationStatus: String (enum: ['pending', 'invited', 'confirmed', 'rejected']),
  confirmationToken: String (UUID),
  confirmedAt: Date,
  confirmedBy: String (enum: ['self', 'organiser', 'sub_organiser']),
  
  // QR Code
  qrToken: String (UUID),
  qrCode: String (base64 or file path),
  
  // Metadata
  addedVia: String (enum: ['self_purchase', 'manual', 'bulk_upload', 'invite']),
  timestamps: { createdAt, updatedAt }
}
```

---

## Backend API Documentation

### 1. GET `/api/orders/confirm/:token`
**Purpose:** Fetch order details with all associated tickets

**Parameters:**
- `token` (path param): confirmationToken from Order

**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "507f1f77bcf86cd799439012",
      "orderNumber": "ORD-1704067200000-A1B2C3",
      "eventId": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Tech Conference 2024",
        "venue": {
          "name": "Convention Center",
          "address": "123 Main St"
        },
        "startDate": "2024-01-20T09:00:00Z"
      },
      "buyerName": "John Doe",
      "buyerEmail": "john@example.com",
      "buyerPhone": "+1234567890",
      "totalAmount": 15000,
      "status": "PENDING",
      "allAssigned": false,
      "tickets": [
        {
          "categoryName": "VIP",
          "quantity": 2,
          "price": 5000
        },
        {
          "categoryName": "General",
          "quantity": 1,
          "price": 2000
        }
      ]
    },
    "tickets": [
      {
        "_id": "507f1f77bcf86cd799439020",
        "order": "507f1f77bcf86cd799439012",
        "categoryName": "VIP",
        "slotIndex": 1,
        "status": "PENDING",
        "ticketNumber": "ORD-1704067200000-A1B2C3-1",
        "attendee": null,
        "inviteEmail": null
      },
      {
        "_id": "507f1f77bcf86cd799439021",
        "categoryName": "VIP",
        "slotIndex": 2,
        "status": "ASSIGNED",
        "ticketNumber": "ORD-1704067200000-A1B2C3-2",
        "attendee": {
          "_id": "507f1f77bcf86cd799439030",
          "fullName": "Jane Smith",
          "email": "jane@example.com"
        }
      },
      {
        "_id": "507f1f77bcf86cd799439022",
        "categoryName": "General",
        "slotIndex": 3,
        "status": "INVITED",
        "ticketNumber": "ORD-1704067200000-A1B2C3-3",
        "attendee": {
          "_id": "507f1f77bcf86cd799439031",
          "fullName": null,
          "email": "invited@example.com"
        },
        "inviteEmail": "invited@example.com"
      }
    ]
  }
}
```

### 2. POST `/api/tickets/assign`
**Purpose:** Assign attendee to ticket (self-assignment)

**Request Body:**
```json
{
  "ticketId": "507f1f77bcf86cd799439020",
  "fullName": "Jane Smith",
  "email": "jane@example.com",
  "dateOfBirth": "1990-05-15",
  "nationalId": "123456789V",
  "passportNumber": "AB123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attendee": {
      "_id": "507f1f77bcf86cd799439030",
      "fullName": "Jane Smith",
      "email": "jane@example.com",
      "dateOfBirth": "1990-05-15T00:00:00Z",
      "nationalId": "123456789V",
      "passportNumber": "AB123456",
      "qrToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "confirmationToken": "x9y8z7w6-v5u4-t3s2-r1q0-p9o8n7m6l5k4",
      "confirmationStatus": "confirmed",
      "confirmedAt": "2024-01-10T14:30:00Z",
      "confirmedBy": "self"
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

**Error Responses:**
```json
{
  "success": false,
  "message": "Ticket is already assigned or invited",
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

### 3. POST `/api/tickets/invite`
**Purpose:** Send invite link to external email for ticket assignment

**Request Body:**
```json
{
  "ticketId": "507f1f77bcf86cd799439020",
  "email": "invitee@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticket": {
      "_id": "507f1f77bcf86cd799439020",
      "status": "INVITED",
      "inviteEmail": "invitee@example.com"
    }
  },
  "message": "Invite sent successfully"
}
```

### 4. POST `/api/attendees/confirm/:token`
**Purpose:** Confirm attendee identity (invited attendee response)

**Request Body:**
```json
{
  "fullName": "Guest Name",
  "email": "guest@example.com",
  "dateOfBirth": "1995-03-20",
  "nationalId": "987654321V",
  "passportNumber": "CD789012"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attendee": {
      "_id": "507f1f77bcf86cd799439031",
      "fullName": "Guest Name",
      "email": "guest@example.com",
      "confirmationStatus": "confirmed",
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    }
  },
  "message": "Identity confirmed successfully"
}
```

---

## Frontend Component Architecture

### 1. Page: `/confirmation/:token` (ConfirmOrderPage.jsx)

**Component Tree:**
```
ConfirmOrderPage
├── Header Section
│   └── Order Title & Number
├── Progress Section
│   ├── Progress Bar
│   └── Status Message
├── Order Summary Card
│   ├── Event Info
│   ├── Venue Info
│   └── Total Amount
├── Tickets Section
│   └── TicketCard (×n)
│       ├── Ticket Number & Category
│       ├── Status Badge
│       ├── Attendee Info (if assigned)
│       └── Action Buttons
├── Help Section
├── AssignModal (Assign Myself)
│   ├── FullName Input
│   ├── Email Input
│   ├── DateOfBirth Input
│   ├── NationalId Input
│   ├── PassportNumber Input
│   └── Submit Button
└── Complete Confirmation Button (when all assigned)
```

**State Management:**
```javascript
const [data, setData] = useState(null);           // Order + tickets
const [loading, setLoading] = useState(true);     // Page loading state
const [inviting, setInviting] = useState({});     // Per-ticket inviting state
const [assigning, setAssigning] = useState({});   // Per-ticket assigning state
const [assignModal, setAssignModal] = useState({  // Modal state
  open: false,
  ticketId: null
});
const [assignForm, setAssignForm] = useState({    // Form data
  fullName: '',
  email: '',
  dateOfBirth: '',
  nationalId: '',
  passportNumber: ''
});
const [assignErrors, setAssignErrors] = useState({}); // Form errors
```

**Key Functions:**
- `load()`: Fetch order and tickets from server
- `handleAssignMyself(ticketId)`: Open modal for self-assignment
- `handleAssignSubmit(e)`: Submit assignment form
- `handleInvite(ticketId)`: Send invite to email

**UI Features:**
- Real-time progress bar showing assignment percentage
- Status badges: PENDING, ASSIGNED, INVITED, CONFIRMED
- Action buttons per ticket status
- Modal form with validation
- Toast notifications for feedback

### 2. API Functions (`frontend/src/api/attendees.js`)

```javascript
// Assign ticket to self
export const assignTicket = (data) => api.post('/tickets/assign', data);

// Send invite to ticket
export const inviteTicket = (data) => api.post('/tickets/invite', data);

// Invite attendee by ticket (existing - for backward compatibility)
export const inviteAttendeeByTicket = (ticketId, email) => 
  api.post(`/attendees/invite-by-ticket/${ticketId}`, { email });
```

---

## Workflow & User Experience

### 1. Buyer Receives Order Confirmation
```
Order Created
    ↓
Email sent with confirmation link to buyer
    ↓
Link contains confirmationToken
```

### 2. Buyer Accesses Portal
```
Visit /confirmation/:token
    ↓
Page loads order details
    ↓
Shows all tickets in order
    ↓
Progress: "0 of 3 tickets assigned"
```

### 3. For Each Ticket, Two Options:

#### Option A: Assign Myself
```
Click "Assign Myself" button
    ↓
Modal opens with form
    ↓
Fill in:
  - Full Name (required)
  - Email (required)
  - Date of Birth (optional)
  - National ID (optional)
  - Passport Number (optional)
    ↓
Click "Assign Ticket"
    ↓
POST /api/tickets/assign
    ↓
Attendee created
Ticket status: PENDING → ASSIGNED → CONFIRMED
Progress updates: "1 of 3 tickets assigned"
    ↓
Toast: "Ticket assigned successfully!"
```

#### Option B: Send Invite
```
Click "Send Invite" button
    ↓
Prompt for email address
    ↓
POST /api/tickets/invite
    ↓
Attendee created (email only)
Ticket status: PENDING → INVITED
Progress updates: "0 of 3 assigned, 1 of 3 invited"
    ↓
Email sent to invitee with confirmation link
Invitee visits /attendee/confirm/:confirmationToken
    ↓
Invitee fills in details
POST /api/attendees/confirm/:token
    ↓
Ticket status: INVITED → ASSIGNED → CONFIRMED
```

### 4. Completion State
```
All tickets assigned/confirmed
    ↓
Progress bar reaches 100%
    ↓
"All tickets confirmed!" message
    ↓
"Complete Confirmation" button appears
    ↓
Order status: PENDING → CONFIRMED
allAssigned: false → true
    ↓
Final confirmation email sent to buyer
```

---

## Status Flow Diagram

```
                    ┌─────────────┐
                    │   PENDING   │ (Initial state)
                    └────────┬────┘
                             │
                    ┌────────┴────────┐
                    │                 │
             ┌──────▼──────┐   ┌──────▼──────┐
             │   ASSIGNED  │   │   INVITED   │
             │ (self)      │   │ (to email)  │
             └──────┬──────┘   └──────┬──────┘
                    │                 │
              Confirm identity   Invitee confirms
                    │                 │
             ┌──────▼──────┐   ┌──────▼──────┐
             │  CONFIRMED  │◄──┤   ASSIGNED  │
             └─────────────┘   └─────────────┘
```

---

## Implementation Checklist

### Backend
- [x] Update Ticket model status enum (PENDING, ASSIGNED, INVITED, CONFIRMED, CANCELLED)
- [x] Add allAssigned field to Order model
- [x] Create tickets.js route with POST /api/tickets/assign
- [x] Create POST /api/tickets/invite in tickets.js
- [x] Update orders.js to create tickets with PENDING status
- [x] Update attendees.js to use new status values
- [x] Add tickets route to server.js

### Frontend
- [x] Add assignTicket API function
- [x] Create AssignModal component
- [x] Update ConfirmOrderPage with assign workflow
- [x] Add form validation and error handling
- [x] Real-time progress updates
- [x] Status badges for different states

### Testing
- [ ] Test self-assignment flow
- [ ] Test invite flow
- [ ] Test invite confirmation from email
- [ ] Test allAssigned flag updates
- [ ] Test error handling (duplicate assignment, invalid email, etc.)
- [ ] Test progress bar accuracy

---

## Key Features

### 1. Real-time Status Updates
- Progress bar shows percentage of assigned tickets
- Status badges update immediately after action
- Auto-refresh ticket list

### 2. Error Prevention
- Prevent double assignment (check ticket status)
- Validate email format
- Require full name for self-assignment
- Prevent assigning to same email twice in order

### 3. User Experience
- Modal for single-page flow (no navigation needed)
- Clear action buttons per ticket state
- Toast notifications for feedback
- Help section with support contact

### 4. Data Integrity
- Server validates all assignments
- Backend recalculates allAssigned flag
- UUID tokens for secure invite links
- QR code generation for entry verification

---

## Security Considerations

1. **Token Validation:** confirmationToken is unique UUID
2. **Invite Security:** inviteToken used for external confirmations
3. **Email Verification:** Email field required for invites
4. **CORS Protection:** API endpoints protected with CORS
5. **Input Validation:** All fields validated server-side
6. **Status Immutability:** Can't modify past assignments

---

## Future Enhancements

1. Bulk CSV import for invites
2. Attendee photo verification
3. Custom fields per event
4. Wristband assignment workflow
5. Entry log integration
6. Email reminders for pending confirmations
7. Export attendee list with QR codes
