# ENTRYNEX — Event Access Management System

Full-stack event access management platform built with React + Node.js + MongoDB, designed for large-scale sporting events and conferences.

## Stack
- **Frontend**: React 18, React Router v6, Tailwind CSS, Socket.io-client
- **Backend**: Node.js, Express, Mongoose, Socket.io
- **Database**: MongoDB (Atlas or Local)
- **Auth**: JWT (RS256 compliant)
- **Communication**: SMTP (SendGrid/Custom) & SMS (Twilio)
- **Real-time**: Bidirectional communication for dashboard & branding sync

---

## Core Features

- **Multi-Stage Event Lifecycle**:
  - `Draft`: Private preparation mode.
  - `Published`: Live on public interface.
  - `Ongoing`: Live match tracking.
  - `Expired`: Auto-hidden from listings.
- **Role-Based Access Control (RBAC)**: 7 roles (SuperAdmin to Volunteer) with granular permissions.
- **Premium Branding Suite**: Organizers can customize theme colors, logos, and hero banners with real-time updates to public pages.
- **Advanced Photo Verification**: AI-ready photo reviews for secure attendee confirmation.
- **Private Ticket System**: Lock-and-key ticket categories requiring access codes.
- **Real-Time Dashboards**: Live check-in stats and visual branding synchronization across all users.

---

## Quick Start

### 1. Installation
```bash
# Backend
cd backend
npm install
cp .env.example .env # Set your MONGODB_URI

# Frontend
cd ../frontend
npm install
```

### 2. Database Seeding
```bash
cd backend
npm run seed
```
Creates:
- **Admin**: admin@stadium.entrynex.com / Admin@Matrix.Reset
- **Organiser**: organiser@stadium.entrynex.com / Organiser@Matrix.Reset
- **Sub-Org**: suborg@stadium.entrynex.com / SubOrg@Matrix.Reset
- **Staff**: staff@stadium.entrynex.com / Staff@Matrix.Reset
- **Auditor**: auditor@stadium.entrynex.com / Auditor@Matrix.Reset
- **Attendee**: attendee@stadium.entrynex.com / Attendee@Matrix.Reset
- **Sample Event**: "The Big Match 2025" (Draft)

### 3. Run Development
**Terminal 1 (Backend):** `cd backend && npm run dev`
**Terminal 2 (Frontend):** `cd frontend && npm start`

---

## Configuration & Integration

### SMTP (Email) Setup
The system supports any SMTP provider (SendGrid, Mailgun, or custom). 
1. In `backend/.env`, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.
2. Organizers can customize email templates (Invite, Confirmation, Rejection) directly from their dashboard.

### Payment Gateway (PayHere / Stripe)
The checkout system is integrated with PayHere (Sandbox) by default.
1. Add `PAYHERE_MERCHANT_ID` and `PAYHERE_SECRET` to `.env`.
2. Organizers can toggle **Card**, **Bank Transfer**, or **Cash** payments per event.
3. For Stripe, update `CheckoutPage.jsx` and the `orders.js` route.

### Architecture Guide
For deeper technical details, see:
- [System Features Summary](./docs/SYSTEM_FEATURES_SUMMARY.md)
- [Visual Architecture Diagrams](./docs/VISUAL_ARCHITECTURE_DIAGRAMS.md)
- [Payment & Communication Setup](./docs/SETUP_GUIDE.md)

---

## Project Structure
```
eams/
├── backend/
│   ├── src/
│   │   ├── models/          # Event, User, Attendee, Ticket, EntryLog
│   │   ├── routes/          # API Handlers (Organiser, Admin, Public)
│   │   ├── services/        # Notification, Photo Validation
│   │   └── server.js        # Entry point with Socket.io
├── frontend/
│   ├── src/
│   │   ├── api/             # API client modules
│   │   ├── context/         # Global Auth & State
│   │   └── pages/           # Admin, Organiser, Public, Checkout
└── docs/                # Extended documentation
```
