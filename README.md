# ENTRYNEX / EAMS

**Event Access Management System**

## Overview
The ENTRYNEX/EAMS project is a full‑stack application for managing events, ticketing, access control, and payments. It provides separate front‑end (React) and back‑end (Node.js/Express) components, uses MongoDB for data storage, and integrates with email, SMS, and QR code services.

## Features
- Event creation & management with support for multiple event types (matches, concerts, conferences, workshops)
- Ticket ordering, assignment, and QR code generation
- Multiple payment methods (card, bank transfer, cash at entrance)
- Role‑based access control (admin, organiser, staff, auditor, attendee, sponsor, etc.)
- Real‑time updates via Socket.io
- Notification system (email, SMS, WhatsApp)
- Zone based access control and logging
- Sponsor package management
- Photo verification for attendees
- Short link generation for event pages

## Technology Stack
- **Frontend:** React, Tailwind CSS, Heroicons
- **Backend:** Node.js, Express, Mongoose, Socket.io
- **Database:** MongoDB
- **Auth:** JWT with MFA support
- **Payments:** Stripe / PayHere (webhooks)
- **Messaging:** SendGrid, Twilio, Azure Blob Storage
- **QR Codes:** qrcode library for ticket generation

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
- [01_PROJECT_OVERVIEW.md](docs/01_PROJECT_OVERVIEW.md) - High-level project overview and core modules
- [02_SYSTEM_ARCHITECTURE.md](docs/02_SYSTEM_ARCHITECTURE.md) - System architecture and component interactions
- [03_PROJECT_STRUCTURE.md](docs/03_PROJECT_STRUCTURE.md) - Repository structure and key directories
- [04_DATABASE_DOCUMENTATION.md](docs/04_DATABASE_DOCUMENTATION.md) - MongoDB collections and model definitions
- [05_DATABASE_RELATIONSHIPS.md](docs/05_DATABASE_RELATIONSHIPS.md) - Database relationships and references
- [06_API_DOCUMENTATION.md](docs/06_API_DOCUMENTATION.md) - Complete API endpoint reference
- [07_AUTHENTICATION_AUTHORIZATION.md](docs/07_AUTHENTICATION_AUTHORIZATION.md) - Auth mechanisms and JWT implementation
- [08_ROLES_PERMISSIONS.md](docs/08_ROLES_PERMISSIONS.md) - User roles and permission system
- [09_BUSINESS_LOGIC.md](docs/09_BUSINESS_LOGIC.md) - Core business logic flows
- [10_PAYMENT_TICKETING_FLOWS.md](docs/10_PAYMENT_TICKETING_FLOWS.md) - Payment processing and ticketing workflows
- [11_ZONE_ACCESS_CONTROL.md](docs/11_ZONE_ACCESS_CONTROL.md) - Zone-based access control system
- [12_NOTIFICATION_SYSTEM.md](docs/12_NOTIFICATION_SYSTEM.md) - Email, SMS, and WhatsApp notifications
- [13_SECURITY_DOCUMENTATION.md](docs/13_SECURITY_DOCUMENTATION.md) - Security best practices and implementation
- [14_ERROR_HANDLING_LOGGING.md](docs/14_ERROR_HANDLING_LOGGING.md) - Error handling and logging strategies
- [15_ENVIRONMENT_CONFIGURATION.md](docs/15_ENVIRONMENT_CONFIGURATION.md) - Environment variables and configuration
- [16_DEPLOYMENT_GUIDE.md](docs/16_DEPLOYMENT_GUIDE.md) - Deployment instructions
- [17_OPERATIONS_GUIDE.md](docs/17_OPERATIONS_GUIDE.md) - Operational procedures
- [18_TROUBLESHOOTING.md](docs/18_TROUBLESHOOTING.md) - Common issues and solutions
- [19_CHANGELOG.md](docs/19_CHANGELOG.md) - Project changelog
- [20_SECRET_ROTATION_AND_REMOVAL.md](docs/20_SECRET_ROTATION_AND_REMOVAL.md) - Secret management

## Running Tests
No automated test suites are included in this repository. The previous testing guide has been archived in `docs/17_TESTING_GUIDE.md`.

## Deploying
See [16_DEPLOYMENT_GUIDE.md](docs/16_DEPLOYMENT_GUIDE.md).

## Recent Updates
- **2026-08-31**: Fixed undefined `conference` error in EventDetailPage by adding proper variable extraction from event object
- **2026-08-05**: Updated error handling and logging documentation
- **2026-07-30**: Added comprehensive documentation files covering security, deployment, operations, and troubleshooting