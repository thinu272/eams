# EAMS System Features Summary

This document summarizes the core functional and architectural pillars of the EAMS (Event Access Management System) as of the latest version.

---

## 1. Professional Event Lifecycle
EAMS now features a robust lifecycle that ensures security and privacy during the setup phase.
- **Draft Mode**: All new events start as drafts, invisible to the public.
- **Organizer Publishing**: Main Organizers have the autonomy to take their events live once branding and payments are ready.
- **Status Automation**: Real-time badges and visibility filters handle "Ongoing" and "Expired" states automatically based on event timestamps.

## 2. Real-Time Seat & Branding Sync
The system delivers a "white-label" feel with live operational data.
- **Dynamic Theme Colors**: Public pages adapt their accent colors (badges, buttons, icons) to the organizer's chosen theme.
- **Instant Seat Availability**: Powered by Socket.io, ticket counts and category capacities update instantly across all user sessions.
- **Inventory Auto-Release**: If a payment fails or is cancelled, seats are immediately released back to the inventory and synced to all browsing users in real-time.
- **Live Operations Dashboard**: Admins and organisers can monitor check-ins, denials, zone entries/exits, zone occupancy, category breakdowns, and recent scans from `/admin/live` and `/organiser/live`.
- **Socket Rooms by Event**: Entry and zone scan broadcasts are scoped to event dashboard rooms so the active dashboard receives the correct real-time stream.

## 3. Resilient Communication Engine
High-reliability notification delivery for critical event operations.
- **Decoupled SMS & Email**: Notifications are processed independently. SMS delivery is no longer blocked by email status flags, ensuring attendees receive critical updates.
- **Forced Delivery Flow**: Organisers can force notification resends (e.g., for manual ticket approvals) to bypass "already sent" logic.
- **International Normalization**: SMS service automatically handles number formatting for global delivery (e.g., Sri Lankan +94 conversion).
- **Safe Notification Rendering**: Dashboard notifications tolerate missing or legacy timestamp fields and fall back gracefully instead of breaking the UI.

## 4. Financial & Payment Control
Flexible payment options tailored to diverse event needs.
- **Multi-Currency Support**: Selection from global currencies with localized symbol display.
- **Granular Payment Methods**: Organizers can toggle Card, Bank Transfer, and Cash options per event.
- **Integrated Gateways**: Native support for PayHere (Sandbox) with automated order confirmation flows.
- **Event Customization Recovery**: Organiser customization and settings saves recover from stale cached event IDs by falling back to the valid scoped event.

## 5. Secure Attendee Management
End-to-end security for tickets and entry.
- **Confirmation Portal**: A user-friendly system for buyers to assign tickets or invite guests.
- **QR Code Security**: Instant generation of secure QR tokens for verified attendees.
- **Manual Verification**: Improved flows for sub-organisers to review and approve attendee photos with immediate notification triggers.

---

## Technical Foundations
- **Backend**: Node.js/Express with Mongoose. Optimized for high-concurrency ticket sales and real-time socket broadcasting.
- **Frontend**: React 18 with Tailwind CSS. Using standard Vanilla CSS for maximum flexibility and premium aesthetics.
- **Real-Time**: Socket.io integration for instant status, branding, and seat availability updates.
- **Storage**: Multi-provider support (S3-compatible or local) for reliable image and asset management.
