# EAMS Documentation Index

This directory contains the main developer and product documentation for ENTRYNEX / EAMS.

## Quick Navigation

| Need | Read This |
|------|-----------|
| Get the app running | [QUICK_START.md](QUICK_START.md) |
| Configure services, email, storage, payments | [SETUP_GUIDE.md](SETUP_GUIDE.md) |
| Understand platform capabilities | [SYSTEM_FEATURES_SUMMARY.md](SYSTEM_FEATURES_SUMMARY.md) |
| Understand dashboards and RBAC | [USER_DASHBOARD_GUIDE.md](USER_DASHBOARD_GUIDE.md) |
| Review visual architecture | [VISUAL_ARCHITECTURE_DIAGRAMS.md](VISUAL_ARCHITECTURE_DIAGRAMS.md) |
| Buyer ticket assignment flow | [BUYER_CONFIRMATION_PORTAL_GUIDE.md](BUYER_CONFIRMATION_PORTAL_GUIDE.md) |
| Checkout system | [CHECKOUT_SYSTEM_README.md](CHECKOUT_SYSTEM_README.md) |
| Photo verification | [PHOTO_CONFIRMATION_GUIDE.md](PHOTO_CONFIRMATION_GUIDE.md) |

## Current Operational Areas

- **Public events and checkout:** Public listing, private ticket codes, order confirmation, and buyer assignment.
- **Admin workspace:** Global events, users, organisations, settings, reports, and `/admin/live`.
- **Organiser workspace:** Event customization, attendees, tickets, zones, team management, verification, reports, notifications, and `/organiser/live`.
- **Staff operations:** Entry scan, zone scan, manual search, and activity logs.
- **Auditor workspace:** Compliance dashboard, logs, and reports.

## Live Dashboard Reference

The shared live dashboard is implemented at `frontend/src/pages/shared/LiveDashboard.jsx`.

- Admin route: `/admin/live`
- Organiser route: `/organiser/live`
- Backend data routes: `backend/src/routes/dashboard.js`
- Realtime events: `entry_update` and `zone_update`
- Socket rooms: `dashboard:<eventId>`

The page loads all events for MainAdmin and assigned events for organisers. It displays check-in counters, denied entries, category breakdowns, zone occupancy, timelines, and recent activity.

## Cleanup Policy

Keep maintained scripts in named source or utility directories. Remove one-off debug files after use, especially scripts that hard-code database IDs or print local data snapshots. Generated folders and environment-specific files are ignored by `.gitignore`.

## Project Structure

```text
eams/
├── README.md
├── backend/
│   ├── src/
│   └── scratch/
├── frontend/
│   └── src/
└── docs/
```

## Status

- **Status:** Active development
- **Last updated:** 2026-05-08
