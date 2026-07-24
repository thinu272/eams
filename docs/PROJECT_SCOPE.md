# ENTRYNEX — Full Project Scope Document

> **Document Version:** 1.0  
> **Last Updated:** 2026-07-24  
> **Project Name:** ENTRYNEX (Event Access Management System — EAMS)  
> **Built By:** CBNIT

---

## 1. Executive Summary

ENTRYNEX is a comprehensive, full-stack **Event Access Management System** (EAMS) designed to manage the complete lifecycle of ticketed events — from event creation, ticket sales, and attendee verification through to real-time entry control and post-event analytics. The platform supports multi-tenant operations with role-based access control, real-time Socket.IO communication, multi-channel notifications, and integrated payment processing.

The system is built as a monorepo containing a **Node.js/Express** REST API backend with **MongoDB** (Mongoose ODM) and a **React 18** single-page application frontend styled with **Tailwind CSS**. It is designed for deployment across local, LAN, and cloud environments.

---

## 2. Project Objectives

| # | Objective |
|---|-----------|
| O1 | Provide a complete event lifecycle management platform from draft creation through event completion |
| O2 | Enable secure, multi-role access control for all stakeholders (admins, organisers, staff, buyers, attendees, auditors, sponsors) |
| O3 | Deliver real-time event monitoring with live dashboards for check-ins, zone occupancy, and ticket sales |
| O4 | Support multiple payment methods including card (Stripe/PayHere), direct bank transfer with verification workflows, and cash-at-entrance |
| O5 | Implement attendee identity verification through photo upload, review, and approval workflows |
| O6 | Provide QR code–based entry scanning and zone access control |
| O7 | Enable multi-channel notifications via email, SMS (Twilio), and WhatsApp |
| O8 | Offer a white-label experience with per-event branding (theme colours, logos, banners) |
| O9 | Support sponsor management with tiered packages and zone-specific access |
| O10 | Provide comprehensive audit logging, reporting, and data export capabilities |

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                      │
│  React Router v6 · Tailwind CSS · Axios · Socket.IO Client     │
│  Recharts · html5-qrcode · Headless UI · Heroicons             │
├─────────────────────────────────────────────────────────────────┤
│                    REST API + WebSocket (Socket.IO)              │
├─────────────────────────────────────────────────────────────────┤
│                     BACKEND (Node.js / Express)                  │
│  JWT Auth · Helmet · RBAC Middleware · Rate Limiting            │
│  Multer · PDFKit · Sharp · QRCode · XLSX · OTPLib              │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   MongoDB    │   AWS S3     │   Twilio     │  SMTP / SendGrid   │
│  (Mongoose)  │  (Storage)   │  (SMS)       │  (Email)           │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

### 3.1 Technology Stack

#### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| Express.js | 4.18 | Web framework & REST API |
| MongoDB | 7+ | Primary database (Mongoose 8 ODM) |
| Socket.IO | 4.8 | Real-time bidirectional communication |
| JWT (jsonwebtoken) | 9.x | Token-based authentication |
| bcryptjs | 2.x | Password hashing (12 salt rounds) |
| Helmet | 8.x | HTTP security headers |
| Multer | 1.4 | Multipart file upload handling |
| Sharp | 0.34 | Image processing & validation |
| PDFKit | 0.18 | PDF ticket generation |
| QRCode | 1.5 | QR code generation for tickets |
| Nodemailer / SendGrid | 8.x / 8.x | Email delivery |
| Twilio | 5.x | SMS notifications |
| AWS SDK (S3) | 2.x | Cloud file storage |
| OTPLib | 13.x | TOTP-based MFA |
| ExcelJS / XLSX | 4.x / 0.18 | Excel import/export |
| express-rate-limit | 7.x | API rate limiting |
| express-validator | 7.x | Input validation |
| node-schedule | 2.x | Background job scheduling |
| Swagger UI Express | 5.x | Interactive API documentation |

#### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2 | UI framework with Hooks |
| React Router | 6.20 | Client-side SPA routing |
| Tailwind CSS | 3.x | Utility-first CSS framework |
| Axios | 1.16 | HTTP client with interceptors |
| Socket.IO Client | 4.8 | Real-time updates |
| Recharts | 2.10 | Data visualisation & charts |
| html5-qrcode | 2.3 | Camera-based QR scanning |
| Headless UI | 1.7 | Accessible, unstyled UI components |
| Heroicons | 2.x | SVG icon library |
| react-hot-toast | 2.4 | Toast notifications |
| date-fns | 2.30 | Date formatting utilities |
| QRCode (client) | 1.5 | Client-side QR rendering |
| Lodash | 4.18 | Utility functions |

#### DevOps & Tools
| Tool | Purpose |
|------|---------|
| PM2 | Production process management |
| Nodemon | Development hot-reloading |
| Swagger / OpenAPI 3.0 | API documentation |
| Git | Version control |
| Docker | Containerised deployment |
| Nginx | Reverse proxy & static serving |

---

## 4. User Roles & Permissions Matrix

The system implements a **9-tier role hierarchy** with granular, scoped permissions.

### 4.1 Role Hierarchy

```
MainAdmin > MainOrganiser > SubOrganiser > Staff > Volunteer > Auditor > Sponsor > Attendee > Buyer
```

### 4.2 Detailed Role Permissions

| Role | Scope | Key Capabilities |
|------|-------|------------------|
| **MainAdmin** | Platform-wide | Full system access, user CRUD, event management across all events, system settings, payment oversight, maintenance mode, audit logs, reports export |
| **MainOrganiser** | Assigned events | Event creation & publishing, ticket category management, team management, attendee oversight, payment approval/rejection, zone & sponsor configuration, branding & settings, live dashboard, entry logs |
| **SubOrganiser** | Assigned event + zones | Zone-scoped attendee management, photo verification, entry/zone scanning, ticket management, payment oversight, team viewing, bulk upload, activity logs |
| **Staff** | Assigned event + gates | Entry scanning (QR), zone access scanning, manual attendee search, activity logging, photo verification, bulk upload |
| **Volunteer** | Assigned event | Limited entry scanning, basic verification, manual search |
| **Auditor** | Read-only across events | Dashboard viewing, audit log inspection, system logs, report generation, data export |
| **Sponsor** | Sponsor package scope | Sponsor dashboard, assigned zone access, package details |
| **Attendee (Buyer)** | Own tickets | Dashboard, ticket wallet, order history, payment history, invite management, photo confirmation, profile management, event browsing |
| **None** | Public | Event listing, event details, ticket checkout (guest) |

### 4.3 Role Normalisation

The backend normalises role strings on storage (e.g., `ADMIN` → `MainAdmin`, `BUYER` → `Attendee`) to ensure consistency across API boundaries.

---

## 5. Functional Modules

### 5.1 Event Lifecycle Management

**Scope:** Complete event workflow from creation to completion.

| Feature | Description |
|---------|-------------|
| Event Creation | Rich form with name, type (cricket/concert/conference/other), venue, dates, gates-open time, timezone |
| Event Types | Specialised detail schemas: `matchDetails` (cricket), `concertDetails`, `conferenceDetails` |
| Status Workflow | `draft` → `published` → `ongoing` → `completed` / `cancelled` |
| Auto-publishing | Organisers publish when branding and payments are ready |
| Slug Generation | Auto-generated URL-safe slugs from event names |
| Event Duplication | Clone existing events as new drafts |
| Event Branding | Per-event theme colour, logo, banner, and cover images |
| Event Settings | Currency, payment methods, photo verification toggle, confirmation deadline, max tickets per order, RFID toggle, invite limits, communication channels, MFA enforcement |
| Custom Fields | Configurable per-attendee data collection (text, number, date, select, file) |

**Status Transitions:**
```
              ┌──────────┐
              │  Draft    │
              └────┬─────┘
                   │ publish
              ┌────▼─────┐
              │ Published │
              └────┬─────┘
                   │ auto (date-based)
              ┌────▼─────┐
              │  Ongoing  │──── cancel ────┐
              └────┬─────┘                 │
                   │ auto (end date)  ┌────▼─────┐
              ┌────▼─────┐           │ Cancelled │
              │ Completed │           └──────────┘
              └──────────┘
```

---

### 5.2 Ticketing System

**Scope:** Multi-tier ticket categories with inventory management.

| Feature | Description |
|---------|-------------|
| Category Management | Create/update/delete ticket categories per event |
| Pricing | Per-category pricing with multi-currency support (default: LKR) |
| Capacity Control | Per-category seat limits with real-time sold tracking |
| Zone Assignment | Categories linked to allowed venue zones |
| Benefits | Per-category benefit lists |
| Custom Fields | Category-specific data collection fields |
| Private Tickets | Access-code protected categories with usage limits |
| Visibility Control | Show/hide categories from public listing |
| Inventory Sync | Real-time seat availability via Socket.IO broadcasts |
| Auto-Release | Seats released on payment failure/cancellation |

---

### 5.3 Order & Checkout System

**Scope:** End-to-end order processing from cart to confirmation.

| Feature | Description |
|---------|-------------|
| Guest Checkout | Order without account creation |
| Multi-ticket Orders | Multiple categories in single order |
| Order Numbers | Auto-generated unique order references (`ORD-{timestamp}-{random}`) |
| Confirmation Tokens | UUID-based secure order confirmation links |
| Order Statuses | `PENDING` → `PENDING_PAYMENT` → `PENDING_VERIFICATION` → `CONFIRMED` / `CANCELLED` / `EXPIRED` / `RESERVED` |
| Payment Statuses | `pending` / `pending_verification` / `paid` / `rejected` / `expired` / `awaiting_payment` / `success` / `failed` |
| Order History | Buyer can view all past orders with details |
| Order Cancellation | Buyer or admin can cancel with reason tracking |
| Refund Workflow | `none` → `pending` → `approved` / `rejected` → `completed` |
| Notification Channel | Buyer selects email, SMS, or both for order updates |
| Reservation Expiry | Timed reservations with automatic expiry job |

---

### 5.4 Payment Processing

**Scope:** Multi-method payment handling with verification workflows.

#### 5.4.1 Payment Methods

| Method | Flow |
|--------|------|
| **Card (PayHere/Stripe)** | Gateway redirect → webhook callback → auto-confirm |
| **Direct Bank Transfer** | Instructions page → buyer uploads proof → organiser/admin reviews → approve/reject |
| **Cash at Entrance** | Reservation created → instructions sent → pay at gate → staff confirms |

#### 5.4.2 Bank Transfer Verification Workflow

```
Buyer submits proof ──► Pending Verification ──► Organiser/Admin reviews
                                                        │
                               ┌────────────────────────┼────────────────┐
                               ▼                        ▼                ▼
                          Approved               Request Info        Rejected
                          (auto-confirm            (buyer              (order
                           order + tickets)        resubmits)         cancelled)
```

| Feature | Description |
|---------|-------------|
| Payment Submission | Upload bank slip with reference number |
| Organiser Dashboard | Filter, search, approve/reject payments for own events |
| Admin Dashboard | Platform-wide payment oversight with advanced filtering |
| Audit Logging | All payment actions logged with actor, timestamp, notes |
| Auto-Confirmation | Approved payment automatically confirms order, activates tickets, generates QR, sends notifications |
| Scheduler | Background job for bank transfer expiry and status management |

---

### 5.5 Attendee Management & Identity Verification

**Scope:** Attendee registration, photo verification, and ticket assignment.

| Feature | Description |
|---------|-------------|
| Attendee Registration | Via order confirmation, invite acceptance, or manual creation |
| Ticket Assignment | Buyers assign tickets to named attendees with email/phone |
| Invite System | Buyers can invite guests (up to configurable limit per attendee) |
| Bulk Upload | Excel/CSV upload for mass attendee import |
| Photo Verification | Attendee uploads identity photo for review |
| Photo Validation | Server-side image processing (Sharp) for format/size validation |
| Verification Queue | Organisers/sub-organisers review photos in approval queue |
| Approve/Reject Flow | Approve generates QR ticket; reject triggers resubmission link |
| Resubmission | Rejected attendees receive link to upload new photo |
| Confirmation Portal | Buyer-facing portal to assign tickets and manage attendee info |
| Attendee Status Tracking | Track confirmation, verification, and check-in status |

---

### 5.6 Entry Control & QR Scanning

**Scope:** Real-time venue entry management with QR/RFID scanning.

| Feature | Description |
|---------|-------------|
| QR Code Scanning | Camera-based QR scanning via html5-qrcode library |
| Entry Scanner | Main gate entry point — validates ticket + records entry |
| Zone Scanner | Zone-specific access control scanner |
| Manual Search | Staff can search attendees by name/email/phone for manual entry |
| Entry Logging | Every scan recorded with timestamp, gate, staff member, result |
| Zone Logging | Zone entry/exit tracking with occupancy monitoring |
| Duplicate Detection | Prevents re-entry on same ticket |
| Real-time Updates | Scans broadcast to live dashboards via Socket.IO |
| RFID Support | Configurable RFID-based entry (toggle per event) |
| Cash-at-Entrance | Staff confirms cash payment + processes entry simultaneously |

---

### 5.7 Live Event Dashboard

**Scope:** Real-time operational monitoring during events.

| Feature | Description |
|---------|-------------|
| Check-in Counters | Live count of checked-in vs. total attendees |
| Zone Occupancy | Real-time occupancy per zone |
| Ticket Sales | Live ticket category sales breakdown |
| Recent Scans | Rolling feed of latest entry/zone scans |
| Denial Log | Track denied entries with reasons |
| Category Breakdown | Visual breakdown by ticket category |
| Socket.IO Rooms | Event-scoped rooms (`dashboard:{eventId}`, `event:{eventId}`) for targeted broadcasts |
| Admin Live View | `/admin/live` — platform-wide monitoring |
| Organiser Live View | `/organiser/live` — event-scoped monitoring |

---

### 5.8 Zone Management

**Scope:** Venue zone configuration and access control.

| Feature | Description |
|---------|-------------|
| Zone CRUD | Create, update, delete zones per event |
| Capacity Tracking | Per-zone capacity with real-time occupancy |
| Colour Coding | Custom colours for visual zone identification |
| Sub-Organiser Assignment | Assign sub-organisers to specific zones |
| Access Rules | Allowed roles, time windows, and notes per zone |
| Zone-Category Linking | Link ticket categories to allowed zones |
| Zone Logs | Track entry/exit events per zone |

---

### 5.9 Notification System

**Scope:** Multi-channel, template-driven notification engine.

| Feature | Description |
|---------|-------------|
| Email (SMTP/SendGrid) | Transactional emails via Nodemailer or SendGrid |
| SMS (Twilio) | Text notifications via Twilio API |
| WhatsApp | Business API integration for WhatsApp messages |
| In-App Notifications | Stored notifications viewable in user dashboard |
| Custom Templates | Per-event email and SMS templates for invite, confirmation, rejection |
| Automated Triggers | Welcome emails, ticket confirmations, verification requests, payment updates |
| Forced Resend | Organisers can force re-delivery bypassing "already sent" logic |
| International Formatting | Auto-normalisation of phone numbers (e.g., Sri Lankan +94) |
| Decoupled Delivery | SMS and email processed independently (failures don't block each other) |
| Graceful Fallback | Dashboard tolerates missing/legacy timestamp fields |

---

### 5.10 Sponsor Management

**Scope:** Sponsor package creation and sponsor-zone assignment.

| Feature | Description |
|---------|-------------|
| Sponsor Packages | Tiered packages (Platinum, Gold, Silver, Custom) |
| Package Configuration | Capacity (number of passes), price, zones, benefits, contact, visibility, expiry |
| Sponsor Assignment | Assign sponsors to packages with zone access |
| Sponsor Dashboard | Sponsor-specific dashboard with package details |

---

### 5.11 Authentication & Security

**Scope:** Comprehensive security layer with MFA and session management.

| Feature | Description |
|---------|-------------|
| JWT Authentication | Access + refresh token pair with configurable expiry |
| Password Hashing | bcryptjs with 12 salt rounds |
| Password History | Tracks last 3 passwords to prevent reuse |
| Password Policy | Minimum 8 characters |
| MFA (TOTP) | Time-based one-time password via OTPLib with QR setup |
| MFA Backup Codes | Emergency backup codes for account recovery |
| Email Verification | Token-based email verification for new accounts |
| Password Reset | Token-based password reset flow via email |
| Temporary Passwords | Admin-created accounts with forced password change on first login |
| Account Lockout | Auto-lock after failed login attempts |
| Session Tracking | Login timestamps with session management |
| Rate Limiting | Express rate limiter on sensitive endpoints |
| CORS Configuration | Configurable allowed origins (dev: open, prod: whitelist) |
| Helmet | HTTP security headers |
| Cookie Parser | Secure cookie handling |
| Request Logging | All API requests logged |

---

### 5.12 Admin & System Management

**Scope:** Platform-wide administration and configuration.

| Feature | Description |
|---------|-------------|
| Admin Dashboard | Unified dashboard with sections: events, users, settings, reports, verification, payments |
| User Management | Create, update, activate/deactivate users across all roles |
| System Settings | Platform-wide configuration (maintenance mode, currency, etc.) |
| Maintenance Mode | Toggle system-wide maintenance with role-based bypass |
| Audit Logging | Track all administrative actions |
| System Logs | View system-level logs |
| Report Export | Export event data and reports (Excel/XLSX) |
| Platform Statistics | Aggregate stats across all events |
| Super Admin Routes | Extended admin capabilities via `/api/super-admin` |

---

### 5.13 Sub-Organiser Module

**Scope:** Delegated event management for assistant organisers.

| Feature | Description |
|---------|-------------|
| Sub-Org Dashboard | Zone-scoped event overview |
| Attendee Management | View/manage attendees in assigned zones |
| Photo Verification | Review and approve/reject attendee photos |
| Entry/Zone Scanning | QR-based scanning for assigned zones |
| Team Viewing | View team members and assignments |
| Ticket Management | Manage tickets within scope |
| Payment Oversight | View payments for assigned events |
| Bulk Upload | Excel-based attendee import |
| Activity Logs | View zone-scoped activity history |

---

### 5.14 Staff & Volunteer Module

**Scope:** Field-level operations for event personnel.

| Feature | Description |
|---------|-------------|
| Staff Dashboard | Event overview with assigned gates/zones |
| Entry Scanning | QR-based gate entry processing |
| Zone Access Scanning | Zone entry/exit tracking |
| Manual Search | Search attendees by name/email/phone |
| Zone Manual Search | Zone-specific attendee lookup |
| Activity Log | View personal scan/activity history |
| Photo Verification | Staff-level verification access |
| Bulk Upload | Staff-initiated attendee import |

---

### 5.15 Auditor Module

**Scope:** Read-only audit and compliance monitoring.

| Feature | Description |
|---------|-------------|
| Auditor Dashboard | Overview of event metrics |
| Audit Logs | Detailed action audit trail |
| System Logs | System-level event logs |
| Reports | Generate and view compliance reports |

---

### 5.16 Buyer & Attendee Portal

**Scope:** Ticket purchaser and event-goer self-service.

| Feature | Description |
|---------|-------------|
| Buyer Dashboard | Overview of orders, tickets, and invites |
| Buyer Home | Landing page for authenticated buyers |
| Order History | View all past and current orders |
| Order Details | Detailed order view with ticket assignment |
| Payment History | Bank transfer payment status tracking |
| Ticket Wallet | Digital ticket wallet with QR codes |
| Ticket Assignment | Assign purchased tickets to named attendees |
| Invite System | Invite guests and track invite status |
| Photo Confirmation | Upload identity photos for verification |
| Profile Management | Update personal information |
| Attendee Dashboard | Attendee-specific view (tickets, events, notifications) |
| Attendee Tickets | View assigned tickets with QR |
| Attendee Events | Browse events with assigned tickets |
| Attendee Notifications | View personal notification history |
| Resubmit Photo | Upload new photo if previous was rejected |

---

### 5.17 Reporting & Analytics

**Scope:** Data-driven insights and export capabilities.

| Feature | Description |
|---------|-------------|
| Live Dashboard | Real-time Recharts-based visualisations |
| Reports Dashboard | Shared reports page for admin/organiser |
| Event Statistics | Per-event metrics (sales, attendance, revenue) |
| Export to Excel | XLSX report generation and download |
| Audit Trail | Complete action history for compliance |
| Entry Analytics | Check-in patterns, peak times, denial rates |

---

### 5.18 File Management

**Scope:** Secure file upload, storage, and cleanup.

| Feature | Description |
|---------|-------------|
| S3 Storage | AWS S3-compatible cloud storage for images and assets |
| Local Fallback | Backward-compatible local uploads directory |
| S3 Cleanup Scheduler | Background job to clean up orphaned S3 objects |
| Image Processing | Sharp-based resize, format validation |
| PDF Generation | PDFKit-based ticket PDF creation |
| Profile Photos | User profile photo upload with S3 storage |
| Event Branding Assets | Logo, banner, cover image uploads |

---

### 5.19 Short Links

**Scope:** Branded short URLs for sharing.

| Feature | Description |
|---------|-------------|
| Short Link Generation | Create short codes for tickets/events |
| Short Link Redirect | `/t/:code` redirect to full URL |
| Link Tracking | Track link usage |

---

### 5.20 Background Jobs & Schedulers

**Scope:** Automated background processing.

| Feature | Description |
|---------|-------------|
| Reservation Expiry | Expire timed reservations (cash-at-entrance) |
| Bank Transfer Scheduler | Auto-expire pending bank transfers |
| S3 Cleanup | Periodic cleanup of orphaned storage objects |
| Event Status Automation | Auto-transition events based on dates |

---

## 6. Data Models

The system uses **19 MongoDB collections** via Mongoose:

| Model | Description |
|-------|-------------|
| `User` | Users with role, MFA, permissions, assigned events/zones |
| `Event` | Events with categories, zones, sponsor packages, settings, branding |
| `Order` | Orders with tickets, payment details, refund tracking |
| `Ticket` | Individual issued tickets |
| `Attendee` | Attendees with verification status, photo, custom fields |
| `PaymentSubmission` | Bank transfer submissions with verification workflow |
| `BankAccount` | Organiser bank account details for transfer instructions |
| `EntryLog` | Gate entry scan records |
| `ZoneLog` | Zone entry/exit records |
| `Notification` | In-app notification records |
| `AuditLog` | Administrative action audit trail |
| `SystemLog` | System-level event logs |
| `RequestLog` | API request logging |
| `Company` | Organisation/company entities |
| `Sponsor` | Sponsor assignments |
| `Role` | Custom role definitions |
| `ShortLink` | URL shortener records |
| `SystemConfig` | Platform-wide configuration |
| `UserDevice` | Device tracking for sessions |

---

## 7. API Surface

The backend exposes **30+ route modules** mounted under `/api`:

| Route Prefix | Module | Description |
|-------------|--------|-------------|
| `/api/auth` | Authentication | Register, login, logout, refresh, password reset, MFA |
| `/api/users` | User Profile | Profile CRUD, MFA management, sessions |
| `/api/events` | Events | Public event listing, CRUD, publish, duplicate |
| `/api/orders` | Orders | Order CRUD, confirmation, cancellation |
| `/api/confirm` | Confirmation | Order/ticket confirmation flows |
| `/api/attendees` | Attendees | Attendee CRUD, invite, verify |
| `/api/verification` | Photo Verification | Upload, approve, reject photos |
| `/api/tickets` | Tickets | Ticket category management |
| `/api/invite` | Invites | Invite system management |
| `/api/sponsor` | Sponsors | Sponsor packages and assignments |
| `/api/entry` | Entry Control | QR scanning, entry logs, stats |
| `/api/zone` | Zones | Zone CRUD and access management |
| `/api/dashboard` | Dashboard | Dashboard data endpoints |
| `/api/audit` | Audit | Audit log queries |
| `/api/super-admin` | Super Admin | Extended admin operations |
| `/api/user` | User Portal | User self-service portal |
| `/api/short-links` | Short Links | URL shortener |
| `/api/organiser` | Organiser | Organiser workspace & operations |
| `/api/notifications` | Notifications | Notification management |
| `/api/buyer` | Buyer | Buyer-specific operations |
| `/api/buyer/payment-history` | Payment History | Buyer payment tracking |
| `/api/admin` | Admin | Admin workspace & operations |
| `/api/sub` | Sub-Organiser | Sub-organiser operations |
| `/api/staff` | Staff | Staff-specific operations |
| `/api/payment` | Payment | Payment gateway integration |
| `/api/bank-transfer` | Bank Transfer | Bank transfer submission & status |
| `/api/payment-management` | Payment Management | Organiser/admin payment approval |
| `/api/entrance` | Entrance | Cash-at-entrance processing |
| `/api/upload` | Upload | File upload handling |
| `/api/devices` | Devices | Device management |

Interactive API documentation is available at `/api-docs` via Swagger UI.

---

## 8. Real-Time Communication (Socket.IO)

### 8.1 Socket Rooms

| Room | Pattern | Purpose |
|------|---------|---------|
| Dashboard | `dashboard:{eventId}` | Live dashboard metrics |
| Event | `event:{eventId}` | Event-level broadcasts |
| Listings | `listings` | Public event listing updates |

### 8.2 Events Broadcast

- Entry scan results (check-in, denial)
- Zone entry/exit events
- Ticket sale updates (seat availability)
- Payment status changes
- Event status transitions
- Branding and settings changes

---

## 9. Frontend Page Inventory

### 9.1 Public Pages (8 pages)
- Home, Events Listing, Event Detail, Checkout, Order Confirmation
- Attendee Identity Confirmation, Maintenance Page, Short Link Redirect

### 9.2 Authentication Pages (9 pages)
- Login, Signup, Signup Success, Forgot Password, Reset Password
- Verify Email, Change Temp Password, Password Change, MFA Setup

### 9.3 Buyer Pages (19 pages)
- Dashboard, Home, Tickets, Order History, Order Details, Payment History
- Bank Transfer (Instructions, Submit, Thank You), Invite Accept
- Confirm Pass, Checkout, Confirm Order, Cash Entrance Instructions
- Invites, Profile, Ticket Wallet, Resubmit Page

### 9.4 Attendee Pages (8 pages)
- Dashboard, Tickets, Ticket View, Confirmation, Events
- Profile, Notifications, Resubmit Photo

### 9.5 Admin Pages (11 files)
- Dashboard (unified), Payment Management, Events, Users
- Settings, Settings Panel, Reports, Verification Dashboard, Event Form

### 9.6 Organiser Pages (7 pages)
- Dashboard (unified), Entry Logs, Attendees, Team
- Payments Dashboard, Reports, Settings

### 9.7 Sub-Organiser Pages (13 pages)
- Dashboard, Zones, Attendees, Verification, Entry Scanner
- Zone Scanner, Zone Manual Search, Activity Logs, Team
- Tickets, Payments, Bulk Upload, Photo Verify

### 9.8 Staff Pages (7 pages)
- Dashboard, Scan, Zone Access, Manual Search
- Zone Manual Search, Activity Log, Verification

### 9.9 Entry Pages (2 pages)
- Entry Scanner, Zone Scanner

### 9.10 Auditor Pages (4 pages)
- Dashboard, Logs, System Logs, Reports

### 9.11 Sponsor Pages (1 page)
- Sponsor Dashboard

### 9.12 Shared Pages (3 pages)
- Live Dashboard, Reports Dashboard, Event Edit

### 9.13 Enhanced Pages (1 page)
- User Dashboard (enhanced)

**Total: ~93 unique page/view components**

---

## 10. Integration Points

| Integration | Provider | Purpose |
|------------|----------|---------|
| MongoDB Atlas | MongoDB | Cloud database hosting |
| AWS S3 | Amazon | File/image storage |
| Azure Blob Storage | Microsoft | Alternative file storage |
| SMTP (Gmail) | Google | Email delivery |
| SendGrid | Twilio | Transactional email |
| Twilio SMS | Twilio | SMS notifications |
| WhatsApp Business API | Meta | WhatsApp messaging |
| PayHere | PayHere | Payment gateway (Sri Lanka) |
| Stripe | Stripe | International payment gateway |
| Swagger/OpenAPI | — | API documentation |

---

## 11. Deployment Architecture

### 11.1 Supported Environments

| Environment | Backend Binding | Frontend | Notes |
|-------------|----------------|----------|-------|
| Local Development | `127.0.0.1:5000` | `localhost:3000` | Default configuration |
| LAN Testing | `0.0.0.0:5000` | `0.0.0.0:3000` | Firewall rules required |
| Production | Behind Nginx | Static build | PM2 process manager |
| Docker | Container | Container | Dockerfile provided |

### 11.2 Production Stack

```
                    ┌─────────────┐
                    │   Nginx     │
                    │ (Port 80)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼                         ▼
    ┌─────────────────┐      ┌──────────────────┐
    │ React Build     │      │ Node.js API      │
    │ (Static Files)  │      │ (PM2 Managed)    │
    │ /var/www/build   │      │ Port 5000        │
    └─────────────────┘      └────────┬─────────┘
                                      │
                             ┌────────▼─────────┐
                             │  MongoDB Atlas    │
                             │  + AWS S3         │
                             └──────────────────┘
```

---

## 12. Security Considerations

| Area | Implementation |
|------|---------------|
| Authentication | JWT access + refresh tokens |
| Password Storage | bcryptjs (12 rounds) |
| Password History | Last 3 passwords tracked |
| MFA | TOTP with backup codes |
| API Security | Helmet headers, CORS, rate limiting |
| Input Validation | express-validator on all routes |
| File Upload | Multer with size/type restrictions + Sharp validation |
| Role Enforcement | Middleware-based RBAC on every route |
| Event Scoping | Users only access authorised events |
| Session Control | Login tracking, session invalidation |
| Account Lockout | Auto-lock after failed attempts |
| Maintenance Mode | System-wide lockout with admin bypass |
| Audit Trail | All sensitive operations logged |
| Sensitive Data | Password, tokens, MFA secrets excluded from JSON responses |

---

## 13. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Real-time Latency** | < 500ms for Socket.IO event propagation |
| **Concurrent Users** | Designed for high-concurrency ticket sales |
| **Browser Support** | Last 1 Chrome version (dev), >0.2% market share (prod) |
| **Mobile Responsiveness** | Tailwind CSS responsive breakpoints |
| **API Documentation** | 100% endpoint coverage via Swagger |
| **File Storage** | Multi-provider (S3, Azure Blob, local fallback) |
| **Internationalisation** | Multi-currency, international phone normalisation |
| **Default Timezone** | Asia/Colombo (configurable per event) |

---

## 14. Out of Scope (Current Version)

The following items are **not** included in the current scope:

- Native mobile applications (iOS/Android)
- Multi-language / i18n UI translations
- Advanced analytics / BI dashboards
- Automated ticket pricing (dynamic pricing)
- Seat map / arena layout visual editor
- Social media integration for event sharing
- Waitlist management
- Recurring / series events
- Ticket transfer between buyers
- Affiliate / referral tracking
- White-label domain mapping per organiser

---

## 15. Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-24 | CBNIT | Initial comprehensive scope document |

---

*This document reflects the complete scope of the ENTRYNEX Event Access Management System as of version 2.0.0. For API-level details, refer to the interactive Swagger documentation at `/api-docs`. For deployment instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md) and [LAN_RUN.md](../LAN_RUN.md).*
