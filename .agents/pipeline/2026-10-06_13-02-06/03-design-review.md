# Design Review: Team Member Capabilities & Event-Scoped Data Access

**Design Version:** 1.0
**Date:** 2026-10-06
**Reviewer:** Kiro Design Review Subagent
**Status:** CHANGES_REQUESTED

---

## Executive Summary

The design document addresses gate state management, team member capabilities, and Sub-Organiser data filtering. However, **the design does not address the critical security requirements** specified in the requirements document (CRIT-001, CRIT-002, HIGH-001 through HIGH-012). This is a fundamental scope gap that must be resolved.

**Verdict:** CHANGES_REQUESTED

---

## Findings

### HIGH Findings

**1. CRITICAL: Design Scope Does Not Address Requirements Document**

*Location:* Entire design document (02-design.md)

*Problem:* The requirements document (01-requirements.md) specifies 14 critical/high priority security fixes that must be implemented. This design ONLY addresses:
- Gate state management (NOT listed in requirements)
- Team member capabilities (NOT listed in requirements)  
- Sub-Organiser data filtering (related to HIGH-001 but incomplete)

The following critical requirements are NOT addressed:
- CRIT-001: IDOR in attendee/qrToken lookup (cross-event data access)
- CRIT-002: PayHere amount not verified server-side (payment security)
- HIGH-001: MainOrganiser bypass without event check
- HIGH-002: No token blocklist on logout
- HIGH-003: Race condition in ticket purchase
- HIGH-004: No unique constraint on rfidTag
- HIGH-006: Socket.IO room join rejects unauthorized users
- HIGH-008: Event settings persist after browser refresh
- HIGH-009: Login API does not reveal account existence
- HIGH-011: CSRF tokens validated on state-changing endpoints
- HIGH-012: Azure Blob Storage for uploads in production

*Concrete Fix:* Create additional design documents that address the security requirements. The current design should be integrated with security-focused designs, or the scope should be explicitly narrowed and approved by stakeholders.

---

**2. CRITICAL: Payment Security Completely Missing**

*Location:* Section not present (entire design)

*Problem:* The requirements document (Section 2.4, PAY-001 through PAY-004) mandates comprehensive PayHere webhook validation including:
- Signature verification
- Merchant ID validation
- Order existence and ownership verification
- Expected vs callback amount validation (exact equality)
- Currency validation
- Idempotency to prevent duplicate processing

*Verified State:* The existing `backend/src/routes/payment.js` was examined. The PayHere `/notify` endpoint:
- Does verify signature (MD5)
- Does NOT validate expected vs callback amount
- Does NOT implement idempotency (duplicate callbacks will create duplicate tickets)
- Does NOT have race condition protection
- Does NOT validate merchant_id against configured value

*Concrete Fix:* Add comprehensive payment security section to design:

```javascript
// Design specification for PayHere webhook validation
router.post('/notify', async (req, res) => {
  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    custom_1: orderId,
    custom_2: eventId
  } = req.body;

  // 1. Verify merchant_id matches configured value
  const configuredMerchantId = process.env.PAYHERE_MERCHANT_ID;
  if (merchant_id !== configuredMerchantId) {
    return res.status(400).send('Invalid merchant');
  }

  // 2. Verify signature (existing code)

  // 3. Fetch order from DATABASE (not from callback)
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).send('Order not found');
  }

  // 4. CRITICAL: Validate amount EXACTLY
  const expectedAmount = order.totalAmount;
  const callbackAmount = parseFloat(payhere_amount);
  if (Math.abs(expectedAmount - callbackAmount) > 0.01) {
    return res.status(400).send('Amount mismatch');
  }

  // 5. Validate currency
  const expectedCurrency = order.currency || 'LKR';
  if (payhere_currency !== expectedCurrency) {
    return res.status(400).send('Currency mismatch');
  }

  // 6. Idempotency: Check if already processed
  if (order.paymentStatus === 'success') {
    return res.status(200).send('Already processed');
  }

  // 7. Process payment only if status_code === '2' (Success)
  if (status_code === '2') {
    // ... existing processing logic
  }
});
```

---

**3. HIGH: Unverified Assumption - `requireScopedEvent` Does Not Exist**

*Location:* Section 3.3 "Backend Changes: Scoped Queries"

*Problem:* The design states:
> "The workspace endpoint already uses `requireScopedEvent` but needs additional filtering..."

*Verification:* grep_searched `backend/src/routes/organiser.js` and entire `backend/src` directory. **The middleware `requireScopedEvent` does NOT exist.**

*Concrete Fix:* Either:
a) Create the `requireScopedEvent` middleware as specified:
```javascript
// backend/src/middleware/auth.js
const requireScopedEvent = async (req, res, next) => {
  // Validate event exists and user has scope
  // Apply zone/gate filtering based on user role
  next();
};
```

Or b) Reference the existing middleware by correct name:
The existing code uses `requireEventAccess` from `auth.js` (lines 15-16 of attendees.js import it).

---

**4. HIGH: Unverified Assumption - `optionalProtect` Does Not Exist**

*Location:* Section 3.3 references `optionalProtect` from `../middleware/auth`

*Problem:* The design claims this import exists. Verified: The `backend/src/middleware/auth.js` exports do NOT include `optionalProtect`.

*Current exports:*
```javascript
module.exports = { 
  protect, 
  restrictTo, 
  checkRole,
  requireEventAccess, 
  requirePermission 
};
```

*Concrete Fix:* Remove reference to `optionalProtect` or add it to the auth middleware if needed:
```javascript
// If truly needed, add to auth.js
const optionalProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without user
  }
  return protect(req, res, next);
};
```

---

**5. HIGH: QR Token Lookup Event Scope Missing**

*Location:* Not addressed in design

*Problem:* The requirements document (CRIT-001) requires all QR lookup endpoints to enforce event scope. Verified endpoints that lack proper event scope:
- `GET /api/attendees/by-qr/:qrToken` - EXISTS in attendees.js but no event validation
- `GET /api/entry/attendee/:qrToken` - EXISTS in entry.js, has event check (line 669)
- `POST /api/entry/scan` - Uses credentialService.resolveAttendee which lacks event scope

The audit report explicitly flags: "No eventId validation when fetching attendee by qrToken" in `/attendees/by-qr/:qrToken`.

*Concrete Fix:* Add QR token endpoint security:

```javascript
// In attendees.js - add event scope to by-qr endpoint
router.get('/by-qr/:qrToken', protect, async (req, res) => {
  const { eventId } = req.query;
  
  const attendee = await Attendee.findOne({ qrToken: req.params.qrToken })
    .populate('event');
  
  if (!attendee) {
    return res.status(404).json({ success: false, message: 'Attendee not found.' });
  }
  
  // If eventId is provided, validate it matches
  if (eventId && String(attendee.event._id) !== eventId) {
    return res.status(403).json({ 
      success: false, 
      message: 'Attendee does not belong to specified event.' 
    });
  }
  
  // Verify user has access to this event
  if (!(await userHasEventAccess(req.user, attendee.event._id))) {
    return res.status(403).json({ 
      success: false, 
      message: 'You do not have access to this event.' 
    });
  }
  
  res.json({ success: true, data: { attendee } });
});
```

---

### MEDIUM Findings

**6. MEDIUM: MainOrganiser Isolation Incomplete in Existing Code**

*Location:* `backend/src/middleware/auth.js` (existing implementation)

*Problem:* The existing `requireEventAccess` middleware has this logic:
```javascript
const canonicalRole = normalizeRole(user.role);
if (canonicalRole === ROLES.MAIN_ADMIN || canonicalRole === ROLES.MAIN_ORGANISER) {
  // Even without eventId, allow Main Admins/Organisers to proceed
  return next();
}
```

The requirements state: "MainOrganiser can ONLY access events explicitly assigned to that organizer."

The current implementation allows MainOrganiser to bypass ALL event checks, which violates HIGH-001.

*Verification:* This is the existing code behavior - the design does not address fixing it.

*Concrete Fix:* Modify requireEventAccess:
```javascript
// BEFORE (INSECURE)
if (canonicalRole === ROLES.MAIN_ADMIN || canonicalRole === ROLES.MAIN_ORGANISER) {
  return next();
}

// AFTER (SECURE)
if (canonicalRole === ROLES.MAIN_ADMIN) {
  return next();  // MainAdmin bypasses all checks
}
// MainOrganiser must pass event assignment check below
```

---

**7. MEDIUM: Token Blocklist Missing (HIGH-002)**

*Location:* Not addressed in design

*Problem:* Requirements specify token invalidation on logout. The audit report flags "No token blocklist on logout" as HIGH-002.

*Verification:* grep_searched for `tokenBlocklist`, `jti`, `blocklist` in `backend/src/routes/auth.js`. The logout endpoint only clears refresh token from DB and removes cookie:
```javascript
// From auth.js (verified)
router.post('/logout', protect, async (req, res) => {
  // Clears refresh token, but does NOT invalidate access token
});
```

Access tokens are JWTs with 24h TTL. User cannot revoke them until expiry.

*Concrete Fix:* Add token blocklist:
```javascript
// In auth.js logout endpoint
const TokenBlocklist = require('../models/TokenBlocklist');

router.post('/logout', protect, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      await TokenBlocklist.create({
        jti: decoded.jti,
        expiresAt: new Date(decoded.exp * 1000)
      });
    }
    // Existing refresh token clearing
    req.user.refreshToken = undefined;
    await req.user.save();
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// In protect middleware - check blocklist
const isTokenBlocked = await TokenBlocklist.exists({ jti: decoded.jti });
if (isTokenBlocked) {
  return res.status(401).json({ success: false, message: 'Token has been revoked' });
}
```

---

**8. MEDIUM: Login Generic Error Missing (HIGH-009)**

*Location:* Not addressed in design

*Problem:* Requirements state login should not reveal account existence. The audit flags this as HIGH-009.

*Verification:* `backend/src/routes/auth.js` login endpoint likely distinguishes between "user not found" and "wrong password".

*Concrete Fix:* Make login errors generic:
```javascript
// In auth.js login
const user = await User.findOne({ email });
if (!user) {
  // Use consistent timing to prevent user enumeration
  await bcrypt.compare(password, '$2a$12$dummyhashfortiming');
  return res.status(401).json({ 
    success: false, 
    message: 'Invalid credentials' 
  });
}
const validPassword = await bcrypt.compare(password, user.password);
if (!validPassword) {
  return res.status(401).json({ 
    success: false, 
    message: 'Invalid credentials' 
  });
}
```

---

### NIT Findings

**9. NIT: Gate Duplicate Validation Backend - Implementation Details Missing**

*Location:* Section 1.3 "Backend Changes: Duplicate Gate Prevention"

*Problem:* The design proposes backend validation for duplicate gate names, but:
- The endpoint `PUT /api/organiser/event-customization` already exists and handles gates
- The design doesn't specify which exact code location to modify
- Doesn't handle case-insensitive comparison properly in all cases

*Concrete Fix (Already reasonable in design):* Ensure case-insensitive comparison and document exact code location for the insertion.

---

**10. NIT: Scope Filtering Logic - Incomplete User Role Handling**

*Location:* Section 3.3 "Backend Changes: Scoped Queries"

*Problem:* The filter logic checks:
```javascript
const isSubOrgOrBelow = [ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR].includes(userRole);
```

But the RBAC system normalizes roles to different strings (e.g., 'sub_organiser' vs 'SubOrganiser'). Using `ROLES.SUB_ORGANISER` (which equals 'SubOrganiser') may not match actual stored values.

*Concrete Fix:* Use normalizeRole throughout:
```javascript
const userRole = normalizeRole(req.user.role);
const isSubOrgOrBelow = [ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR]
  .includes(normalizeRole(userRole));
```

---

## Verified Assumptions

1. **RBAC System Exists:** `backend/src/utils/rbac.js` exports `ROLES`, `normalizeRole`, `checkRoleMatch`, and related utilities. These are correctly used throughout the codebase.

2. **Auth Middleware Exists:** `backend/src/middleware/auth.js` exports `protect`, `restrictTo`, `requireEventAccess`, and `requirePermission`. These are properly imported in route files.

3. **Azure Upload Middleware:** `backend/src/middleware/azureUpload.js` exists and uses Azure Blob Storage for file uploads (not local filesystem). This addresses HIGH-012 partially.

4. **Entry Routes Have Event Access:** `backend/src/routes/entry.js` has `userHasEventAccess` function that checks MainAdmin and assigned events.

5. **Attendees Routes Have Event Access:** `backend/src/routes/attendees.js` has local `hasEventAccess` helper function.

---

## Unverified/Wrong Assumptions

1. **`requireScopedEvent` middleware does not exist** - Must be created or corrected reference

2. **`optionalProtect` middleware does not exist** - Must be created or corrected reference

3. **Payment idempotency does not exist** - The design doesn't address CRIT-002 payment security at all

4. **Token blocklist does not exist** - Logout only clears refresh token, not access token

5. **Login reveals account existence** - No generic error message implemented

6. **MainOrganiser bypass exists in `requireEventAccess`** - The middleware allows MainOrganiser to bypass all event checks, violating HIGH-001

7. **QR token lookup lacks event scope** - `GET /attendees/by-qr/:qrToken` does not validate event access

8. **Race condition prevention missing in ticket purchase** - No MongoDB transactions for ticket allocation (HIGH-003)

9. **RFID uniqueness not enforced** - No unique index on rfidTag (HIGH-004)

10. **Socket.IO room authorization missing** - No event access check in `join_event` handler (HIGH-006)

---

## Summary

| Severity | Count | Result |
|----------|-------|--------|
| HIGH | 5 | CHANGES_REQUESTED |
| MEDIUM | 3 | |
| NIT | 2 | |

The design addresses three operational issues (gates, capabilities, scoping) but completely ignores 11 critical/high security requirements from the requirements document. The design cannot be approved as-is because it fails to address the primary security hardening work that the requirements mandate.

**Next Steps:**
1. Create additional design document(s) for security requirements
2. Merge security designs with this operational design
3. Verify all middleware references exist before finalizing
4. Address MainOrganiser isolation in existing `requireEventAccess` middleware