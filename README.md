# ENTRYNEX / EAMS

**Event Access Management System**

## Overview
The ENTRYNEX/EAMS project is a full‑stack application for managing events, ticketing, access control, and payments. It provides separate front‑end (React) and back‑end (Node.js/Express) components, uses MongoDB for data storage, and integrates with email, SMS, and QR code services.

## Features
- Event creation & management
- Ticket ordering, assignment, and QR code generation
- Multiple payment methods (card, bank transfer, cash at entrance)
- Role‑based access control (admin, organiser, staff, auditor, attendee, etc.)
- Real‑time updates via Socket.io
- Notification system (email, SMS, WhatsApp)
- Zone based access control and logging

## Technology Stack
- **Frontend:** React, Tailwind CSS, Heroicons
- **Backend:** Node.js, Express, Mongoose, Socket.io
- **Database:** MongoDB
- **Auth:** JWT
- **Payments:** Stripe / PayHere (webhooks)
- **Messaging:** SendGrid, Twilio, Azure Blob Storage

## Prerequisites
- Node.js 18+
- npm
- MongoDB instance (local or remote)
- Environment variables (see `docs/15_ENVIRONMENT_CONFIGURATION.md` for Azure Storage and Face API settings)

## Installation
```bash
# Clone repo
git clone <repo-url>
cd eams

# Backend
cd backend
cp .env.example .env   # set variables
npm install
npm run dev   # starts server on port 5000

# Frontend
cd ../frontend
cp .env.example .env   # set REACT_APP_API_URL, etc.
npm install
npm start   # runs on http://localhost:3000
```

## Documentation Index
- [01_PROJECT_OVERVIEW.md](docs/01_PROJECT_OVERVIEW.md)
- [02_SYSTEM_ARCHITECTURE.md](docs/02_SYSTEM_ARCHITECTURE.md)
- [03_PROJECT_STRUCTURE.md](docs/03_PROJECT_STRUCTURE.md)
- [04_DATABASE_DOCUMENTATION.md](docs/04_DATABASE_DOCUMENTATION.md)
- [05_DATABASE_RELATIONSHIPS.md](docs/05_DATABASE_RELATIONSHIPS.md)
- [06_API_DOCUMENTATION.md](docs/06_API_DOCUMENTATION.md)
 - [03_PROJECT_STRUCTURE.md](docs/03_PROJECT_STRUCTURE.md)
 - [04_DATABASE_DOCUMENTATION.md](docs/04_DATABASE_DOCUMENTATION.md)
 - [05_API_DOCUMENTATION.md](docs/05_API_DOCUMENTATION.md)
 - [06_DATABASE_RELATIONSHIPS.md](docs/06_DATABASE_RELATIONSHIPS.md)
- [07_AUTHENTICATION_AUTHORIZATION.md](docs/07_AUTHENTICATION_AUTHORIZATION.md)
- [08_ROLES_PERMISSIONS.md](docs/08_ROLES_PERMISSIONS.md)
- [09_BUSINESS_LOGIC.md](docs/09_BUSINESS_LOGIC.md)
- [10_PAYMENT_TICKETING_FLOWS.md](docs/10_PAYMENT_TICKETING_FLOWS.md)
- [11_ZONE_ACCESS_CONTROL.md](docs/11_ZONE_ACCESS_CONTROL.md)
- [12_NOTIFICATION_SYSTEM.md](docs/12_NOTIFICATION_SYSTEM.md)
- [13_SECURITY_DOCUMENTATION.md](docs/13_SECURITY_DOCUMENTATION.md)
- [14_ERROR_HANDLING_LOGGING.md](docs/14_ERROR_HANDLING_LOGGING.md)
- [15_ENVIRONMENT_CONFIGURATION.md](docs/15_ENVIRONMENT_CONFIGURATION.md)
- [16_DEPLOYMENT_GUIDE.md](docs/16_DEPLOYMENT_GUIDE.md)
- [18_TROUBLESHOOTING.md](docs/18_TROUBLESHOOTING.md)
- [19_CHANGELOG.md](docs/19_CHANGELOG.md)

## Running Tests
No automated test suites are included in this repository. The previous testing guide has been archived in `docs/17_TESTING_GUIDE.md`.

## Deploying
See [16_DEPLOYMENT_GUIDE.md](docs/16_DEPLOYMENT_GUIDE.md).