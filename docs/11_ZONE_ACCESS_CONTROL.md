# 11_ZONE_ACCESS_CONTROL

## Overview
Zone access control determines whether an attendee may **enter** or **exit** a physical area (zone) within an event venue. The logic lives primarily in the **backend**:
- `backend/src/models/ZoneLog.js` records each scan attempt.
- `backend/src/models/EntryLog.js` records successful entry/exit events.
- `backend/src/services/notificationService.js` sends real‑time alerts when access is denied.
- Socket.io events (`zone:${zoneId}`) push live updates to staff dashboards.

## Data Model
| Model | Key Fields | Purpose |
|-------|------------|---------|
| **ZoneLog** | `attendeeId`, `eventId`, `zoneName`, `action` (ENTRY/EXIT), `accessGranted`, `denialReason`, `scanMethod` | Immutable audit of every scan attempt, successful or not. |
| **EntryLog** | `attendeeId`, `eventId`, `zoneId`, `zoneName`, `action` (check_in/check_out/zone_entry/zone_exit), `timestamp` | Stores successful entry/exit events for reporting. |
| **Ticket** (referenced) | `allowedZones` (array of zone IDs) | Declares which zones a ticket holder may access. |
| **Attendee** | `ticket` (ref), `zoneIds` (optional) | Represents the person assigned to a ticket; may carry zone restrictions. |

## Access Evaluation Flow
```mermaid
flowchart TD
    A[Scan QR or RFID] --> B{Validate Ticket}
    B -->|Valid| C{Check Allowed Zones}
    C -->|Allowed| D[Grant Access]
    C -->|Not Allowed| E[Deny Access]
    D --> F[Create EntryLog]
    E --> G[Create ZoneLog - denied]
    D --> H[Notify Staff via Socketio]
    E --> I[Notify Staff via Notification Service]
```
1. **Validate Ticket** – `Ticket` is fetched and must be in a status that permits entry (`CONFIRMED`, `SOLD`).
2. **Check Allowed Zones** – The ticket’s `allowedZones` array is compared with the scanned `zoneName`.
3. **Grant/Deny** – If allowed, an `EntryLog` is created and the gate opens; otherwise a `ZoneLog` with `accessGranted: false` and a `denialReason` (`NOT_ALLOWED`, `INVALID_TICKET`, `DUPLICATE_SCAN`) is stored.
4. **Notification** – Staff receive a real‑time notification via the `notifyStatusChange` function in `notificationService.js`.

## Configuration
- Global toggles for **SMS** and **WhatsApp** alerts are stored in `SystemConfig` under `communicationChannels.zoneAccess`.
- Per‑event overrides can be set in `Event.settings.communicationChannels.zoneAccess`.

---
*All details derived from `ZoneLog.js`, `EntryLog.js`, and the notification service.*
