# ENTRYNEX | Event Access Management System

Full-stack event access management platform built with React, Node.js, Express, Socket.IO, and MongoDB for ticketed events, entry control, attendee verification, and organiser operations.

## Stack

- **Frontend:** React 18, React Router v6, Tailwind CSS, Socket.IO client
- **Backend:** Node.js, Express, Mongoose, Socket.IO
- **Database:** MongoDB Atlas or local MongoDB
- **Auth:** JWT with role-based access control
- **Communication:** SMTP email plus optional Twilio SMS
- **Payments:** PayHere-ready checkout and order confirmation flows

## Core Features

- **Event lifecycle:** Draft, published, ongoing, completed, and cancelled states.
- **Role-based dashboards:** Main Admin, Main Organiser, Sub Organiser, Staff, Volunteer, Auditor, Buyer, and Attendee experiences.
- **Event customization:** Organisers can update event details, branding, communication settings, access rules, zones, and ticket categories from the dashboard.
- **Live dashboard:** Admins and organisers can monitor check-ins, denials, zone entries/exits, category breakdowns, and recent activity in real time.
- **Ticketing and checkout:** Public event listing, ticket selection, payment flow, inventory release, private ticket access codes, and buyer confirmation.
- **Photo verification:** Attendee photo submission, review queues, approval/rejection, and resubmission workflows.
- **Entry operations:** QR/RFID entry scan, zone access scan, manual search, activity logs, and gate/zone assignment controls.
- **Notifications:** In-app notifications, email templates, SMS support, and resend flows.

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Configure Environment

Copy `backend/.env.example` to `backend/.env`, then configure:

- `MONGODB_URI`
- JWT secret values
- SMTP credentials
- PayHere values, if checkout is enabled
- Twilio values, if SMS is enabled
- S3-compatible storage values, if remote uploads are enabled

### 3. Seed Data

```bash
cd backend
npm run seed
```

### 4. Run Locally

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm start
```

The frontend runs on `http://localhost:3000` and the backend API runs on `http://localhost:5000` by default.

## Important Routes

- Public site: `/`, `/events`, `/events/:id`, `/checkout`
- Admin dashboard: `/admin/dashboard`
- Admin live dashboard: `/admin/live`
- Organiser dashboard: `/organiser/dashboard`
- Organiser live dashboard: `/organiser/live`
- Staff entry scan: `/staff/scan`
- Staff zone access: `/staff/zone-access`

## Project Structure

```text
eams/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── utils/
│   └── scratch/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       ├── layouts/
│       └── pages/
└── docs/
```

## Documentation

Start with:

- [Quick Start](docs/QUICK_START.md)
- [Setup Guide](docs/SETUP_GUIDE.md)
- [System Features Summary](docs/SYSTEM_FEATURES_SUMMARY.md)
- [User Dashboard Guide](docs/USER_DASHBOARD_GUIDE.md)
- [Buyer Confirmation Portal Guide](docs/BUYER_CONFIRMATION_PORTAL_GUIDE.md)

## Notes

- Generated folders such as `node_modules`, `build`, `dist`, uploads, logs, and `.env` files are ignored by Git.
- Temporary one-off database/debug scripts should stay outside tracked source files unless they become maintained utilities.
