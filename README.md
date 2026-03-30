# EAMS — Event Access Management System

Full-stack event access management platform built with React + Node.js + MongoDB.

## Stack
- **Frontend**: React 18, React Router v6, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, Mongoose
- **Database**: MongoDB
- **Auth**: JWT (RS256)

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas free tier)
- npm

---

### 1. Clone / unzip and set up

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env — set MONGODB_URI and other values
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start MongoDB
```bash
# Local MongoDB
mongod --dbpath /data/db

# Or use MongoDB Atlas — paste your connection string in .env
```

### 3. Seed the database
```bash
cd backend
npm run seed
```
This creates all demo accounts and the sample Big Match event.

**Demo credentials:**
| Role | Email | Password |
|------|-------|----------|
| Main Admin | admin@eams.com | Admin@123456 |
| Main Organiser | organiser@eams.com | Organiser@123 |
| Sub Organiser | suborg@eams.com | SubOrg@123 |
| Staff | staff@eams.com | Staff@123 |

### 4. Run the project

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# API running on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
# App running on http://localhost:3000
```

---

## Project Structure

```
eams/
├── backend/
│   ├── src/
│   │   ├── config/         # DB connection
│   │   ├── middleware/      # Auth, error handling
│   │   ├── models/          # Mongoose schemas
│   │   │   ├── User.js
│   │   │   ├── Event.js
│   │   │   ├── Order.js
│   │   │   ├── Ticket.js
│   │   │   ├── Attendee.js
│   │   │   └── EntryLog.js
│   │   ├── routes/          # Express route handlers
│   │   │   ├── auth.js
│   │   │   ├── events.js
│   │   │   ├── orders.js
│   │   │   ├── attendees.js
│   │   │   ├── users.js
│   │   │   └── entry.js
│   │   ├── utils/           # Email, seed
│   │   └── server.js
│   └── .env.example
│
└── frontend/
    └── src/
        ├── api/             # Axios service modules
        ├── components/
        │   ├── layout/      # Sidebar, DashboardLayout, PublicLayout
        │   └── ui/          # Button, Card, Table, Modal, Badge, Stat
        ├── context/         # AuthContext
        └── pages/
            ├── public/      # HomePage, EventDetailPage
            ├── auth/        # LoginPage
            ├── buyer/       # ConfirmOrderPage, AttendeeConfirmPage
            ├── admin/       # Dashboard, Events, Users
            ├── organiser/   # Dashboard, Attendees, Team, Logs, Reports
            ├── suborg/      # Dashboard, Attendees, BulkUpload, PhotoVerify
            ├── entry/       # EntryScannerPage
            └── auditor/     # AuditorDashboard
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| PATCH | /api/auth/update-password | Change password |

### Events
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | /api/events | Public — list events |
| GET | /api/events/:slug | Public — event detail |
| POST | /api/events | Admin only |
| PATCH | /api/events/:id | Admin / Organiser |
| PATCH | /api/events/:id/publish | Admin only |
| GET | /api/events/admin/all | Admin only |
| GET | /api/events/my/events | All roles |
| GET | /api/events/:id/dashboard | Organiser+ |

### Orders
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/orders | Public |
| GET | /api/orders/confirm/:token | Public |
| PATCH | /api/orders/:id/mark-paid | Public (payment hook) |

### Attendees
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | /api/attendees/confirm/:token | Public |
| POST | /api/attendees/confirm/:token | Public |
| GET | /api/attendees/template | Staff+ |
| POST | /api/attendees/bulk-upload | Sub-org+ |
| GET | /api/attendees | Staff+ |
| POST | /api/attendees | Sub-org+ |
| POST | /api/attendees/:id/invite | Sub-org+ |
| PATCH | /api/attendees/:id/verify-photo | Sub-org+ |

### Entry Control
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/entry/scan | Staff+ |
| GET | /api/entry/logs | Organiser+ |
| GET | /api/entry/stats | Organiser+ |
| GET | /api/entry/attendee/:qrToken | Staff+ |

### Users
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | /api/users | Admin / Organiser |
| POST | /api/users | Admin / Organiser |
| PATCH | /api/users/:id | Admin / Organiser |
| PATCH | /api/users/:id/assign-event | Admin / Organiser |
| PATCH | /api/users/:id/toggle-active | Admin / Organiser |

---

## Role Hierarchy

| Role | Description |
|------|-------------|
| `main_admin` | Full system access. Creates events, assigns organisers. |
| `main_organiser` | Manages one or more events. Adds sub-organisers and staff. |
| `sub_organiser` | Manages attendees for assigned event. Bulk upload, photo verify. |
| `staff` | Entry point scanning, zone access check. |
| `volunteer` | Limited entry point duties. |
| `auditor` | Read-only access to logs and reports. |

---

## Email Configuration

In development, emails are logged to the console (not sent). To enable real email:

1. Sign up for [SendGrid](https://sendgrid.com) (free tier)
2. Add credentials to `.env`:
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

---

## Payment Integration

The checkout flow is payment-gateway-ready. To connect Stripe:

1. Add `STRIPE_SECRET_KEY` to `.env`
2. In `backend/src/routes/orders.js`, replace the order creation response with a Stripe PaymentIntent
3. In `frontend/src/pages/public/EventDetailPage.jsx`, add `@stripe/stripe-js` and the card element

---

## RFID Integration

RFID wristband support is built into the data model. To connect hardware:

1. In `backend/src/routes/entry.js` `/scan` endpoint — pass `rfidId` instead of `qrToken`
2. Connect your hardware scanner SDK to POST to `/api/entry/scan`
3. Wristband issuance: the `wristbandId` field on `Attendee` is set on first check-in

---

## Next Steps (Sprint 2+)

- [ ] Real payment gateway (Stripe)
- [ ] WebSocket for live dashboard updates
- [ ] Event category/zone editor UI (admin)
- [ ] Attendee export to CSV/Excel
- [ ] Mobile PWA for entry scanners
- [ ] Email template customisation per event
- [ ] Multi-day event support

