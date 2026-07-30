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
| `finalConfirmationService.js` | Assemble final order confirmation details, trigger notifications, and mark tickets as **SOLD**.

**Typical Flow (Buyer Order)**:
1. **Create Order** – `POST /buyer/orders` controller calls `orderService.createOrder` which stores the order and reserves tickets.
2. **Payment** – Webhook from Stripe/PayHere hits `paymentService.handleWebhook`, updates `Order.paymentStatus` and calls `notificationService.notifyOrderConfirmation`.
3. **Ticket Assignment** – Buyer assigns attendees via `POST /buyer/assign`. The controller updates `Ticket` documents, triggers `notificationService.notifyInvite` and `notifyBuyerTicketProgress`.
4. **Final Confirmation** – Once all tickets are `ASSIGNED`/`CONFIRMED`, `finalConfirmationService` marks them `SOLD`, sends final summary, and generates PDFs.

---
*All details extracted from the service files in `backend/src/services`.*
