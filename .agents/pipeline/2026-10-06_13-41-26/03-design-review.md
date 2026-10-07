# Design Review: ENTRYNEX/EAMS V28 Security & Functionality Design

**Review Date:** 2026-10-06
**Reviewed By:** Design Review Subagent
**Document Version:** 1.0 (02-design.md)

---

## Executive Summary

**Verdict:** CHANGES_REQUESTED

The design document addresses many of the requirements from 01-requirements.md, but contains several issues that must be resolved before implementation. There are 4 HIGH-severity findings and 4 MEDIUM-severity findings that require attention.

---

## Findings

### 1. Missing Amount Validation in PayHere Webhook (HIGH)

**Location:** Section 2.3, Payment Security Implementation

**Problem:** The design states it adds "amount validation" to the PayHere webhook, but the code snippet only shows a comparison with tolerance. The requirements explicitly require **exact equality** without tolerance for payment validation.

**Requirement (PAY-001, PAY-004):**
- Expected amount must equal callback amount exactly
- Use integer cents for currency calculations
- No floating-point tolerance

**Design Claim:**
```javascript
// Use safe comparison with small tolerance for floating-point
const amountTolerance = 0.01;
if (Math.abs(expectedAmount - callbackAmount) > amountTolerance) {
```

**Issue:** The design uses a tolerance which violates the "exact equality" requirement and introduces risk of tampered amounts being accepted.

**Fix:** Replace tolerance-based comparison with exact equality using integer cents:

```javascript
// Convert to integer cents (smallest currency unit)
const expectedAmountCents = Math.round(order.totalAmount * 100);
const callbackAmountCents = Math.round(parseFloat(payhere_amount) * 100);

if (expectedAmountCents !== callbackAmountCents) {
  console.error('PAYHERE amount mismatch:', { 
    orderId, 
    expected: expectedAmountCents, 
    received: callbackAmountCents 
  });
  return res.status(400).send('Amount mismatch');
}
```

---

### 2. Missing Merchant ID Validation (HIGH)

**Location:** Section 2.3, Payment Security Implementation

**Problem:** The design mentions validating `merchant_id` against configured value but the code snippet doesn't show the actual validation logic, only the extraction.

**Design Claim:**
```javascript
// 1. Verify merchant_id matches configured value
if (merchant_id !== process.env.PAYHERE_MERCHANT_ID) {
  console.error('PAYHERE webhook: invalid merchant_id');
  return res.status(400).send('Invalid merchant ID');
}
```

**Issue:** The design claims this validation is present but the provided code snippet is incomplete. No verification exists in current codebase.

**Fix:** Ensure the following validation is explicitly implemented:

```javascript
const expectedMerchantId = process.env.PAYHERE_MERCHANT_ID;
if (!expectedMerchantId) {
  console.error('PAYHERE webhook: PAYHERE_MERCHANT_ID not configured');
  return res.status(500).send('Payment gateway misconfigured');
}

if (merchant_id !== expectedMerchantId) {
  console.error('PAYHERE webhook: merchant_id mismatch', { 
    expected: expectedMerchantId, 
    received: merchant_id 
  });
  return res.status(400).send('Invalid merchant ID');
}
```

---

### 3. Missing Idempotency Key in Design (HIGH)

**Location:** Section 2.3, Payment Security Implementation

**Problem:** The design describes idempotency using `order.paymentStatus === 'success'` check, but does not address partial failure scenarios. If the server crashes after processing payment but before completing ticket generation, duplicate processing could occur.

**Requirement (PAY-002):** Implement idempotency for payment processing.

**Design Claim:**
```javascript
// 6. Idempotency: Check if already processed
if (order.paymentStatus === 'success') {
  console.log('PAYHERE callback ignored - already processed:', orderId);
  return res.status(200).send('Already processed');
}
```

**Issue:** The check only looks at final status. A race condition exists if processing is interrupted. The design should use an atomic operation or transaction with a processing flag.

**Fix:** Add explicit processing state for idempotency:

```javascript
// Use atomic update with processing state for true idempotency
const result = await Order.findOneAndUpdate(
  { 
    _id: orderId,
    paymentStatus: { $ne: 'success' } // Only process if not already successful
  },
  { 
    $set: { 
      paymentStatus: 'success',
      status: 'CONFIRMED',
      paidAt: new Date(),
      gatewayUsed: 'payhere',
      'paymentDetails.transactionId': req.body.payment_id,
      'paymentDetails.method': req.body.method,
      'paymentDetails.rawResponse': req.body
    }
  },
  { new: true }
);

if (!result) {
  // Order either doesn't exist or was already processed
  console.log('PAYHERE callback ignored - already processed or not found:', orderId);
  return res.status(200).send('Already processed');
}
```

---

### 4. Token Blocklist Assumes Redis Availability (HIGH)

**Location:** Section 2.2, Token Blocklist Implementation

**Problem:** The design claims "Redis is available (referenced in services)" but grep_search found **no Redis usage in the codebase**. The design uses Redis as primary storage with MongoDB fallback, but Redis may not be configured.

**Design Claim:**
```javascript
// Primary: Redis
try {
  await RedisClient.setEx(`blocked:${decoded.jti}`, Math.floor((expiresAt - Date.now()) / 1000), 'true');
} catch (e) {
  console.warn('Redis unavailable, falling back to database');
}
```

**Verified Code:** grep_search for "redis" returned **no matches** in the codebase.

**Issue:** The design assumes Redis infrastructure exists but it does not.

**Fix:** Reverse the strategy - use MongoDB as primary and only attempt Redis if configured:

```javascript
// Primary: MongoDB (always available)
const expiresAt = new Date(decoded.exp * 1000);
await TokenBlocklist.create({ jti: decoded.jti, userId, expiresAt, reason });

// Optional: Redis cache if configured
if (process.env.REDIS_URL) {
  const RedisClient = require('../config/redis');
  await RedisClient.setEx(`blocked:${decoded.jti}`, Math.floor((expiresAt - Date.now()) / 1000), 'true');
}
```

Alternatively, document that Redis must be deployed as a prerequisite.

---

### 5. hasEventAccess in attendees.js Misses mainOrganisers Array (MEDIUM)

**Location:** Section 2.5, Main Organizer Isolation / Verified Code in attendees.js

**Problem:** The `hasEventAccess` function in `backend/src/routes/attendees.js` does NOT check the `mainOrganisers` array, but the design's `userHasEventAccess` does.

**Verified attendees.js Code:**
```javascript
const hasEventAccess = async (user, eventId) => {
  if (!eventId) return false;
  if (user.role === 'main_admin') return true;
  if (user.assignedEvents?.some((assigned) => assigned.toString() === eventId.toString())) return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser');
  return !!event && (
    event.createdBy?.toString() === user._id.toString() ||
    event.mainOrganiser?.toString() === user._id.toString()
  );
};
```

**Design's userHasEventAccess:**
```javascript
const isAssigned = 
  event.createdBy?.toString() === user._id.toString() ||
  event.mainOrganiser?.toString() === user._id.toString() ||
  event.mainOrganisers?.some(id => id.toString() === user._id.toString()) ||
  (user.assignedEvents || []).some(e => e.toString() === eventId.toString());
```

**Issue:** The design correctly includes `mainOrganisers` but the existing code in `attendees.js` does not. This is a gap that should be documented.

**Fix:** Update `backend/src/routes/attendees.js` `hasEventAccess` function:

```javascript
const hasEventAccess = async (user, eventId) => {
  if (!eventId) return false;
  if (user.role === 'main_admin') return true;
  if (user.assignedEvents?.some((assigned) => assigned.toString() === eventId.toString())) return true;
  const event = await Event.findById(eventId).select('createdBy mainOrganiser mainOrganisers');
  return !!event && (
    event.createdBy?.toString() === user._id.toString() ||
    event.mainOrganiser?.toString() === user._id.toString() ||
    event.mainOrganisers?.some(id => id.toString() === user._id.toString())
  );
};
```

---

### 6. Login Already Uses Generic Error Messages (MEDIUM)

**Location:** Section 2.11, Login Security

**Problem:** The design proposes adding generic error messages for login, but verification shows this is **already implemented**.

**Verified auth.js Code:**
```javascript
if (!user) {
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}
// ...
if (!isMatch) {
  // ...
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}
```

**Design Claim:**
```javascript
// Replace specific error messages with generic
if (!user) {
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}
```

**Issue:** The design describes this as a change needed, but it's already done. This is redundant.

**Fix:** Remove Section 2.11 from the design or mark as "Already Implemented - No action required".

---

### 7. QR Token Lookup Endpoint Does Not Exist (MEDIUM)

**Location:** Section 2.4, QR Token Lookup Security

**Problem:** The design references `GET /attendees/by-qr/:qrToken` endpoint, but verification of `backend/src/routes/attendees.js` shows this endpoint **does not exist**.

**Design Claim:**
```javascript
// GET /attendees/by-qr/:qrToken
router.get('/by-qr/:qrToken', protect, async (req, res, next) => {
```

**Verified Code:** grep_search for "by-qr" returned no matches in the codebase.

**Issue:** The design assumes an endpoint exists that needs fixing, but it may need to be created first.

**Fix:** Clarify whether this endpoint should be created or if the design refers to another endpoint:
- If creating new: Include full implementation
- If referencing existing: Identify correct endpoint name/path

---

### 8. Socket.IO Lacks Authentication Middleware (MEDIUM)

**Location:** Section 2.6, Socket.IO Room Authorization

**Problem:** The design proposes adding JWT authentication to Socket.IO, but verification of `backend/src/server.js` shows **no authentication** on Socket.IO connections at all.

**Verified server.js Code:**
```javascript
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("join_event", ({ eventId } = {}) => {
    if (eventId) {
      socket.join(`event:${eventId}`);
      // NO AUTHORIZATION CHECK
    }
  });
```

**Design Claim:**
```javascript
// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await require('../models/User').findById(decoded.id).select('-password');
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});
```

**Issue:** The design proposes adding auth middleware, but this is a more significant change than "enhancement" - it completely changes the Socket.IO security model from unauthenticated to authenticated.

**Fix:** Acknowledge that this is a breaking change and requires:
1. Frontend to pass JWT token in Socket.IO connection
2. All existing Socket.IO clients to be updated
3. Graceful degradation or migration strategy

---

### 9. Existing Event Access Functions Are Inconsistent (NIT)

**Location:** Throughout codebase - multiple files define similar functions

**Problem:** Three different files define three versions of event access functions:
- `attendees.js`: `hasEventAccess` (misses `mainOrganisers`)
- `entry.js`: `userHasEventAccess` (different logic)
- `rfid.js`: `userHasEventAccess` and `canManageEvent`

**Design Claim:** Create centralized `userHasEventAccess` service

**Issue:** The design correctly identifies this problem but should explicitly mandate replacing all three local functions.

**Fix:** In Section 2.1, explicitly list the files/functions to be replaced:
- `backend/src/routes/attendees.js`: `hasEventAccess`
- `backend/src/routes/entry.js`: `userHasEventAccess`
- `backend/src/routes/rfid.js`: `userHasEventAccess`, `canManageEvent`

---

### 10. Missing Redis Configuration Documentation (NIT)

**Location:** Section 8.1, Confirmed Assumptions

**Problem:** The design assumes Redis is available but doesn't document configuration requirements.

**Design Claim:**
- Redis is available for token blocklist

**Fix:** Add configuration documentation:

```markdown
### Redis Configuration Required

If using Redis for token blocklist:

```env
REDIS_URL=redis://localhost:6379
# or
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```
```

---

### 11. Cash Payment Receipt Verification Incomplete (NIT)

**Location:** Section 2.8, Cash Payment Receipt Verification

**Problem:** The design mentions cash payment endpoints but doesn't verify they exist or work correctly.

**Design Claim:**
```javascript
router.get('/cash/verify/:receiptNumber', async (req, res) => {
```

**Verification:** Cash entrance controller exists but receipt verification endpoint needs verification.

**Fix:** Add verification step to confirm the endpoint exists and functions correctly, or implement if missing.

---

### 12. Event Customization Persistence Frontend Not Addressed (NIT)

**Location:** Section 2.7, Event Customization Persistence

**Problem:** The design addresses backend API requirements but doesn't specify which frontend components need changes to call the APIs.

**Design Claim:** "This is primarily a frontend issue"

**Fix:** Add specific frontend components that need migration from local state to API persistence:
- Main Entry Gates component
- Team Members component
- Zones component
- Categories component
- Event Settings component
- RFID Settings component
- Payment Methods component

---

## Verified Assumptions

1. **Login error messages are already generic** - `backend/src/routes/auth.js` already returns "Invalid credentials" for both user-not-found and wrong-password cases.

2. **hasEventAccess functions exist** - Multiple routes already have local implementations of event access checks in `attendees.js`, `entry.js`, and `rfid.js`.

3. **PayHere webhook exists** - `backend/src/routes/payment.js` has the `/notify` endpoint for PayHere callbacks.

4. **Socket.IO is in use** - `backend/src/server.js` initializes Socket.IO with room join functionality.

5. **User model exists** - `backend/src/models/User.js` exists for user data.

---

## Unverified/Wrong Assumptions

1. **Redis is available** - grep_search found no Redis usage. The design must either add Redis infrastructure or use MongoDB-only approach.

2. **GET /attendees/by-qr/:qrToken exists** - This endpoint does not appear in the codebase. May need creation.

3. **RequireEventAccess middleware exists** - grep_search found no middleware by this name. The design may be referring to local `hasEventAccess` functions.

4. **TokenBlocklist model exists** - grep_search found no TokenBlocklist model. Must be created.

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH | 4 |
| MEDIUM | 4 |
| NIT | 4 |

**Verdict:** CHANGES_REQUESTED

The design document must address the HIGH findings before implementation:
1. Replace tolerance-based amount comparison with exact integer comparison
2. Complete merchant ID validation implementation
3. Add proper idempotency with atomic operations
4. Either deploy Redis or redesign token blocklist for MongoDB-only

The MEDIUM findings should be addressed in a follow-up revision, and NIT findings can be addressed during implementation.