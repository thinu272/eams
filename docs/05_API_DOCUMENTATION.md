# 05_API_DOCUMENTATION

## Overview
The Express backend exposes a RESTful API consumed by the React frontend. All routes are defined under `backend/src/routes` and follow the pattern:
```
GET    /api/<resource>
POST   /api/<resource>
PUT    /api/<resource>/:id
DELETE /api/<resource>/:id
```
Authentication is required for most endpoints via JWT (Bearer token in `Authorization` header).

## Authentication Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/auth/login` | Returns JWT on successful login. |
| POST   | `/api/auth/register` | Create a new user (admin/organiser). |
| GET    | `/api/auth/me` | Retrieve current user profile. |

## Core Resources
### Users (`/api/users`)
- **GET** `/users` – List users (admin only).
- **GET** `/users/:id` – Get user details.
- **PUT** `/users/:id` – Update user (admin/owner).
- **DELETE** `/users/:id` – Delete user.

### Events (`/api/events`)
- **GET** `/events` – Public list of events.
- **POST** `/events` – Create new event (organiser).
- **GET** `/events/:id` – Event details.
- **PUT** `/events/:id` – Update event.
- **DELETE** `/events/:id` – Remove event.

### Orders (`/api/orders`)
- **GET** `/buyer/orders` – Buyer order list.
- **POST** `/buyer/orders` – Create order.
- **GET** `/buyer/orders/:id` – Order details.
- **POST** `/buyer/assign` – Assign attendee to a ticket slot.

### Payments (`/api/payments`)
- **POST** `/payment/webhook` – Stripe/PayHere webhook handler.
- **GET** `/buyer/payment-history/:orderId` – Retrieve payment history.

### Tickets (`/api/tickets`)
- **GET** `/tickets/:id` – Ticket details.
- **POST** `/tickets/:id/invite` – Send invitation email/SMS.
- **PUT** `/tickets/:id/status` – Update ticket status (e.g., CONFIRMED, SOLD).

## Error Handling
All errors are returned in the following JSON shape:
```json
{ "error": "Message", "code": 400 }
```
Custom `ApiError` class used in `backend/src/middleware/errorHandler.js`.

## Rate Limiting & Validation
- Input validation via `express-validator` in each route file.
- Basic rate limiting applied globally (`middleware/rateLimiter.js`).

---
*Documentation generated from source code; endpoints may evolve.*
