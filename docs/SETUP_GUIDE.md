# EAMS Setup Guide: Communication & Payments

This guide provides detailed instructions for configuring email services and payment gateways for the EAMS platform.

---

## 1. SMTP (Email) Configuration

EAMS uses `nodemailer` to send transactional emails (invites, confirmations, ticket PDFs).

### Environment Setup
Update your `backend/.env` file with your SMTP credentials:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_api_key_here
EMAIL_FROM="EAMS Support <noreply@yourdomain.com>"
```

### Dashboard Customization
Main Organizers can customize templates per event:
1. Navigate to **Event Customization > Settings**.
2. Update **Invite**, **Confirmation**, and **Rejection** templates.
3. These templates support HTML and dynamic placeholders (e.g., `{{name}}`).

---

## 2. Payment Gateway Setup

The system is architected to handle multiple payment methods toggleable by the organizer.

### PayHere Integration (Default)
EAMS includes built-in support for PayHere (Sri Lanka's leading gateway).

1. **Credentials**: Add to `backend/.env`:
   ```env
   PAYHERE_MERCHANT_ID=your_merchant_id
   PAYHERE_SECRET=your_secret
   ```
2. **Environment**: The frontend is currently set to `https://sandbox.payhere.lk/pay/checkout`. For production, update the URL in `frontend/src/pages/public/CheckoutPage.jsx`.

### Stripe Integration
To switch to Stripe:
1. **Backend**: Install `stripe` npm package. Update `backend/src/routes/orders.js` to create a `PaymentIntent`.
2. **Frontend**: Use `@stripe/react-stripe-js` in `CheckoutPage.jsx`.

### Manual Payment Methods
- **Bank Transfer**: When enabled, the system provides bank details to the buyer. The order remains in `PENDING_PAYMENT` until an organizer manually verifies the transfer.
- **Cash at Venue**: When enabled, buyers can reserve tickets and pay at the physical gate.

---

## 3. Real-Time Setup (Socket.io)

No extra configuration is needed for real-time features.
- The backend initializes Socket.io on the same port as the API.
- The frontend connects automatically using `REACT_APP_API_URL`.
- Ensure your firewall allows WebSocket connections (usually port 5000 in dev, 443 in prod).
