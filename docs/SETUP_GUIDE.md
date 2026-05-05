# EAMS Setup Guide: Infrastructure & Services

This guide provides detailed instructions for configuring communication services, cloud storage, and payment gateways for the EAMS platform.

---

## 1. Communication Services

### SMTP (Email) Setup
EAMS uses `nodemailer` to send transactional emails (invites, confirmations, ticket PDFs). Update your `backend/.env` with your SMTP credentials:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_api_key_here
EMAIL_FROM="ENTRYNEX <noreply@entrynex.com>"
```

### SMS (Twilio) Setup
The system uses Twilio for high-priority ticket notifications and OTPs.
1. **Credentials**: Add to `backend/.env`:
   ```env
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```
2. **Normalization**: The service automatically handles international formatting (e.g., Sri Lanka +94).
3. **Rate Limiting**: Configured via `SMS_RATE_LIMIT_PER_WINDOW` to prevent abuse.

---

## 2. Cloud Storage (AWS S3)

EAMS uses S3-compatible storage for attendee photos and event branding assets.

1. **Configuration**: Add to `backend/.env`:
   ```env
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your_bucket_name
   ```
2. **Automated Cleanup**: The system includes a scheduler (`s3Cleanup.js`) that automatically removes orphaned or temporary assets based on the `S3_CLEANUP_AGE_DAYS` setting.

---

## 3. Payment Gateway Setup

### PayHere Integration (Default)
1. **Credentials**: Add to `backend/.env`:
   ```env
   PAYHERE_MERCHANT_ID=your_id
   PAYHERE_SECRET=your_secret
   ```
2. **Inventory Sync**: The system automatically releases reserved seats back to the public pool if a payment is cancelled or fails at the gateway.

---

## 4. Real-Time Infrastructure (Socket.io)

EAMS features bidirectional synchronization for:
- **Branding updates**: Theme changes reflect instantly for all users.
- **Seat Availability**: Real-time ticket counts update on public and admin pages.
- **Check-in Stats**: Live entry logs for gate staff.

Ensure your firewall allows WebSocket connections (standard port 5000 in dev).
