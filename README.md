<<<<<<< HEAD
# ENTRYNEX | Event Access Management System

Full-stack event access management platform built with React + Node.js + MongoDB, designed for large-scale sporting events and conferences.

## Stack
- **Frontend**: React 18, React Router v6, Tailwind CSS, Socket.io-client
- **Backend**: Node.js, Express, Mongoose, Socket.io
- **Database**: MongoDB (Atlas or Local)
- **Auth**: JWT (RS256 compliant)
- **Communication**: SMTP (SendGrid/Custom) & SMS (Twilio)
- **Real-time**: Bidirectional communication for dashboard, branding, and seat availability sync

---

## Core Features

- **Real-Time Seat Availability**: Ticket counts and category capacities update instantly across all connected clients (Public Detail Pages & Admin Dashboards) without page refreshes.
- **Resilient Notification Engine**: Decoupled Email and SMS delivery. Even if an email is already flagged as sent, critical SMS updates can be forced (e.g., for manual organiser approvals).
- **Multi-Stage Event Lifecycle**:
  - `Draft`: Private preparation mode.
  - `Published`: Live on public interface.
  - `Ongoing`: Live match tracking.
  - `Expired`: Auto-hidden from listings.
- **Role-Based Access Control (RBAC)**: 7 roles (SuperAdmin to Volunteer) with granular permissions.
- **Premium Branding Suite**: Organizers can customize theme colors, logos, and hero banners with real-time updates to public pages.
- **Advanced Photo Verification**: Secure attendee confirmation with manual and automated approval flows.
- **Private Ticket System**: Lock-and-key ticket categories requiring access codes.

---

## Quick Start

### 1. Installation
```bash
# Backend
cd backend
npm install
cp .env.example .env # Set your MONGODB_URI and Twilio/SendGrid keys

# Frontend
cd ../frontend
npm install
```

### 2. Database Seeding
```bash
cd backend
npm run seed
```
Creates default admin and organiser accounts for testing.

### 3. Run Development
**Terminal 1 (Backend):** `cd backend && npm run dev`
**Terminal 2 (Frontend):** `cd frontend && npm start`

---

## Configuration & Integration

### SMS (Twilio) Setup
1. In `backend/.env`, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.
2. The system automatically normalizes international numbers (e.g., Sri Lanka +94) and handles rate limiting.

### SMTP (Email) Setup
The system supports any SMTP provider (SendGrid, Mailgun, or custom). 
1. In `backend/.env`, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.
2. Organizers can customize email templates directly from their dashboard.

### Payment Gateway (PayHere)
Integrated with PayHere (Sandbox) by default.
1. Add `PAYHERE_MERCHANT_ID` and `PAYHERE_SECRET` to `.env`.
2. Includes automatic inventory release: if a payment fails or is cancelled, seats are immediately released back to the pool in real-time.

---

## Project Structure
```
eams/
├── backend/
│   ├── src/
│   │   ├── models/          # Event, User, Attendee, Ticket, EntryLog
│   │   ├── routes/          # API Handlers (Organiser, Admin, Public)
│   │   ├── services/        # Notification, SMS, PDF, Payment
│   │   └── utils/           # Socket.io, RBAC, Email helpers
├── frontend/
│   ├── src/
│   │   ├── api/             # API client modules
│   │   ├── context/         # Global Auth & State
│   │   └── pages/           # Admin, Organiser, Public, Checkout
└── docs/                # Extended documentation
```
=======
# ENTRYNEX
EAMS 
>>>>>>> 794b574fa363cdb7e87ee14f60082ce4f7fb9567
