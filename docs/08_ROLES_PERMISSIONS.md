# 08_ROLES_PERMISSIONS

## Role Definitions
| Role | Description | Primary Permissions |
|------|-------------|----------------------|
| **MainAdmin** | Full system administrator. Can manage users, companies, events, and system configuration. | `*` (all) |
| **MainOrganiser** | Owner of a company (organisation) and can create/manage events, zones, sponsors, and staff under that company. | Create/Update/Delete Events, Zones, Sponsors, Staff; View all tickets for their events |
| **SubOrganiser** | Organiser with limited rights, typically assigned to a specific event. | Manage assigned event(s) – edit event details, zones, tickets; view attendees |
| **Staff** | Works for an organiser; handles day‑to‑day operations such as checking tickets, managing zones, and handling enquiries. | Access zone logs, entry logs, update ticket status (e.g., `CONFIRMED`, `CANCELLED`), send notifications |
| **Volunteer** | Assists staff on‑site; limited to scanning tickets and viewing basic event info. | Read‑only access to ticket validation endpoints; cannot modify data |
| **Auditor** | Audits system activity; read‑only across the platform. | View audit logs, request logs, system logs; cannot modify any data |
| **Sponsor** | Company sponsoring an event; can view their own sponsorship details & promotional materials. | Read access to `sponsor` resources, upload assets |
| **Attendee** | End‑user purchasing tickets. | Create orders, assign tickets, view personal tickets, receive notifications |

## Permission Implementation
Permissions are enforced in controller functions via role checks, e.g.:
```js
if (!['MainAdmin', 'MainOrganiser'].includes(req.user.role)) {
  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
}
```
A helper `authorize(allowedRoles)` middleware exists in `backend/src/middleware/authorize.js` that can be used as:
```js
router.post('/events', protect, authorize(['MainAdmin', 'MainOrganiser']), createEvent);
```
The `authorize` middleware simply verifies `allowedRoles.includes(req.user.role)` and returns 403 otherwise.

## Role Hierarchy
```
MainAdmin > MainOrganiser > SubOrganiser > Staff > Volunteer > Attendee
Auditor (parallel, read‑only)
Sponsor (parallel, limited read)
```
Higher roles inherit all permissions of the lower ones, except where explicitly overridden.

---
*Derived from the `User` model (`backend/src/models/User.js`) and the `authorize` middleware.*
