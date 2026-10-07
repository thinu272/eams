# ENTRYNEX/EAMS V28 Security & Functionality Requirements Document

**Version:** V28
**Audit Date:** 2026-10-06
**Status:** CONDITIONALLY READY FOR PRODUCTION
**Overall Assessment:** 2 Critical, 12 High, 18 Medium, 15 Low issues

---

## 1. Summary

This document defines the requirements for resolving security vulnerabilities and functionality gaps identified in the ENTRYNEX/EAMS V28 audit. The primary focus is on:

1. **Event Isolation and IDOR Prevention** — Implementing centralized event authorization to prevent unauthorized cross-event data access
2. **Payment Security** — Adding server-side validation for all payment callbacks with amount verification and idempotency
3. **QR Token Security** — Ensuring all QR-based lookups are properly event-scoped
4. **Main Organizer Isolation** — Removing bypass patterns that allow organizers to access events they are not assigned to
5. **Event Customization Persistence** — Moving from frontend-only state to proper backend persistence
6. **Socket.IO Security** — Adding authorization checks for room joins
7. **Token Security** — Implementing token invalidation on logout

**Assumptions:**
- MongoDB remains the primary database
- Redis is available for token blocklist (if not available, database-backed fallback will be required)
- PayHere remains the primary payment provider
- Azure Blob Storage is configured for file uploads
- Existing test infrastructure will be extended rather than replaced

---

## 2. Functional Requirements

### 2.1 Event Authorization Framework (CRIT-001, HIGH-001)

**Requirement EA-001:** Create a centralized `requireEventAccess(user, eventId, permission)` middleware function.

**Behavior:**
- `user.role === MAIN_ADMIN`: Bypass all event access restrictions
- `user.role === MAIN_ORGANISER`: Verify user has explicit event assignment or ownership
- `user.role === SUB_ORGANISER`: Verify assigned scope (event, zone, or category)
- `user.role === STAFF`: Verify event assignment and permitted operational functions
- `user.role === VOLUNTEER`: Verify event assignment and permitted functions
- `user.role === AUDITOR`: Verify read/audit scope for the event
- `user.role === SPONSOR`: Verify sponsor scope for the event
- `user.role === ATTENDEE` or `BUYER`: Access only their own permitted data within the event

**Implementation Location:** `backend/src/middleware/auth.js`

**Acceptance Tests:**
- Organizer A accessing Event A → ALLOW
- Organizer A accessing Event B (not assigned) → DENY 403
- Organizer B accessing Event A (not assigned) → DENY 403
- Admin accessing any event → ALLOW

---

### 2.2 IDOR Prevention for Event-Scoped Resources (CRIT-001)

**Requirement IDOR-001:** All event-scoped resources must resolve their actual event before authorization.

**For each resource type, resolve event from:**

| Resource Type | Resolution Path |
|---------------|-----------------|
| attendeeId | attendee.event |
| ticketId | ticket.event |
| orderId | order.event |
| paymentId | payment.order.event |
| entryLogId | entryLog.event |
| rfidAssignmentId | assignment.event |
| zoneId | event.zones (lookup required) |
| gateId | event.gates (lookup required) |

**Requirement IDOR-002:** Never authorize based solely on an eventId supplied by the client.

**Affected Routes:**
- `backend/src/routes/attendees.js`
- `backend/src/routes/entry.js`
- `backend/src/routes/rfid.js`
- `backend/src/routes/tickets.js`
- `backend/src/routes/orders.js`
- `backend/src/routes/payment.js`
- `backend/src/routes/zones.js`
- `backend/src/routes/gates.js`

---

### 2.3 QR Token Lookup Security (CRIT-001)

**Requirement QR-001:** All QR lookup endpoints must enforce event scope.

**Endpoint: GET /attendees/by-qr/:qrToken**

**Validation Flow:**
1. Retrieve attendee by QR token from database
2. Extract attendee's eventId from resolved resource
3. If request includes eventId parameter, verify it matches attendee.event
4. Verify `userHasEventAccess(req.user, attendee.event)` 
5. Return only authorized attendee fields (never expose sensitive data)

**Other Affected Endpoints:**
- `GET /entry/attendee/:qrToken`
- `POST /entry/scan`
- Any additional QR-based lookups

**Security Requirement:** QR token must never allow unrestricted cross-event attendee lookup.

---

### 2.4 PayHere Payment Security (CRIT-002)

**Requirement PAY-001:** PayHere webhook must perform server-side validation before marking payment successful.

**Validation Steps (mandatory, in order):**

1. **Signature Verification:** Verify MD5 signature matches calculated hash
2. **Merchant ID:** Validate `merchant_id` matches configured merchant ID
3. **Order Existence:** Verify `order_id` exists in database
4. **Order Ownership:** Verify order belongs to event user has access to
5. **Expected Amount:** Calculate from database order (authoritative source)
6. **Callback Amount:** Extract from payment callback
7. **Amount Validation:** Require exact equality: `expectedAmount === callbackAmount`
8. **Currency:** Validate currency matches expected
9. **Payment Status:** Verify not already marked successful
10. **Order Status:** Verify order not already processed

**Requirement PAY-002:** Implement idempotency for payment processing.

**Behavior:**
- First valid callback: Process payment, create tickets, create attendees, send notifications
- Duplicate valid callback: Detect already processed, skip ticket creation, skip attendee creation, skip notifications, return success without side effects

**Use case:** Use order status or payment status field as idempotency key.

**Requirement PAY-003:** Never trust frontend data for payment validation.

**Untrusted Sources (validate against database):**
- Frontend total amount
- Frontend payment status
- Frontend order status
- Frontend ticket quantity
- Frontend price

**Requirement PAY-004:** Safe decimal handling for currency.

**Implementation:** Use integer cents (or smallest currency unit) for all calculations, avoid floating-point arithmetic for monetary values.

---

### 2.5 Main Organizer Isolation (HIGH-001)

**Requirement MO-001:** Remove unconditional bypass patterns.

**Find and Replace Pattern:**
```javascript
// BEFORE (INSECURE)
if (role === MAIN_ADMIN || role === MAIN_ORGANISER) {
  return next();
}

// AFTER (SECURE)
if (role === MAIN_ADMIN) {
  return next();  // MainAdmin bypass
}
// MainOrganiser must still pass requireEventAccess
```

**Affected Operations:**
- `GET /events` — Organizer sees only assigned events
- `GET /events/:id` — Verify assignment before showing details
- `PUT /events/:id` — Verify ownership/assignment
- `DELETE /events/:id` — Verify ownership/assignment
- Event customization endpoints
- Team member management
- Gate/zone management
- Reports access
- Entry log access
- RFID management
- Payment access
- Export operations

---

### 2.6 Token Security (HIGH-002)

**Requirement TOKEN-001:** Implement token invalidation on logout.

**Options (choose one):**
1. **Redis Blocklist:** Store jti (JWT ID) in Redis with TTL matching token expiry
2. **Database Blocklist:** Store blocked tokens in MongoDB with expiry

**Preferred Approach:** Redis for performance; database fallback if Redis unavailable.

**Behavior:**
- POST /auth/logout: Add token to blocklist, return success
- All protected routes: Check blocklist before processing
- Blocklist TTL: Match JWT expiry time

**Requirement TOKEN-002:** Ensure logout works across devices/sessions.

**Behavior:** User logout from one device does NOT invalidate tokens on other devices (session-specific logout).

---

### 2.7 Socket.IO Room Authorization (HIGH-006)

**Requirement SOCKET-001:** All event room joins must verify authorization before joining.

**Current Issue:** `join_event` accepts any eventId without authorization check.

**Required Flow:**
1. Client emits `join_event` with eventId
2. Server verifies `userHasEventAccess(user, eventId, 'socket_join')`
3. On success: Client joins room
4. On failure: Emit error, client not joined

**Affected Rooms:**
- `event_<eventId>` rooms
- `admin_event_<eventId>` rooms
- Any event-scoped rooms

**Error Handling:** Return clear error, do not silently fail.

---

### 2.8 Event Customization Persistence (HIGH-008)

**Requirement PERSIST-001:** All event settings must persist to MongoDB.

**Current Issue:** React-only state updates without backend saves.

**Affected Components:**
- Main Entry Gates
- Team Members
- Zones
- Ticket Categories
- Event Settings
- RFID Settings
- Payment Methods
- Event Access Settings
- Notification Settings
- Confirmation Settings

**Required Flow:**
1. User changes setting in UI
2. Frontend sends API request
3. Backend validates authorization
4. Backend validates input
5. MongoDB updates document
6. API returns saved state
7. Frontend updates state from response
8. Refresh/reload retrieves from MongoDB (not localStorage)

**Verification Requirements:**
- Browser refresh: Value persists
- Logout/login: Value persists
- Different device/browser: Value persists
- API reload: Value persists
- Server restart: Value persists

**Forbidden Patterns:**
- Storing settings only in localStorage
- Storing settings only in React state
- UI appearing saved without API confirmation

---

### 2.9 Local Filesystem Upload Fix (HIGH-012)

**Requirement UPLOAD-001:** Production must use Azure Blob Storage for file uploads.

**Current Issue:** Local uploads folder not safe for Azure ephemeral filesystem.

**Required Behavior:**
- Development: May use local filesystem (with warning)
- Production: Must use Azure Blob Storage SDK
- Multer config: Detect environment, use appropriate storage engine

**Implementation:** `backend/src/routes/upload.js`, multer configuration

---

### 2.10 Secondary Security Requirements

**Requirement SEC-001 (HIGH-003):** Race condition prevention for ticket purchases.

**Implementation:**
- Use MongoDB transactions for ticket allocation
- Acquire row-level lock or use optimistic concurrency
- Verify ticket availability before allocation
- Handle sold-out scenarios gracefully

**Requirement SEC-002 (HIGH-004):** RFID tag unique constraint.

**Implementation:**
- Add unique index on rfidTag in relevant collections
- Validate uniqueness before assignment
- Handle duplicate tag attempts with appropriate error

**Requirement SEC-003 (HIGH-005):** Remove hardcoded JWT secret.

**Implementation:**
- Load from environment variable only
- .env.example documents required variables
- Production secret generated and stored securely

**Requirement SEC-004 (HIGH-007):** Cash payment receipt verification.

**Implementation:**
- Generate unique receipt number
- Store cash payment record with reference
- Verify payment existence before ticket generation
- Prevent duplicate processing

**Requirement SEC-005 (HIGH-009):** Login should not reveal account existence.

**Implementation:**
- Always return generic error message
- Do not distinguish between "user not found" and "wrong password"
- Return same response time for existing and non-existing users (timing attack prevention)

**Requirement SEC-006 (HIGH-010):** N+1 query optimization for entry logs.

**Implementation:**
- Use MongoDB aggregation with $lookup
- Fetch related data in single query
- Add appropriate indexes

**Requirement SEC-007 (HIGH-011):** CSRF protection implementation.

**Implementation:**
- Add CSRF token to forms and API calls
- Validate token on state-changing requests
- Use SameSite cookie attribute

---

## 3. Non-Functional Requirements

### 3.1 Performance

- Token blocklist checks must complete in <10ms
- Payment validation must complete in <100ms
- Event authorization middleware must not add significant latency

### 3.2 Scalability

- Socket.IO room authorization must work with concurrent connections
- Token blocklist must support high-frequency logout under load

### 3.3 Reliability

- Payment idempotency must survive server restarts during processing
- Event authorization must fail closed (deny on error)
- Token blocklist must persist across application restarts

### 3.4 Observability

- Failed authorization attempts logged with user, resource, and reason
- Payment processing events logged with orderId and status
- All security-relevant events logged with sufficient context

---

## 4. Acceptance Criteria

### 4.1 Critical Issues (Must Pass)

1. **CRIT-001:** Organizer A cannot access Event B attendee data by manipulating attendeeId, ticketId, or QR token
2. **CRIT-002:** PayHere callbacks with tampered amounts are rejected (expectedAmount !== callbackAmount → 400 error)

### 4.2 High Issues (Must Pass)

3. **HIGH-001:** MainOrganiser can only access events explicitly assigned to them
4. **HIGH-002:** Logged-out tokens are immediately invalid (blocklist check fails)
5. **HIGH-003:** No duplicate ticket allocation from concurrent requests
6. **HIGH-004:** RFID tag uniqueness enforced at database level
7. **HIGH-005:** No hardcoded secrets in production code
8. **HIGH-006:** Socket.IO room join rejects unauthorized users
9. **HIGH-007:** Cash payments generate verifiable receipts
10. **HIGH-008:** Event settings persist after browser refresh
11. **HIGH-009:** Login API does not reveal account existence
12. **HIGH-010:** Entry logs load without N+1 queries
13. **HIGH-011:** CSRF tokens validated on state-changing endpoints
14. **HIGH-012:** Azure Blob Storage used for uploads in production

### 4.3 Test Coverage Requirements

- Unit tests for event authorization middleware
- Integration tests for payment webhook validation
- Unit tests for token blocklist
- Integration tests for QR lookup authorization
- E2E tests for event customization persistence

---

## 5. Out of Scope

The following are explicitly excluded from this requirements document:

1. **New Features:** Any functionality not mentioned in the audit findings
2. **Database Migration:** Schema changes beyond indexes for uniqueness and performance
3. **Frontend Redesign:** Visual or UX changes not required for security fixes
4. **Third-Party Service Changes:** Changes to PayHere, Azure, or other external services
5. **Mobile Application:** Native mobile apps are not in scope
6. **Performance Optimization:** Beyond N+1 query fixes and essential optimizations
7. **Accessibility:** WCAG compliance improvements are out of scope
8. **GDPR/Privacy Compliance:** Beyond what's required for security fixes
9. **New Payment Providers:** Integration with Stripe or other providers not currently in use
10. **Multi-Factor Authentication:** Implementation is not required

---

## 6. Assumptions and Notes

### 6.1 Technical Assumptions

1. Redis is available for token blocklist implementation
2. MongoDB transactions are available for race condition prevention
3. Azure Blob Storage SDK is accessible for upload fix
4. Existing test framework (Jest/Mocha) can be extended

### 6.2 Business Logic Assumptions

1. Main Admin role bypasses all event checks (by design)
2. Main Organizer role should only access assigned events
3. Sub-organizer access is defined by explicit assignments (event/zone/category)
4. Event ownership is determined by explicit assignment in database

### 6.3 Risk Acceptance Notes

- Token blocklist in database (if Redis unavailable) has performance implications
- Payment idempotency using order status may not handle partial failures gracefully
- Event authorization middleware adds a database query per request

---

## 7. Files to Modify

### 7.1 Backend Core Files

| File | Changes |
|------|---------|
| `backend/src/middleware/auth.js` | Add requireEventAccess, userHasEventAccess |
| `backend/src/routes/attendees.js` | QR lookup event scope, IDOR fixes |
| `backend/src/routes/entry.js` | Entry scan validation, event authorization |
| `backend/src/routes/rfid.js` | RFID authorization, uniqueness |
| `backend/src/routes/payment.js` | PayHere validation, idempotency |
| `backend/src/routes/auth.js` | Token blocklist, generic errors |
| `backend/src/server.js` | Socket.IO authorization |
| `backend/src/routes/upload.js` | Azure Blob Storage |
| `backend/src/models/*.js` | Indexes, constraints |

### 7.2 Configuration Files

| File | Changes |
|------|---------|
| `.env.example` | Document required variables, remove defaults |
| `package.json` | Add test dependencies if needed |

### 7.3 Frontend Files (Minimal Changes)

| File | Changes |
|------|---------|
| Event customization components | Connect to API for persistence |
| Login form | Remove error distinction |

---

## 8. Related Documents

- Audit Report: 2026-10-06
- API Documentation: [to be updated]
- Database Schema: [existing documentation]
- Deployment Guide: [existing documentation]

---

*Document Version: 1.0*
*Created: 2026-10-06*
*Next Phase: Design Document*