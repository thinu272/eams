# EAMS System Features Summary

This document summarizes the core functional and architectural pillars of the EAMS (Event Access Management System) as of the latest version.

---

## 1. Professional Event Lifecycle
EAMS now features a robust lifecycle that ensures security and privacy during the setup phase.
- **Draft Mode**: All new events start as drafts, invisible to the public.
- **Organizer Publishing**: Main Organizers have the autonomy to take their events live once branding and payments are ready.
- **Status Automation**: Real-time badges and visibility filters handle "Ongoing" and "Expired" states automatically based on event timestamps.

## 2. Premium Branding & UX Sync
The system delivers a "white-label" feel for every event.
- **Dynamic Theme Colors**: Public pages and cards automatically adapt their accent colors (badges, buttons, icons) to the organizer's chosen theme.
- **Real-Time Synchronization**: Powered by Socket.io, any change in the organizer's dashboard is instantly reflected for buyers browsing the event.
- **Design Consistency**: Standardized UI across Home, Listing, and Detail pages for a premium, unified experience.

## 3. Financial & Payment Control
Flexible payment options tailored to diverse event needs.
- **Multi-Currency Support**: Selection from global currencies with localized symbol display.
- **Granular Payment Methods**: Organizers can toggle Card, Bank Transfer, and Cash options per event.
- **Integrated Gateways**: Built-in support for PayHere (Sandbox) and architecture ready for Stripe.

## 4. Secure Attendee Management
End-to-end security for tickets and entry.
- **Confirmation Portal**: A user-friendly system for buyers to assign tickets or invite guests.
- **QR Code Security**: Instant generation of secure QR tokens for verified attendees.
- **Staff Entry Control**: Real-time entry logs and occupancy tracking for gate staff and organizers.

---

## Technical Foundations
- **Backend**: Node.js/Express with Mongoose. Optimized for high-concurrency ticket sales.
- **Frontend**: React 18 with Tailwind CSS. Using standard Vanilla CSS for maximum flexibility.
- **Real-Time**: Socket.io integration for instant status and branding updates.
- **Storage**: Local disk storage (Multer) for reliable image management.
