# ENTRYNEX Direct Bank Transfer Payment Management System

## Overview

The ENTRYNEX Direct Bank Transfer Payment Management System provides a comprehensive solution for managing bank transfer payments across the platform. It enables organizers to verify, approve, and reject bank transfer payments for their events, while giving super admins complete platform-wide visibility and control.

## Features

### Organizer Dashboard
- **Payments Module**: Dedicated section for managing bank transfer payments
- **Status-Based Views**: Pending Verification, Approved, Rejected, Refunded, All Payments
- **Event Scoping**: Organizers only see payments for their assigned events
- **Detailed Payment View**: Complete payment information with receipt preview
- **Verification Panel**: Approve, reject, or request more information
- **Automatic Workflow**: Order confirmation, ticket activation, and notifications

### Super Admin Dashboard
- **Platform-Wide Visibility**: View all payments from all events
- **Advanced Filtering**: Filter by event, company, organizer, buyer, payment method, status, date range, amount, bank
- **Audit Trail**: Complete audit history of all payment actions
- **Override Capabilities**: Override organizer decisions
- **Export Functionality**: Generate payment reports in Excel/CSV format

### Automatic Workflow Updates
When a payment is approved, the system automatically:
- Updates PaymentSubmission status to 'approved'
- Updates Order status to 'CONFIRMED'
- Updates Order paymentStatus to 'success'
- Updates Ticket status to 'SOLD'
- Activates QR codes for all tickets
- Confirms attendees and enables ticket access
- Sends email notifications to buyer
- Sends SMS notifications (if enabled)
- Creates in-app notifications
- Emits real-time dashboard events
- Logs action for audit trail

## API Endpoints

### Payment Management Routes

#### Organizer Routes
Base URL: `/api/payment-management/organizer`

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/` | Get payment submissions with filtering and pagination | `canViewPayments` |
| GET | `/statistics` | Get payment statistics for dashboard | `canViewPayments` |
| GET | `/:submissionId` | Get detailed payment submission information | `canViewPayments` |
| POST | `/:submissionId/approve` | Approve a payment submission | `canApprovePayments` |
| POST | `/:submissionId/reject` | Reject a payment submission | `canApprovePayments` |
| POST | `/:submissionId/request-info` | Request more information from buyer | `canApprovePayments` |
| GET | `/export` | Export payment data to Excel/CSV | `canViewPayments` |

#### Admin Routes
Base URL: `/api/payment-management/admin`

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| GET | `/` | Get payment submissions with filtering and pagination | Main Admin, Super Admin |
| GET | `/statistics` | Get payment statistics for dashboard | Main Admin, Super Admin |
| GET | `/:submissionId` | Get detailed payment submission information | Main Admin, Super Admin |
| POST | `/:submissionId/approve` | Approve a payment submission | Main Admin, Super Admin |
| POST | `/:submissionId/reject` | Reject a payment submission | Main Admin, Super Admin |
| POST | `/:submissionId/request-info` | Request more information from buyer | Main Admin, Super Admin |
| GET | `/export` | Export payment data to Excel/CSV | Main Admin, Super Admin |

### Legacy Bank Transfer Routes
Base URL: `/api/bank-transfer`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/order` | Create bank transfer order |
| GET | `/instructions/:orderId` | Get bank transfer instructions |
| POST | `/submit/:orderId` | Submit payment receipt |
| GET | `/payments` | Get pending payment submissions |
| POST | `/payments/:submissionId/approve` | Approve payment (legacy) |
| POST | `/payments/:submissionId/reject` | Reject payment (legacy) |
| POST | `/payments/:submissionId/request-info` | Request more information (legacy) |
| GET | `/bank-accounts` | Get bank accounts |
| POST | `/bank-accounts` | Create bank account |
| PUT | `/bank-accounts/:accountId` | Update bank account |
| DELETE | `/bank-accounts/:accountId` | Delete bank account |

## Controller Functions

### Payment Management Controller

#### `getPaymentSubmissions`
Retrieves payment submissions with advanced filtering and pagination.

**Query Parameters:**
- `status` (optional): Filter by verification status (pending, approved, rejected, needs_info, all)
- `eventId` (optional): Filter by specific event
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by payer name, email, or reference number
- `dateFrom` (optional): Filter submissions from this date
- `dateTo` (optional): Filter submissions until this date
- `bank` (optional): Filter by bank name
- `amountMin` (optional): Minimum amount filter
- `amountMax` (optional): Maximum amount filter

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "submission_id",
        "orderId": "order_id",
        "orderNumber": "ORD-10025",
        "event": {
          "_id": "event_id",
          "name": "Music Festival",
          "startDate": "2026-07-15T10:00:00Z",
          "endDate": "2026-07-15T18:00:00Z",
          "venue": "Colombo City Center"
        },
        "buyer": {
          "name": "John Smith",
          "email": "john@example.com"
        },
        "ticketSummary": [
          {
            "categoryName": "VIP",
            "quantity": 2,
            "amount": 18000
          }
        ],
        "totalAmount": 18000,
        "paymentMethod": "bank_transfer",
        "bankUsed": "Commercial Bank",
        "referenceNumber": "TRX458712",
        "amountPaid": 18000,
        "submittedAt": "2026-07-15T10:30:00Z",
        "verificationStatus": "pending",
        "verifiedAt": null,
        "verifiedBy": null,
        "rejectionReason": null
      }
    ],
    "total": 100,
    "pages": 5,
    "currentPage": 1
  }
}
```

#### `getPaymentSubmissionDetails`
Retrieves detailed information about a specific payment submission.

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentSubmission": {
      "_id": "submission_id",
      "payerName": "John Smith",
      "payerEmail": "john@example.com",
      "payerPhone": "+94771234567",
      "payerNicPassport": "901234567V",
      "bankUsed": "Commercial Bank",
      "transferDate": "2026-07-15",
      "transferTime": "10:30 AM",
      "referenceNumber": "TRX458712",
      "amountPaid": 18000,
      "receiptFile": "/uploads/receipts/receipt-1234567890.jpg",
      "receiptFileType": "image",
      "notes": "Payment for VIP tickets",
      "verificationStatus": "pending",
      "rejectionReason": null,
      "submittedAt": "2026-07-15T10:30:00Z",
      "verifiedAt": null,
      "verifiedBy": null
    },
    "order": {
      "_id": "order_id",
      "orderNumber": "ORD-10025",
      "totalAmount": 18000,
      "status": "PENDING_VERIFICATION",
      "paymentStatus": "pending_verification",
      "paymentMethod": "bank_transfer",
      "buyerName": "John Smith",
      "buyerEmail": "john@example.com",
      "buyerPhone": "+94771234567",
      "createdAt": "2026-07-15T10:00:00Z"
    },
    "event": {
      "_id": "event_id",
      "name": "Music Festival",
      "startDate": "2026-07-15T10:00:00Z",
      "endDate": "2026-07-15T18:00:00Z",
      "venue": "Colombo City Center",
      "settings": {}
    },
    "tickets": [
      {
        "_id": "ticket_id",
        "ticketNumber": "TKT-10025-1",
        "categoryName": "VIP",
        "price": 9000,
        "status": "PENDING",
        "attendee": {
          "fullName": "John Smith",
          "email": "john@example.com",
          "phone": "+94771234567",
          "confirmationStatus": "pending"
        }
      }
    ]
  }
}
```

#### `approvePayment`
Approves a payment submission and triggers automatic workflow updates.

**Request Body:**
```json
{
  "notes": "Payment verified successfully"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment approved successfully",
  "data": {
    "paymentSubmission": {
      "_id": "submission_id",
      "verificationStatus": "approved",
      "verifiedAt": "2026-07-15T14:15:00Z",
      "verifiedBy": {
        "_id": "user_id",
        "name": "Sarah Perera",
        "email": "sarah@example.com"
      }
    }
  }
}
```

**Automatic Actions:**
- Updates PaymentSubmission status to 'approved'
- Updates Order status to 'CONFIRMED'
- Updates Order paymentStatus to 'success'
- Updates Ticket status to 'SOLD'
- Activates QR codes for all tickets
- Confirms attendees and enables ticket access
- Sends email notifications to buyer
- Sends SMS notifications (if enabled)
- Creates in-app notifications
- Emits real-time dashboard events
- Logs action for audit trail

#### `rejectPayment`
Rejects a payment submission with a required reason.

**Request Body:**
```json
{
  "rejectionReason": "Receipt is unclear and transaction details cannot be verified"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment rejected successfully",
  "data": {
    "paymentSubmission": {
      "_id": "submission_id",
      "verificationStatus": "rejected",
      "verifiedAt": "2026-07-15T14:15:00Z",
      "verifiedBy": {
        "_id": "user_id",
        "name": "Sarah Perera",
        "email": "sarah@example.com"
      },
      "rejectionReason": "Receipt is unclear and transaction details cannot be verified"
    }
  }
}
```

**Automatic Actions:**
- Updates PaymentSubmission status to 'rejected'
- Updates Order status to 'CANCELLED'
- Updates Order paymentStatus to 'failed'
- Updates Ticket status to 'CANCELLED'
- Sends rejection notification to buyer
- Logs action for audit trail
- Emits real-time dashboard events

#### `requestMoreInfo`
Requests additional information from the buyer for a pending payment.

**Request Body:**
```json
{
  "message": "Please provide a clearer receipt with transaction details visible"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Information request sent successfully",
  "data": {
    "paymentSubmission": {
      "_id": "submission_id",
      "verificationStatus": "needs_info",
      "notes": "Please provide a clearer receipt with transaction details visible"
    }
  }
}
```

**Automatic Actions:**
- Updates PaymentSubmission status to 'needs_info'
- Sends information request notification to buyer
- Logs action for audit trail

#### `getPaymentStatistics`
Retrieves payment statistics for dashboard overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPayments": 150,
      "pendingPayments": 25,
      "approvedPayments": 120,
      "rejectedPayments": 3,
      "needsInfoPayments": 2,
      "totalAmount": 4500000,
      "approvedAmount": 4200000,
      "pendingAmount": 270000
    },
    "recentPayments": [
      {
        "_id": "submission_id",
        "orderNumber": "ORD-10025",
        "buyerName": "John Smith",
        "buyerEmail": "john@example.com",
        "amountPaid": 18000,
        "verificationStatus": "pending",
        "submittedAt": "2026-07-15T10:30:00Z",
        "verifiedAt": null,
        "verifiedBy": null
      }
    ]
  }
}
```

#### `exportPayments`
Exports payment data to Excel or CSV format.

**Query Parameters:**
- `status` (optional): Filter by verification status
- `eventId` (optional): Filter by specific event
- `format` (optional): Export format (xlsx or csv, default: xlsx)

**Response:** File download with payment data

## Permission System

### Role-Based Access Control

#### Main Organizer
- View payments for assigned events
- Approve bank transfers
- Reject bank transfers
- View receipts
- Export payment reports

#### Sub Organizer
- Configurable permissions:
  - `canViewPayments`: View payment submissions
  - `canApprovePayments`: Approve/reject payments
  - `canDownloadReceipts`: Download receipt files
  - `canExportPayments`: Export payment reports

#### Super Admin
- View every payment across all events
- Approve or reject any payment
- Override organizer decisions
- View complete audit history
- Export all payment reports
- Manage bank accounts
- Configure payment settings

### Permission Implementation

Permissions are checked using the `requirePermission` middleware:

```javascript
router.post('/organizer/:submissionId/approve', 
  requirePermission('canApprovePayments'), 
  approvePayment
);
```

High-level roles (Main Admin, Main Organiser) bypass specific permission checks by default.

## Workflow Integration

### Payment Submission Flow

1. **Order Creation**: Buyer creates order with bank transfer payment method
2. **Payment Instructions**: System provides bank account details
3. **Receipt Upload**: Buyer uploads payment receipt with transfer details
4. **Verification Request**: Payment submission created with 'pending' status
5. **Organizer Review**: Organizer reviews payment in dashboard
6. **Decision**: Organizer approves, rejects, or requests more information
7. **Automatic Updates**: System updates order, tickets, and sends notifications
8. **Audit Logging**: All actions logged for audit trail

### Automatic Workflow Updates

#### On Payment Approval
```javascript
// Payment Submission
verificationStatus: 'approved'
verifiedBy: user._id
verifiedAt: new Date()

// Order
status: 'CONFIRMED'
paymentStatus: 'success'

// Tickets
status: 'SOLD'

// Attendees
confirmationStatus: 'confirmed'
isConfirmed: true

// QR Codes
qrCode: generated for each ticket
```

#### On Payment Rejection
```javascript
// Payment Submission
verificationStatus: 'rejected'
rejectionReason: provided_reason
verifiedBy: user._id
verifiedAt: new Date()

// Order
status: 'CANCELLED'
paymentStatus: 'failed'

// Tickets
status: 'CANCELLED'
```

## Audit Logging

All payment actions are logged using the activity logger:

```javascript
await logActivity({
  req,
  action: 'payment_approval',
  eventId: order.eventId?._id,
  details: {
    message: `Payment approved for order ${order.orderNumber}`,
    submissionId: paymentSubmission._id,
    amount: paymentSubmission.amountPaid,
    approvedBy: user.name,
  },
});
```

Audit logs include:
- Action type (payment_approval, payment_rejection, payment_info_request)
- Event ID
- Order number
- Submission ID
- Amount
- User who performed the action
- Timestamp
- Additional details

## Real-time Updates

Payment actions emit real-time dashboard events using Socket.IO:

```javascript
emitDashboardEvent(order.eventId?._id, 'payment_approved', {
  orderId: order._id,
  submissionId: paymentSubmission._id,
  amount: paymentSubmission.amountPaid,
});
```

Available events:
- `payment_approved`: Payment has been approved
- `payment_rejected`: Payment has been rejected
- `payment_info_request`: Additional information requested

## Notification System

### Email Notifications
- Payment submission received confirmation
- Payment approval confirmation
- Payment rejection notification
- Information request notification

### SMS Notifications
- Payment submission received
- Payment approval confirmation
- Payment rejection notification
- Information request alert

### In-App Notifications
- Payment status updates
- Action confirmations
- Information requests

## Database Models

### PaymentSubmission Model
```javascript
{
  orderId: ObjectId,
  payerName: String,
  payerEmail: String,
  payerPhone: String,
  payerNicPassport: String,
  bankUsed: String,
  transferDate: Date,
  transferTime: String,
  referenceNumber: String,
  amountPaid: Number,
  receiptFile: String,
  receiptFileType: String,
  notes: String,
  verificationStatus: String, // pending, approved, rejected, needs_info
  rejectionReason: String,
  verifiedBy: ObjectId,
  verifiedAt: Date,
  submittedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Order Model Updates
```javascript
{
  paymentMethod: 'bank_transfer',
  paymentStatus: String, // pending, pending_verification, success, failed
  status: String, // PENDING_PAYMENT, PENDING_VERIFICATION, CONFIRMED, CANCELLED
}
```

## Integration Points

### Dashboard Controllers
- `dashboardController.js`: Updated to include payment submission data
- `roleBasedDashboardController.js`: Added payment statistics and recent submissions
- `buyerController.js`: Enhanced order details with payment information

### Routes
- `paymentManagement.js`: New dedicated payment management routes
- `bankTransfer.js`: Legacy bank transfer routes (updated)
- `adminRoutes.js`: Admin payment endpoints
- `organiser.js`: Organizer payment endpoints

### Middleware
- `auth.js`: Permission checking with `requirePermission`
- Role-based access control
- Event access validation

## Security Considerations

1. **Authentication**: All endpoints require authentication
2. **Authorization**: Role-based access control with permission checks
3. **Event Scoping**: Organizers only access their assigned events
4. **Audit Trail**: Complete logging of all payment actions
5. **Input Validation**: Comprehensive validation for all inputs
6. **Error Handling**: Graceful error handling with proper HTTP status codes

## Error Handling

Common error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Error codes:
- 400: Bad Request (invalid input, missing required fields)
- 401: Unauthorized (invalid or expired token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource not found)
- 500: Internal Server Error (unexpected errors)

## Testing Recommendations

### Unit Tests
- Test payment submission creation
- Test approval workflow
- Test rejection workflow
- Test information request workflow
- Test permission checks
- Test event scoping

### Integration Tests
- Test complete payment flow
- Test automatic workflow updates
- Test notification sending
- Test audit logging
- Test real-time events

### End-to-End Tests
- Test organizer dashboard payment management
- Test admin dashboard payment management
- Test export functionality
- Test filtering and search
- Test permission enforcement

## Future Enhancements

1. **Refund Processing**: Add refund workflow for approved payments
2. **Partial Approvals**: Support partial payment approvals
3. **Bulk Operations**: Bulk approve/reject payments
4. **Advanced Analytics**: Payment analytics and reporting
5. **Integration**: Payment gateway integration for verification
6. **Multi-currency**: Support for multiple currencies
7. **Scheduled Reviews**: Automated payment review scheduling
8. **Fraud Detection**: Automated fraud detection and alerting

## Support and Maintenance

For issues or questions related to the payment management system:
- Check audit logs for action history
- Review error logs for troubleshooting
- Verify user permissions for access issues
- Check event assignments for organizer access
- Validate payment submission data for verification issues

## Version History

- **v1.0.0**: Initial implementation
  - Basic payment management functionality
  - Organizer and admin dashboards
  - Automatic workflow updates
  - Audit logging
  - Export functionality
