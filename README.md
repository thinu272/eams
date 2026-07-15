# ENTRYNEX | Event Access Management System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7+-47a248.svg)](https://www.mongodb.com/)
[![Swagger](https://img.shields.io/badge/Swagger-3.0+-85ea2d.svg)](https://swagger.io/)

A comprehensive full-stack event access management platform built with modern web technologies for ticketed events, entry control, attendee verification, and organiser operations.

## Table of Contents

- [Features](#features)
  - [Core Functionality](#core-functionality)
  - [Communication \& Notifications](#communication--notifications)
  - [Security \& Access Control](#security--access-control)
- [User Roles](#user-roles)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Environment Configuration](#environment-configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## Features

### Core Functionality

| Feature | Description |
|---------|-------------|
| **Event Lifecycle Management** | Complete event workflow from draft to completion with status transitions |
| **Multi-Role Dashboard System** | Role-based access for admins, organizers, staff, and attendees |
| **Real-time Monitoring** | Live dashboards with Socket.IO for real-time updates and event statistics |
| **Advanced Ticketing** | Public/private tickets, inventory management, and secure checkout |
| **Photo Verification** | Attendee identity verification with photo upload and approval workflows |
| **Entry Control** | QR/RFID scanning, zone access management, and activity logging |
| **Direct Bank Transfer Payments** | Comprehensive bank transfer payment management with verification workflows |
| **Payment Management UI** | Admin and organiser dashboards for approving/rejecting bank transfer payments |
| **Order History & Cancellation** | Buyers can view order history and request cancellations |
| **Live Event Dashboard** | Real-time monitoring of check-ins, zone occupancy, and ticket sales |

### Communication & Notifications

| Feature | Description |
|---------|-------------|
| **Multi-channel Notifications** | Email, SMS, and in-app notifications |
| **Customizable Templates** | Email and SMS templates for different event workflows |
| **Automated Communications** | Welcome emails, ticket confirmations, and verification requests |
| **WhatsApp Integration** | Send notifications via WhatsApp business API |
| **Notification Resend** | organisers can force notification resends |

### Security & Access Control

| Feature | Description |
|---------|-------------|
| **JWT Authentication** | Secure token-based authentication with refresh tokens |
| **Role-Based Access Control** | Granular permissions for different user types |
| **Event Scoping** | Users can only access authorized events and zones |
| **Multi-Factor Authentication** | TOTP-based MFA for enhanced account security |
| **Password Management** | Secure password change with history tracking |
| **Session Management** | Login tracking with session invalidation support |
| **Account Lockout** | Automatic lockout after failed login attempts |

---

## User Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **MainAdmin** | System administrator | Full system access, user management, system settings, all events |
| **MainOrganiser** | Event organizer | Event creation, ticket management, team management, payment approval |
| **SubOrganiser** | Assistant organizer | Limited event management, attendee oversight, zone-specific access |
| **Staff** | Entry personnel | Ticket scanning, entry control, zone access |
| **Volunteer** | Support staff | Limited entry control, basic verification |
| **Auditor** | read_files-only access | View reports, monitor activity, export data |
| **Buyer** | Ticket purchaser | Order tickets, manage bookings, view order history |
| **Attendee** | Event participant | Photo verification, check-in, ticket wallet |
| **Sponsor** | Event sponsor | Sponsor package access, assigned zones |

### Role Hierarchy

```
MainAdmin > MainOrganiser > SubOrganiser > Staff > Volunteer > Auditor > Sponsor > Attendee > Buyer
```

---

## Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **Node.js 18+** | Runtime environment |
| **Express.js** | Web framework |
| **MongoDB 7+** | Database with Mongoose ODM |
| **Socket.IO** | Real-time bidirectional communication |
| **JWT** | Token-based authentication |
| **bcryptjs** | Password hashing |
| **Helmet** | HTTP security headers |
| **Multer** | File upload handling |
| **Nodemailer** | Email sending |
| **Twilio** | SMS notifications |
| **AWS SDK (S3)** | File storage |
| **XLSX** | Excel file processing |

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework with Hooks |
| **React Router v6** | Client-side routing |
| **Tailwind CSS** | Utility-first styling |
| **Axios** | HTTP client |
| **Socket.IO Client** | Real-time updates |
| **Headless UI** | Accessible UI components |
| **Heroicons** | Icon library |

### DevOps & Tools

| Tool | Purpose |
|------|---------|
| **PM2** | Production process manager |
| **Nodemon** | Development hot reload |
| **ESLint** | Code linting |
| **Swagger UI** | API documentation |
| **Git** | Version control |

---

## Project Structure

```
eams/
├── backend/                          # Backend API server
│   ├── src/
│   │   ├── config/                   # Database configuration
│   │   ├── controllers/              # Route handlers
│   │   │   ├── adminController.js    # Admin operations
│   │   │   ├── attendeeController.js # Attendee management
│   │   │   ├── bankTransferController.js
│   │   │   ├── buyerController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── organiserController.js
│   │   │   ├── paymentManagementController.js
│   │   │   ├── photoVerificationController.js
│   │   │   └── roleBasedDashboardController.js
│   │   ├── middleware/               # Express middleware
│   │   │   ├── auth.js               # JWT authentication
│   │   │   ├── adminAuth.js          # Admin authorization
│   │   │   ├── organiserAuth.js      # Organiser authorization
│   │   │   ├── errorHandler.js       # Error handling
│   │   │   ├── maintenanceMode.js    # Maintenance toggle
│   │   │   ├── requestLogger.js      # Request logging
│   │   │   ├── sessionControl.js     # Session management
│   │   │   └── s3Upload.js           # S3 file uploads
│   │   ├── models/                   # MongoDB schemas
│   │   │   ├── Attendee.js
│   │   │   ├── AuditLog.js
│   │   │   ├── BankAccount.js
│   │   │   ├── Company.js
│   │   │   ├── EntryLog.js
│   │   │   ├── Event.js              # Event with zones, categories
│   │   │   ├── Notification.js
│   │   │   ├── Order.js
│   │   │   ├── PaymentSubmission.js  # Bank transfer verification
│   │   │   ├── RequestLog.js
│   │   │   ├── Role.js               # Custom roles
│   │   │   ├── ShortLink.js
│   │   │   ├── Sponsor.js
│   │   │   ├── SystemConfig.js
│   │   │   ├── SystemLog.js
│   │   │   ├── Ticket.js
│   │   │   ├── User.js               # User with MFA support
│   │   │   ├── UserDevice.js
│   │   │   └── ZoneLog.js
│   │   ├── routes/                   # API route definitions
│   │   │   ├── adminRoutes.js        # Admin endpoints
│   │   │   ├── organiser.js          # Organiser endpoints
│   │   │   ├── auth.js
│   │   │   ├── events.js
│   │   │   ├── orders.js
│   │   │   ├── attendees.js
│   │   │   ├── paymentManagement.js  # Payment approval
│   │   │   ├── bankTransfer.js
│   │   │   ├── verification.js
│   │   │   ├── tickets.js
│   │   │   └── ... (20+ more routes)
│   │   ├── services/                 # Business logic services
│   │   │   ├── notificationService.js
│   │   │   ├── paymentService.js
│   │   │   ├── smsService.js
│   │   │   ├── whatsappService.js
│   │   │   ├── photoUploadService.js
│   │   │   ├── photoValidationService.js
│   │   │   ├── ticketDeliveryService.js
│   │   │   ├── finalConfirmationService.js
│   │   │   ├── shortLinkService.js
│   │   │   ├── pdfService.js
│   │   │   └── s3Service.js
│   │   ├── utils/                    # Utility functions
│   │   │   ├── socket.js             # Socket.IO helpers
│   │   │   ├── rbac.js               # Role-based access control
│   │   │   ├── logger.js
│   │   │   └── s3Cleanup.js
│   │   ├── scripts/                  # Database scripts
│   │   └── server.js                 # Entry point
│   └── package.json
├── frontend/                         # React frontend application
│   ├── public/                       # Static assets
│   ├── src/
│   │   ├── api/                      # API client functions
│   │   │   ├── admin.js
│   │   │   ├── organiser.js
│   │   │   ├── buyer.js
│   │   │   └── ... (20+ API modules)
│   │   ├── components/               # Reusable UI components
│   │   │   ├── admin/
│   │   │   ├── buyer/
│   │   │   ├── organiser/
│   │   │   ├── staff/
│   │   │   ├── ui/
│   │   │   └── ... (component folders)
│   │   ├── context/                  # React context providers
│   │   │   ├── AuthContext.jsx       # Authentication state
│   │   │   └── MaintenanceModeContext.jsx
│   │   ├── layouts/                  # Page layout components
│   │   ├── pages/                    # Page components
│   │   │   ├── admin/
│   │   │   │   ├── AdminDashboard.jsx
│   │   │   │   ├── AdminEvents.jsx
│   │   │   │   ├── AdminUsers.jsx
│   │   │   │   ├── AdminSettings.jsx
│   │   │   │   ├── AdminPaymentManagement.jsx  # NEW
│   │   │   │   ├── LiveEventDashboard.jsx      # NEW
│   │   │   │   └── ...
│   │   │   ├── buyer/
│   │   │   │   ├── BuyerDashboardPage.jsx
│   │   │   │   ├── BuyerOrderHistoryPage.jsx   # NEW
│   │   │   │   ├── BuyerTicketsPage.jsx
│   │   │   │   ├── CheckoutPage.jsx
│   │   │   │   └── ...
│   │   │   ├── organiser/
│   │   │   │   ├── OrganiserDashboard.jsx
│   │   │   │   ├── OrganiserLive.jsx           # NEW
│   │   │   │   └── ...
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.jsx
│   │   │   │   ├── RegisterPage.jsx
│   │   │   │   ├── MfaSetupPage.jsx            # NEW
│   │   │   │   ├── PasswordChangePage.jsx      # NEW
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── utils/                    # Frontend utilities
│   │   ├── config/                   # Configuration
│   │   └── data/                     # Static data
│   └── package.json
├── docs/                             # Documentation
│   ├── SETUP_GUIDE.md
│   ├── API_REFERENCE.md              # Detailed API docs
│   ├── USER_DASHBOARD_GUIDE.md
│   └── ...
├── swagger.json                      # Swagger API documentation
└── README.md

---

## Quick Start

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18.0 or higher |
| MongoDB | 7.0+ (Atlas or local) |
| npm | 8.0+ or yarn 1.22+ |

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd eams

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Configuration

```bash
# Copy environment template
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/entrynex
# Or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/entrynex

# JWT
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@entrynex.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# WhatsApp (WhatsApp Business API)
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_TOKEN=your-whatsapp-token

# Payment Gateway (PayHere Sandbox)
PAYHERE_MERCHANT_ID=your-merchant-id
PAYHERE_SECRET=your-secret-key

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Frontend URL (for links in emails)
FRONTEND_URL=http://localhost:3000

# Development
NODE_ENV=development
PORT=5000
```

### Database Setup

```bash
cd backend
npm run seed
```

Creates default users:
- **Main Admin**: `admin@stadium.entrynex.com` / `Admin@Matrix.Reset`
- **Main Organiser**: `organiser@stadium.entrynex.com` / `Organiser@Matrix.Reset`
- **Sub Organiser**: `suborg@stadium.entrynex.com` / `SubOrg@Matrix.Reset`

### Run the Application

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm start
```

Access points:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api-docs

---

## API Documentation

Full API documentation is available via Swagger UI at `/api-docs` when running the server.

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password (authenticated) |
| POST | `/api/auth/mfa/setup` | Setup MFA |
| POST | `/api/auth/mfa/verify` | Verify MFA token |
| POST | `/api/auth/mfa/disable` | Disable MFA |

### Event Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/events` | List public events | Public |
| GET | `/api/events/:id` | Get event details | Public |
| POST | `/api/events` | Create event | MainAdmin, MainOrganiser |
| PUT | `/api/events/:id` | Update event | MainAdmin, MainOrganiser |
| DELETE | `/api/events/:id` | Delete event | MainAdmin |
| POST | `/api/events/:id/publish` | Publish event | MainOrganiser |
| POST | `/api/events/:id/duplicate` | Duplicate event | MainAdmin, MainOrganiser |

### Ticket Category Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/tickets/categories/:eventId` | List categories | Public |
| POST | `/api/tickets/categories` | Create category | MainOrganiser |
| PUT | `/api/tickets/categories/:id` | Update category | MainOrganiser |
| DELETE | `/api/tickets/categories/:id` | Delete category | MainOrganiser |

### Order Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/orders` | Create order | Public |
| GET | `/api/orders/:id` | Get order | Buyer, Admin |
| GET | `/api/orders/my-orders` | Buyer's orders | Buyer |
| POST | `/api/orders/:id/cancel` | Cancel order | Buyer, Admin |
| POST | `/api/orders/:id/confirm` | Confirm order | Buyer |

### Attendee Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/attendees` | List attendees | Organiser, Admin |
| POST | `/api/attendees` | Create attendee | Organiser |
| PUT | `/api/attendees/:id` | Update attendee | Organiser |
| DELETE | `/api/attendees/:id` | Delete attendee | Organiser |
| POST | `/api/attendees/:id/invite` | Send invite | Organiser |
| GET | `/api/attendees/verify/:token` | Verify attendee | Public |

### Payment Management Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/payment-management/organizer/` | List organiser payments | MainOrganiser |
| POST | `/api/payment-management/organizer/:submissionId/approve` | Approve payment | MainOrganiser |
| POST | `/api/payment-management/organizer/:submissionId/reject` | Reject payment | MainOrganiser |
| POST | `/api/payment-management/organizer/:submissionId/request-info` | Request info | MainOrganiser |
| GET | `/api/payment-management/admin/` | List all payments | MainAdmin |
| POST | `/api/payment-management/admin/:submissionId/approve` | Approve (admin) | MainAdmin |
| POST | `/api/payment-management/admin/:submissionId/reject` | Reject (admin) | MainAdmin |

### Bank Transfer Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/bank-transfer/submit` | Submit payment | Buyer |
| GET | `/api/bank-transfer/status/:orderId` | Check status | Buyer |
| POST | `/api/bank-transfer/webhook` | Payment webhook | Public |

### Photo Verification Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/verification/upload` | Upload photo | Buyer |
| GET | `/api/verification/status/:orderId` | Check status | Buyer, Organiser |
| POST | `/api/verification/approve/:id` | Approve photo | Organiser |
| POST | `/api/verification/reject/:id` | Reject photo | Organiser |

### Entry Control Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/entry/scan` | Scan QR code | Staff |
| GET | `/api/entry/logs` | Entry logs | Organiser, Admin |
| GET | `/api/entry/stats` | Entry statistics | Organiser, Admin |

### Zone Management Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/zone` | List zones | Public |
| POST | `/api/zone` | Create zone | Organiser |
| PUT | `/api/zone/:id` | Update zone | Organiser |
| DELETE | `/api/zone/:id` | Delete zone | Organiser |

### Sponsor Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/sponsor/packages/:eventId` | List packages | Public |
| POST | `/api/sponsor/packages` | Create package | Organiser |
| POST | `/api/sponsor/assign` | Assign sponsor | Organiser |

### Admin Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/workspace` | Admin dashboard data | MainAdmin |
| GET | `/api/admin/events` | List all events | MainAdmin |
| POST | `/api/admin/events` | Create event | MainAdmin |
| GET | `/api/admin/users` | List all users | MainAdmin |
| POST | `/api/admin/users` | Create user | MainAdmin |
| GET | `/api/admin/stats` | Platform statistics | MainAdmin |
| GET | `/api/admin/payments` | All payment submissions | MainAdmin |
| GET | `/api/admin/settings` | System settings | MainAdmin |
| PATCH | `/api/admin/settings` | Update settings | MainAdmin |
| GET | `/api/admin/reports/export` | Export reports | MainAdmin |

### Organiser Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/organiser/workspace` | Organiser dashboard | MainOrganiser, SubOrganiser |
| GET | `/api/organiser/attendees` | Event attendees | Organiser |
| POST | `/api/organiser/attendees` | Add attendee | Organiser |
| POST | `/api/organiser/attendees/bulk` | Bulk upload | Organiser |
| GET | `/api/organiser/verification` | Photo queue | Organiser |
| POST | `/api/organiser/verification/:id` | Verify photo | Organiser |
| GET | `/api/organiser/sub-organisers` | Team members | Organiser |
| POST | `/api/organiser/sub-organiser` | Add team member | Organiser |
| GET | `/api/organiser/sponsors` | Event sponsors | Organiser |
| POST | `/api/organiser/sponsors` | Add sponsor | Organiser |
| GET | `/api/organiser/payments` | Event payments | Organiser |
| GET | `/api/organiser/event/:id/stats` | Event statistics | Organiser |
| GET | `/api/organiser/event/:id/live` | Live dashboard | Organiser |

### Notification Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notifications` | User notifications | Auth |
| POST | `/api/notifications/send` | Send notification | Organiser |
| POST | `/api/notifications/:id/resend` | Resend notification | Organiser |

### User Profile Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/profile` | Get profile | Auth |
| PUT | `/api/users/profile` | Update profile | Auth |
| POST | `/api/users/mfa/setup` | Setup MFA | Auth |
| POST | `/api/users/mfa/verify` | Verify MFA | Auth |
| POST | `/api/users/mfa/disable` | Disable MFA | Auth |
| GET | `/api/users/sessions` | Active sessions | Auth |
| DELETE | `/api/users/sessions/:id` | Revoke session | Auth |

---

## Environment Configuration

### Required Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `JWT_EXPIRE` | Access token expiry | Yes |
| `PORT` | Server port | No (default: 5000) |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server host | - |
| `SMTP_PORT` | SMTP port | 587 |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `EMAIL_FROM` | From email address | - |
| `TWILIO_ACCOUNT_SID` | Twilio SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio token | - |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | - |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `AWS_REGION` | AWS region | us-east-1 |
| `S3_BUCKET_NAME` | S3 bucket name | - |
| `PAYHERE_MERCHANT_ID` | PayHere merchant ID | - |
| `PAYHERE_SECRET` | PayHere secret | - |
| `FRONTEND_URL` | Frontend URL | http://localhost:3000 |
| `NODE_ENV` | Environment | development |

---

## Development

### Available Scripts

#### Backend

```bash
cd backend
npm run dev      # Start development server with hot reload
npm start        # Start production server
npm run seed     # Seed database with sample data
npm run clear    # Clear database
npm run lint     # Run ESLint
```

#### Frontend

```bash
cd frontend
npm start        # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm test         # Run tests
```

### Code Quality

The project uses ESLint. Configuration is in `.eslintrc.js`.

### Real-time Updates

Socket.IO rooms:
- `dashboard:{eventId}` - Event dashboard updates
- `event:{eventId}` - Event-level updates
- `listings` - Public event listings updates

Client connection:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

// Join event dashboard
socket.emit('join_dashboard', { eventId: 'event-id' });

// Listen for updates
socket.on('event_update', (data) => {
  console.log('Event updated:', data);
});
```

### Database Models

#### Event Model
```javascript
{
  name: String,
  description: String,
  eventType: String, // 'cricket', 'concert', 'conference', 'other'
  venue: { name, address, city, country, mapUrl },
  startDate: Date,
  endDate: Date,
  status: String, // 'draft', 'published', 'ongoing', 'completed', 'cancelled'
  categories: [CategorySchema],
  zones: [ZoneSchema],
  settings: {
    currency: String,
    paymentMethods: { card, bank_transfer, cash },
    communicationChannels: { email, sms },
    // ... more settings
  },
  branding: { themeColor, logoImage, bannerImage },
  // ... more fields
}
```

#### User Model
```javascript
{
  name: String,
  email: String,
  password: String,
  role: String, // 'MainAdmin', 'MainOrganiser', 'SubOrganiser', etc.
  phone: String,
  status: String, // 'Active', 'Inactive'
  permissions: Object,
  assignedEvents: [ObjectId],
  mfaEnabled: Boolean,
  mfaSecret: String,
  // ... more fields
}
```

---

## Deployment

### Production Build

1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Environment Setup**:
   ```bash
   # Set production environment
   NODE_ENV=production
   ```

3. **Start Services**:

Using PM2 (recommended):
```bash
cd backend
npm install -g pm2
pm2 start src/server.js --name "entrynex-api"
```

Using npm:
```bash
cd backend
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

```bash
docker build -t entrynex-api .
docker run -p 5000:5000 entrynex-api
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name entrynex.com;

    # Frontend
    location / {
        root /var/www/entrynex/frontend/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Documentation

Additional documentation available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Detailed installation instructions |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | Complete API reference |
| [USER_DASHBOARD_GUIDE.md](docs/USER_DASHBOARD_GUIDE.md) | Role-specific user guides |
| [BUYER_CONFIRMATION_PORTAL_GUIDE.md](docs/BUYER_CONFIRMATION_PORTAL_GUIDE.md) | Buyer portal documentation |
| [PHOTO_CONFIRMATION_GUIDE.md](docs/PHOTO_CONFIRMATION_GUIDE.md) | Photo verification workflow |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for seamless event management**

## Changelog

### Version 2.0.0 (2026-07-15)

#### New Features
- **Payment Management UI**: Admin dashboard for approving/rejecting bank transfer payments
- **MFA Setup Page**: TOTP-based two-factor authentication for user accounts
- **Password Change Page**: Secure password change with history validation
- **Live Event Dashboard**: Real-time monitoring with Socket.IO updates
- **Order History & Cancellation**: Buyers can view order history and request cancellations
- **Swagger API Documentation**: Interactive API docs at /api-docs

#### Improvements
- Enhanced security with password history tracking
- Real-time seat availability updates
- Improved photo verification workflow
- Better zone access management

#### Bug Fixes
- Fixed event customization recovery from stale cache
- Fixed notification delivery for legacy timestamps
- Fixed zone assignment conflicts