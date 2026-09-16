# 09_BUSINESS_LOGIC

## Overview
The core business logic of EAMS lives in the **service layer** (`backend/src/services`). Each service encapsulates a specific domain responsibility and is invoked by route controllers.

| Service | Primary Responsibilities |
|---------|--------------------------|
| `notificationService.js` | Build and send multi‑channel notifications (email, SMS, WhatsApp), create persistent `Notification` documents, handle cash‑reservation messaging. |
| `paymentService.js` | Integrate with Stripe and PayHere, verify webhooks, update `Order` status, generate PDF receipts. |
| `ticketDeliveryService.js` | Generate PDF tickets, send them via email, update ticket status after delivery. |
| `pdfService.js` | Helper for creating order summary PDFs using `pdfkit`. |
| `s3Service.js` | Upload and retrieve files from Azure Blob / S3 storage (used for attendee photos). |
| `smsService.js` / `whatsappService.js` | Wrapper around Twilio/WhatsApp APIs for sending transactional messages. |
| `shortLinkService.js` | Create short URLs that map to deep‑link routes (used in notifications). |
| `photoValidationService.js` | Validate attendee upload dimensions, file type, and size. |
| `finalConfirmationService.js` | Assemble final order confirmation details, trigger notifications, and mark tickets as **SOLD**. |
| `rfidService.js` | RFID tag normalization, validation (10-digit format), assignment to attendees, and unassignment. |

**Typical Flow (Buyer Order)**:
1. **Create Order** – `POST /buyer/orders` controller calls `orderService.createOrder` which stores the order and reserves tickets.
2. **Payment** – Webhook from Stripe/PayHere hits `paymentService.handleWebhook`, updates `Order.paymentStatus` and calls `notificationService.notifyOrderConfirmation`.
3. **Ticket Assignment** – Buyer assigns attendees via `POST /buyer/assign`. The controller updates `Ticket` documents, triggers `notificationService.notifyInvite` and `notifyBuyerTicketProgress`.
4. **Final Confirmation** – Once all tickets are `ASSIGNED`/`CONFIRMED`, `finalConfirmationService` marks them `SOLD`, sends final summary, and generates PDFs.

**RFID Assignment Workflow**:
1. Staff scans attendee QR code or performs manual search.
2. Backend validates the RFID tag format (10 digits) and checks availability.
3. RFID tag is assigned to the attendee via `rfidService.assignRfidToAttendee()`.
4. The tag's `status` changes from `AVAILABLE` to `ASSIGNED`, linking to the attendee and ticket.
5. Organizers can view all assigned RFID tags with attendee details through the RfidAssignmentView component (view-only registry).
6. Category information is resolved from the `Ticket.categoryName` field for accurate assignment records.

---
*All details extracted from the service files in `backend/src/services`.*
