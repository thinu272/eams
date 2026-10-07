# ENTRYNEX/EAMS V28 Technical Design Document

**Version:** 1.0
**Date:** 2026-10-06
**Status:** Ready for Implementation
**Based on Requirements:** 01-requirements.md

---

## 1. Overview

This document provides the technical design for implementing security fixes and functionality improvements identified in the ENTRYNEX/EAMS V28 audit. The design addresses critical and high-priority issues including event isolation, payment security, QR token validation, token invalidation, Socket.IO authorization, and event customization persistence.

The implementation extends the existing middleware architecture and follows established patterns in the codebase. All changes are backward-compatible and introduce no breaking changes to existing API contracts unless explicitly required by security requirements.

---

## 2. Architecture Decisions

### 2.1 Event Authorization Framework

**Decision:** Create a centralized `userHasEventAccess(user, eventId, permission)` function that serves as the single source of truth for event authorization.

**Rationale:** The current `requireEventAccess` middleware has scattered authorization logic and allows MAIN_ORGANISER to bypass event checks entirely. A dedicated authorization service will consolidate this logic and ensure consistent enforcement.

**Approach:**

1. Create `backend/src/services/eventAuthorizationService.js` with the following function signature:
   ```javascript
   async function userHasEventAccess(user, eventId, permission = 'view')
   ```

2. Permission levels:
   - `'view'` - Read access to event resources
   - `'manage'` - Full management access (settings, customization)
   - `'operate'` - Operational access (entry, RFID, staff functions)
   - `'report'` - Read-only report access
   - `'socket_join'` - Socket.IO room join permission

3. Role-based access matrix:

| Role | bypass | view | manage | operate | report |
|------|--------|------|--------|---------|--------|
| MAIN_ADMIN | Yes | All | All | All | All |
| MAIN_ORGANISER | No | Assigned only | Assigned only | Assigned only | Assigned only |
| SUB_ORGANISER | No | Assigned scope | Assigned scope | Assigned scope | Assigned scope |
| STAFF | No | Assigned event | No | Assigned event | No |
| VOLUNTEER | No | Assigned event | No | Limited | No |
| AUDITOR | No | Assigned event (read-only) | No | No | Assigned event |
| SPONSOR | No | Event (sponsor scope) | No | No | No |
| ATTENDEE/BUYER | No | Own data only | No | No | No |

**Implementation Details:**

The `userHasEventAccess` function will perform the following steps:

1. If `user.role === 'main_admin'`, return `true` immediately (MainAdmin bypass)
2. If no `eventId` is provided, return `false` (no implicit access)
3. Validate `eventId` is a valid MongoDB ObjectId
4. Fetch the event document with relevant fields: `createdBy`, `mainOrganiser`, `mainOrganisers`, `subOrganisers`, `staff`, `volunteers`, `auditors`, `sponsors`
5. Check authorization based on role and permission level
6. For MAIN_ORGANISER: verify explicit assignment via:
   - `event.createdBy === user._id`
   - `event.mainOrganiser === user._id`
   - `event.mainOrganisers.includes(user._id)`
   - `user.assignedEvents.includes(event._id)`

### 2.2 Token Blocklist Implementation

**Decision:** Implement database-backed token invalidation with Redis as primary store and MongoDB fallback.

**Rationale:** The codebase has Redis available (referenced in services), but to ensure reliability if Redis is unavailable, we implement a dual-strategy approach.

**Implementation:**

1. Create `backend/src/models/TokenBlocklist.js`:
   ```javascript
   const mongoose = require('mongoose');
   const tokenBlocklistSchema = new mongoose.Schema({
     jti: { type: String, required: true, unique: true },
     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
     expiresAt: { type: Date, required: true },
     blockedAt: { type: Date, default: Date.now },
     reason: { type: String, default: 'logout' }
   });
   tokenBlocklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
   module.exports = mongoose.model('TokenBlocklist', tokenBlocklistSchema);
   ```

2. Create `backend/src/services/tokenBlocklistService.js`:
   ```javascript
   const TokenBlocklist = require('../models/TokenBlocklist');
   const RedisClient = require('../config/redis'); // existing or new
   
   async function addToBlocklist(token, userId, reason = 'logout') {
     const decoded = jwt.decode(token);
     if (!decoded?.jti) return null;
     
     const expiresAt = new Date(decoded.exp * 1000);
     
     // Primary: Redis
     try {
       await RedisClient.setEx(`blocked:${decoded.jti}`, Math.floor((expiresAt - Date.now()) / 1000), 'true');
     } catch (e) {
       console.warn('Redis unavailable, falling back to database');
     }
     
     // Fallback: MongoDB
     await TokenBlocklist.create({ jti: decoded.jti, userId, expiresAt, reason });
     
     return decoded.jti;
   }
   
   async function isBlocked(token) {
     const decoded = jwt.decode(token);
     if (!decoded?.jti) return false;
     
     // Check Redis first
     try {
       const blocked = await RedisClient.get(`blocked:${decoded.jti}`);
       if (blocked === 'true') return true;
     } catch (e) {
       // Continue to database check
     }
     
     // Check MongoDB
     const exists = await TokenBlocklist.findOne({ jti: decoded.jti });
     return !!exists;
   }
   ```

3. Modify `backend/src/middleware/auth.js` `protect` middleware to check blocklist:
   ```javascript
   const { isBlocked } = require('../services/tokenBlocklistService');
   
   const protect = async (req, res, next) => {
     try {
       let token;
       if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
         token = req.headers.authorization.split(' ')[1];
       }
       if (!token) {
         return res.status(401).json({ success: false, message: 'Not authorised. No token.' });
       }
       
       // Check token blocklist
       if (await isBlocked(token)) {
         return res.status(401).json({ success: false, message: 'Token has been revoked.' });
       }
       
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       // ... existing code
     } catch (error) {
       return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
     }
   };
   ```

4. Modify `POST /api/auth/logout` to block the token:
   ```javascript
   router.post('/logout', protect, async (req, res) => {
     const token = req.headers.authorization?.split(' ')[1];
     await addToBlocklist(token, req.user._id, 'logout');
     res.json({ success: true, message: 'Logged out successfully' });
   });
   ```

### 2.3 Payment Security Implementation

**Decision:** Implement comprehensive PayHere webhook validation with amount verification and idempotency.

**Critical Changes to `backend/src/routes/payment.js`:**

1. Add amount validation in PayHere `/notify` endpoint:
   ```javascript
   router.post('/notify', async (req, res) => {
     try {
       const {
         merchant_id,
         order_id,
         payhere_amount,
         payhere_currency,
         status_code,
         md5sig,
         custom_1: orderId, // orderId from custom_1
         custom_2: eventId  // eventId from custom_2
       } = req.body;
       
       // 1. Verify merchant_id matches configured value
       if (merchant_id !== process.env.PAYHERE_MERCHANT_ID) {
         console.error('PAYHERE webhook: invalid merchant_id');
         return res.status(400).send('Invalid merchant ID');
       }
       
       // 2. Signature verification (existing code)
       // ... existing signature verification ...
       
       // 3. Order existence check
       const order = await Order.findById(orderId);
       if (!order) {
         console.error('ORDER NOT FOUND FOR PAYMENT:', orderId);
         return res.status(404).send('Order not found');
       }
       
       // 4. CRITICAL: Amount validation - expected vs callback
       const expectedAmount = order.totalAmount; // From database (authoritative)
       const callbackAmount = parseFloat(payhere_amount);
       
       // Use safe comparison with small tolerance for floating-point
       const amountTolerance = 0.01;
       if (Math.abs(expectedAmount - callbackAmount) > amountTolerance) {
         console.error('PAYHERE amount mismatch:', { 
           orderId, 
           expected: expectedAmount, 
           received: callbackAmount 
         });
         return res.status(400).send('Amount mismatch');
       }
       
       // 5. Currency validation
       const event = await Event.findById(eventId);
       const expectedCurrency = event?.settings?.currency || 'LKR';
       if (payhere_currency !== expectedCurrency) {
         console.error('PAYHERE currency mismatch:', { 
           orderId, 
           expected: expectedCurrency, 
           received: payhere_currency 
         });
         return res.status(400).send('Currency mismatch');
       }
       
       // 6. Idempotency: Check if already processed
       if (order.paymentStatus === 'success') {
         console.log('PAYHERE callback ignored - already processed:', orderId);
         return res.status(200).send('Already processed');
       }
       
       // 7. Order status check
       if (order.status === 'CONFIRMED') {
         console.log('PAYHERE callback ignored - order already confirmed:', orderId);
         return res.status(200).send('Already confirmed');
       }
       
       // Continue with payment processing...
     } catch (error) {
       console.error('PAYMENT NOTIFY ERROR:', error);
       res.status(500).send('Internal Server Error');
     }
   });
   ```

2. **Stripe Webhook Enhancement:**
   - Add amount validation similar to PayHere
   - Add idempotency check using `order.paymentStatus`

### 2.4 QR Token Lookup Security

**Decision:** Implement event-scoped QR token validation for all QR-based endpoints.

**Affected Endpoints:**

1. `GET /attendees/by-qr/:qrToken` in `backend/src/routes/attendees.js`
2. `GET /entry/attendee/:qrToken` in `backend/src/routes/entry.js`
3. `POST /entry/scan` in `backend/src/routes/entry.js`

**Implementation Pattern:**

```javascript
// GET /attendees/by-qr/:qrToken
router.get('/by-qr/:qrToken', protect, async (req, res, next) => {
  try {
    const { qrToken } = req.params;
    const requestedEventId = req.query.eventId; // Optional client-provided eventId
    
    // 1. Fetch attendee by QR token
    const attendee = await Attendee.findOne({ qrToken }).populate('event');
    if (!attendee) {
      return res.status(404).json({ success: false, message: 'Attendee not found.' });
    }
    
    // 2. Resolve eventId from resource (authoritative)
    const resourceEventId = attendee.event?._id?.toString();
    if (!resourceEventId) {
      return res.status(400).json({ success: false, message: 'Invalid attendee event.' });
    }
    
    // 3. If client provided eventId, validate it matches the resource's event
    if (requestedEventId && requestedEventId !== resourceEventId) {
      console.error('QR lookup eventId mismatch:', { 
        provided: requestedEventId, 
        actual: resourceEventId,
        attendeeId: attendee._id 
      });
      return res.status(400).json({ success: false, message: 'Event ID mismatch.' });
    }
    
    // 4. Verify user has access to the event
    const hasAccess = await userHasEventAccess(req.user, resourceEventId, 'view');
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied to this event.' });
    }
    
    // 5. Return only authorized fields (filter sensitive data)
    const safeAttendeeData = {
      _id: attendee._id,
      fullName: attendee.fullName,
      email: attendee.email,
      phone: attendee.phone,
      categoryName: attendee.categoryName,
      qrToken: attendee.qrToken,
      checkedIn: attendee.checkedIn,
      checkedInAt: attendee.checkedInAt,
      event: {
        _id: attendee.event._id,
        name: attendee.event.name
      }
    };
    
    res.json({ success: true, data: { attendee: safeAttendeeData } });
  } catch (err) { next(err); }
});
```

### 2.5 Main Organizer Isolation

**Decision:** Remove unconditional MAIN_ORGANISER bypass in `requireEventAccess` middleware.

**Changes to `backend/src/middleware/auth.js`:**

```javascript
const requireEventAccess = async (req, res, next) => {
  try {
    const { user } = req;
    const rawId = req.params.eventId || req.body.eventId || req.query.eventId;
    const requestedEventProvided = rawId !== undefined && rawId !== null && rawId !== '' && rawId !== 'undefined';
    let eventId = requestedEventProvided ? rawId : null;
    
    const canonicalRole = normalizeRole(user.role);
    
    // MAIN_ADMIN bypasses all event checks
    if (canonicalRole === ROLES.MAIN_ADMIN) {
      if (eventId) req.resolvedEventId = eventId;
      return next();
    }
    
    // MAIN_ORGANISER must verify explicit event assignment (NO unconditional bypass)
    if (canonicalRole === ROLES.MAIN_ORGANISER) {
      if (!eventId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Event ID required for this operation.' 
        });
      }
      
      // Verify MainOrganiser has explicit assignment
      const Event = require('../models/Event');
      const event = await Event.findById(eventId).select('createdBy mainOrganiser mainOrganisers');
      
      const isAssigned = 
        event.createdBy?.toString() === user._id.toString() ||
        event.mainOrganiser?.toString() === user._id.toString() ||
        event.mainOrganisers?.some(id => id.toString() === user._id.toString()) ||
        (user.assignedEvents || []).some(e => e.toString() === eventId.toString());
      
      if (!isAssigned) {
        return res.status(403).json({ 
          success: false, 
          message: 'You do not have access to this event.' 
        });
      }
      
      req.resolvedEventId = eventId;
      return next();
    }
    
    // ... rest of existing logic for other roles
  } catch (error) {
    next(error);
  }
};
```

### 2.6 Socket.IO Room Authorization

**Decision:** Add authorization middleware for all event-scoped Socket.IO room joins.

**Changes to `backend/src/server.js`:**

```javascript
const { userHasEventAccess } = require('./services/eventAuthorizationService');
const jwt = require('jsonwebtoken');

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await require('../models/User').findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id, socket.user?.email);
  
  // Protected room joins
  socket.on("join_event", async ({ eventId } = {}) => {
    if (!eventId) {
      return socket.emit('error', { message: 'eventId required' });
    }
    
    try {
      const hasAccess = await userHasEventAccess(socket.user, eventId, 'socket_join');
      if (!hasAccess) {
        return socket.emit('error', { message: 'Access denied to this event room' });
      }
      
      socket.join(`event:${eventId}`);
      console.log(`Socket ${socket.id} (${socket.user.email}) joined event room: event:${eventId}`);
    } catch (error) {
      console.error('join_event error:', error);
      socket.emit('error', { message: 'Authorization check failed' });
    }
  });
  
  socket.on("join_dashboard", async ({ eventId } = {}) => {
    if (!eventId) {
      return socket.emit('error', { message: 'eventId required' });
    }
    
    try {
      const hasAccess = await userHasEventAccess(socket.user, eventId, 'operate');
      if (!hasAccess) {
        return socket.emit('error', { message: 'Access denied to this dashboard' });
      }
      
      socket.join(`dashboard:${eventId}`);
      console.log(`Socket ${socket.id} (${socket.user.email}) joined dashboard: dashboard:${eventId}`);
    } catch (error) {
      console.error('join_dashboard error:', error);
      socket.emit('error', { message: 'Authorization check failed' });
    }
  });
  
  // Existing unprotected rooms (keep for buyer/listing rooms)
  socket.on("join_listings", () => {
    socket.join('listings');
  });
  
  socket.on("join_buyer", ({ userId } = {}) => {
    // Only allow users to join their own buyer room
    if (socket.user._id.toString() === userId) {
      socket.join(`buyer:${userId}`);
    }
  });
  
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
```

### 2.7 Event Customization Persistence

**Decision:** Ensure all event settings trigger API calls to persist to MongoDB.

**Approach:** This is primarily a frontend issue, but we need to ensure the backend APIs properly validate and persist all settings.

**Backend API Consistency:**

1. Ensure `PUT /api/events/:eventId` handles all setting fields
2. Add validation for specific setting fields
3. Return the saved state from all update endpoints

**Frontend Changes Required (not implemented in this design, but APIs must support):**

For each settings endpoint:
- `PUT /api/events/:eventId/settings` - Update settings object
- Validate input schema
- Persist to MongoDB
- Return saved document

### 2.8 Cash Payment Receipt Verification

**Decision:** Generate unique receipt numbers for cash payments and store verification records.

**Implementation:**

1. Add receipt number generation to cash reservation:
   ```javascript
   // In cashEntranceController.js
   const generateReceiptNumber = () => {
     const timestamp = Date.now().toString(36).toUpperCase();
     const random = Math.random().toString(36).substring(2, 6).toUpperCase();
     return `RCPT-${timestamp}-${random}`;
   };
   ```

2. Store receipt with order:
   ```javascript
   // On confirmCashPayment
   order.paymentDetails = {
     gateway: 'cash',
     receiptNumber: generateReceiptNumber(),
     confirmedBy: operatorId,
     confirmedAt: new Date(),
     cashAmount: amountReceived,
     changeGiven: changeAmount
   };
   await order.save();
   ```

3. Add verification endpoint:
   ```javascript
   router.get('/cash/verify/:receiptNumber', async (req, res) => {
     const order = await Order.findOne({ 
       'paymentDetails.receiptNumber': req.params.receiptNumber 
     });
     if (!order) {
       return res.status(404).json({ valid: false, message: 'Receipt not found' });
     }
     res.json({
       valid: true,
       orderId: order._id,
       orderNumber: order.orderNumber,
       amount: order.totalAmount,
       status: order.paymentStatus,
       confirmedAt: order.paymentDetails.confirmedAt
     });
   });
   ```

### 2.9 Race Condition Prevention for Ticket Purchases

**Decision:** Use MongoDB optimistic concurrency with version field and atomic category updates.

**Implementation:**

1. Add `__v` version field to Event schema (Mongoose provides this by default)
2. Use `$inc` for atomic updates:
   ```javascript
   // In order creation, use findOneAndUpdate with condition
   const event = await Event.findOneAndUpdate(
     {
       _id: eventId,
       'categories.id': categoryId,
       'categories.sold': { $lte: category.capacity - quantity }
     },
     {
       $inc: { 
         'categories.$.sold': quantity,
         revenue: totalAmount 
       }
     },
     { new: true }
   );
   
   if (!event) {
     return res.status(400).json({ 
       success: false, 
       message: 'Tickets no longer available. Please try again.' 
     });
   }
   ```

### 2.10 RFID Tag Unique Constraint

**Decision:** Add unique index on RFID tag values.

**Implementation:**

1. Create migration for existing RfidTag collection:
   ```javascript
   // In RfidTag model or migration script
   RfidTag.schema.index({ rfidTag: 1 }, { unique: true });
   ```

2. Validate before insertion:
   ```javascript
   // In insertInventoryTags function
   const existing = await RfidTag.find({ rfidTag: { $in: unique } }).select('rfidTag').lean();
   const existingSet = new Set(existing.map(t => t.rfidTag));
   const newUnique = unique.filter(tag => !existingSet.has(tag));
   ```

### 2.11 Login Security - Generic Error Messages

**Decision:** Return consistent error messages regardless of whether account exists.

**Implementation in `POST /api/auth/login`:**

```javascript
// Replace specific error messages with generic
if (!user) {
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}

const isMatch = await user.comparePassword(password);
if (!isMatch) {
  // Increment failed attempts...
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
}

// All authentication failures return the same message
// Timing attack mitigation: continue to compare password hash even for non-existent user
// (already handled by bcrypt which compares hashes)
```

### 2.12 N+1 Query Optimization for Entry Logs

**Decision:** Use MongoDB aggregation with `$lookup` to fetch related data in single query.

**Implementation in `backend/src/routes/entry.js`:**

```javascript
router.get('/logs', protect, async (req, res, next) => {
  try {
    const { eventId, page = 1, limit = 50 } = req.query;
    
    if (!await userHasEventAccess(req.user, eventId, 'view')) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    const logs = await EntryLog.aggregate([
      { $match: { event: mongoose.Types.ObjectId(eventId) } },
      {
        $lookup: {
          from: 'attendees',
          localField: 'attendee',
          foreignField: '_id',
          as: 'attendeeData',
        },
      },
      { $unwind: { path: '$attendeeData', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'checkedInBy',
          foreignField: '_id',
          as: 'staffData',
        },
      },
      { $unwind: { path: '$staffData', preserveNullAndEmptyArrays: true } },
      { $sort: { timestamp: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    ]);
    
    const total = await EntryLog.countDocuments({ event: eventId });
    
    res.json({ success: true, data: { logs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } } });
  } catch (err) { next(err); }
});
```

---

## 3. File Changes Summary

### 3.1 New Files to Create

| File | Purpose |
|------|---------|
| `backend/src/services/eventAuthorizationService.js` | Centralized event authorization logic |
| `backend/src/models/TokenBlocklist.js` | Database-backed token blocklist model |
| `backend/src/services/tokenBlocklistService.js` | Token blocklist service with Redis/MongoDB fallback |
| `backend/tests/unit/eventAuthorization.test.js` | Unit tests for authorization service |
| `backend/tests/integration/paymentWebhook.test.js` | Integration tests for payment validation |
| `backend/tests/integration/qrLookup.test.js` | Integration tests for QR endpoints |

### 3.2 Files to Modify

| File | Changes |
|------|---------|
| `backend/src/middleware/auth.js` | Fix requireEventAccess for MainOrganiser, add blocklist check |
| `backend/src/routes/payment.js` | Add amount validation, idempotency to PayHere webhook |
| `backend/src/routes/attendees.js` | Add event scope to QR lookup endpoint |
| `backend/src/routes/entry.js` | Add event authorization, optimize queries |
| `backend/src/routes/auth.js` | Add token blocklist on logout |
| `backend/src/server.js` | Add Socket.IO authorization middleware |
| `backend/src/routes/rfid.js` | Add event authorization checks (already has some) |
| `backend/src/routes/orders.js` | Add race condition prevention |

### 3.3 Configuration Changes

| File | Changes |
|------|---------|
| `.env.example` | Document PAYHERE_MERCHANT_ID, add JWT_EXPIRY if needed |
| `backend/.env` | Add PAYHERE_MERCHANT_ID, ensure JWT_SECRET is strong |

---

## 4. Error Handling

### 4.1 Event Authorization Errors

| Condition | HTTP Status | Response | Log Level |
|-----------|-------------|----------|-----------|
| Missing eventId | 400 | `Event ID required for this operation.` | Info |
| Invalid eventId format | 400 | `Invalid event ID format.` | Info |
| MainOrganiser not assigned | 403 | `You do not have access to this event.` | Warn |
| Other role no access | 403 | `Access denied to this event.` | Warn |
| Event not found | 404 | `Event not found.` | Warn |
| Database error | 500 | `Internal server error.` | Error |

### 4.2 Payment Validation Errors

| Condition | HTTP Status | Response | Log Level |
|-----------|-------------|----------|-----------|
| Invalid merchant_id | 400 | `Invalid merchant ID` | Error |
| Signature mismatch | 400 | `Invalid signature` | Error |
| Order not found | 404 | `Order not found` | Error |
| Amount mismatch | 400 | `Amount mismatch` | Error |
| Currency mismatch | 400 | `Currency mismatch` | Error |
| Already processed | 200 | `Already processed` | Info |
| Success | 200 | `OK` | Info |

### 4.3 Token Blocklist Errors

| Condition | HTTP Status | Response |
|-----------|-------------|----------|
| Token blocked | 401 | `Token has been revoked.` |
| Missing token | 401 | `Not authorised. No token.` |
| Invalid token | 401 | `Invalid or expired token.` |

### 4.4 Socket.IO Authorization Errors

| Condition | Response | Behavior |
|-----------|----------|----------|
| No token | Error: `Authentication required` | Disconnect |
| Invalid token | Error: `Invalid token` | Disconnect |
| No eventId | Error: `eventId required` | Emit error event |
| Access denied | Error: `Access denied to this event room` | Emit error event |
| Success | No response | Join room |

---

## 5. Validation Rules

### 5.1 External Input Validation

| Input | Required | Type | Limits | Failure Behavior |
|-------|----------|------|--------|------------------|
| eventId | Context-dependent | MongoDB ObjectId | 24 hex chars | 400 error |
| qrToken | For QR endpoints | UUID v4 | 36 chars | 404 if not found |
| orderId | For payments | MongoDB ObjectId | 24 hex chars | 404 if not found |
| payhere_amount | For PayHere | Decimal | Max 9999999.99 | 400 error |
| rfidTag | For RFID | String | 10 digits | 400 error |

### 5.2 Invariant Enforcement

| Invariant | Owner | Reason |
|-----------|-------|--------|
| User role hierarchy | RBAC middleware | Prevents privilege escalation |
| Event assignment verification | Authorization service | Ensures event isolation |
| Payment amount validation | Payment routes | Prevents tampering |
| Token blocklist check | Auth middleware | Enforces logout |
| Socket.IO room access | Socket middleware | Real-time security |
| Unique RFID tags | Database + service | Prevents duplicates |

---

## 6. Testability

### 6.1 Unit Test Coverage

| Component | Test Cases |
|-----------|------------|
| `userHasEventAccess` | MainAdmin bypass, MainOrganiser assigned, MainOrganiser not assigned, SubOrganiser scope, Staff assignment, No access scenarios |
| `tokenBlocklistService` | Add to blocklist, Check blocked, Check unblocked, Redis fallback |
| `requireEventAccess` | All role scenarios, Missing eventId, Invalid eventId |
| `generateReceiptNumber` | Format verification, Uniqueness |

### 6.2 Integration Test Coverage

| Endpoint | Test Cases |
|----------|------------|
| PayHere webhook | Valid callback, Amount mismatch, Duplicate callback, Invalid signature |
| QR lookup | Authorized access, Cross-event access denied, Missing eventId |
| Logout | Token immediately invalid, Other sessions unaffected |
| Socket.IO join_event | Authorized join, Unauthorized join |

### 6.3 E2E Test Coverage (Recommended)

| Flow | Verification |
|------|--------------|
| Organizer A -> Event A | Success |
| Organizer A -> Event B (not assigned) | 403 Forbidden |
| Main Admin -> Any Event | Success |
| PayHere callback with tampered amount | 400 error |
| Logout then API call with same token | 401 Unauthorized |
| QR scan for attendee in Event A by Organizer B | 403 Forbidden |

---

## 7. Rollout Strategy

### 7.1 Deployment Order

1. Deploy new services (`eventAuthorizationService`, `tokenBlocklistService`)
2. Deploy middleware changes (`auth.js` blocklist check)
3. Deploy payment validation
4. Deploy Socket.IO authorization
5. Deploy configuration changes

### 7.2 Backward Compatibility

- All changes maintain existing API contracts
- New token blocklist is additive (existing tokens remain valid until expiry)
- Event authorization defaults to permissive for MainOrganiser until fully deployed

### 7.3 Rollback Plan

- Feature flags can disable new authorization checks if issues arise
- Token blocklist can be cleared via admin command if needed
- Previous middleware version retained for quick rollback

---

## 8. Assumptions and Open Questions

### 8.1 Confirmed Assumptions

- Redis is available and configured for token blocklist caching
- MongoDB transactions are available for race condition prevention
- PayHere merchant ID is available in environment variables
- Existing test infrastructure (Jest/Mocha) can be extended

### 8.2 Open Questions

1. **Q:** Should the token blocklist be session-based (invalidate all sessions) or token-based (only invalidate the logged-out token)?
   
   **A:** Token-based (current design). User logout from one device does NOT invalidate tokens on other devices.

2. **Q:** Should we implement CSRF protection for API endpoints?
   
   **A:** Not in this phase. The requirements document marks CSRF (HIGH-011) but the focus is on critical/high issues. CSRF can be addressed separately.

3. **Q:** Should Main Organizer be able to access all events they are explicitly assigned to, or only events they created?
   
   **A:** Both. Main Organizer access includes: events they created, events where they are mainOrganiser, events in their assignedEvents array.

---

## 9. Design Responses to Review Findings

*This section applies only when a design review exists. No review was found, so this section is not applicable.*

---

*Document Version: 1.0*
*Created: 2026-10-06*
*Next Phase: Implementation*