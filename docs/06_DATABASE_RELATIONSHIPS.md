# 06_DATABASE_RELATIONSHIPS

## Overview
The EAMS system stores data in MongoDB using Mongoose. Relationships are defined via ObjectId references. Below is a concise map of how the primary collections relate to one another.

| Collection | References (One‑to‑Many / One‑to‑One) |
|------------|----------------------------------------|
| **User** | `company` → Company (many users belong to a company) |
| **Company** | `organisers` → User (users with role *organiser*) |
| **Event** | `company` → Company (owner)\n`zones` → Zone (embedded via separate collection) |
| **Zone** | `event` → Event (zone belongs to an event) |
| **Order** | `buyer` → User (buyer role)\n`event` → Event\n`tickets` → Ticket (array of ticket IDs) |
| **Ticket** | `event` → Event\n`order` → Order\n`attendee` → Attendee (optional)\n`inviteEmail`/`invitePhone` related to **Notification** via invite token |
| **Attendee** | `ticket` → Ticket (one‑to‑one) |
| **PaymentSubmission** | `order` → Order\n`paymentMethod` (enum) |
| **ZoneLog** | `zone` → Zone\n`ticket` → Ticket\n`entryLog` → EntryLog (optional) |
| **EntryLog** | `event` → Event\n`ticket` → Ticket |
| **AuditLog** | `user` → User (actor) |
| **Notification** | `user` → User (recipient)\n`relatedTicket` → Ticket (optional) |
| **ShortLink** | `event` → Event (maps short URL to event page) |
| **Sponsor** | `event` → Event |
| **SystemConfig** | No references – key/value store |
| **UserDevice** | `user` → User (device for push notifications) |
| **BankAccount** | `company` → Company |

### Example: Ticket → Event → Company
A **Ticket** references its **Event**, which in turn references the owning **Company**. This chain enables queries such as “find all tickets for a given company”.

### Loading Relations in Code
Mongoose `populate` is used throughout the service layer, e.g.:
```js
await Ticket.findById(id)
  .populate('event')
  .populate('attendee')
  .populate({ path: 'order', populate: { path: 'buyer' } })
```
All populate calls are defined in the respective controller/service files.

---
*All relationships are derived from the schema definitions in `backend/src/models/*.js`. No additional hidden links exist.*
