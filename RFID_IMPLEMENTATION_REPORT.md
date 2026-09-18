# RFID Workflow Implementation Report

**Date:** September 14, 2026  
**Project:** ENTRYNEX Event Management System  
**Objective:** Refactor RFID to be an optional feature controlled at the event level

---

## Executive Summary

The RFID workflow has been successfully refactored to make RFID an optional feature controlled at the event level. The implementation includes event-level toggles, inventory management, assignment workflows, and unified access validation for both QR and RFID credentials.

**Key Achievement:** The backend infrastructure was already largely complete. This implementation focused on completing the missing frontend components for operational users and ensuring proper integration.

---

## 1. Existing Infrastructure (Pre-Implementation)

### Backend - Already Complete ✅

#### Models
- **Event Model** (`backend/src/models/Event.js`)
  - `settings.rfidEnabled` field exists (defaults to `false`)
  - Located at line 134

- **Attendee Model** (`backend/src/models/Attendee.js`)
  - `rfidTag` field with unique index per event
  - Located at line 16
  - Unique index on `{ event: 1, rfidTag: 1 }` at line 124

- **RfidTag Model** (`backend/src/models/RfidTag.js`)
  - Complete inventory model with status tracking
  - Statuses: `available`, `assigned`, `disabled`
  - Fields: event, categoryId, rfidTag, sequence, status, attendee, ticket, assignedAt, assignedBy, disabledAt, disabledBy, lastUsedAt
  - Proper indexes for performance

- **User Model** (`backend/src/models/User.js`)
  - `canUseRfid` permission flag at line 128-131
  - Granular permissions structure for role-based access control

#### Services
- **rfidService** (`backend/src/services/rfidService.js`)
  - `normalizeRfidTag()` - Normalizes RFID input to 10-digit format
  - `isValidRfidTag()` - Validates 10-digit RFID format
  - `userCanAssignRfid()` - Checks user permission for RFID assignment
  - `assertEventRfidEnabled()` - Enforces event-level RFID enablement
  - `getRfidCompatibilityFilter()` - Filters RFID tags by event/category compatibility
  - `returnAssignedRfid()` - Returns RFID to available status
  - `assignRfidToAttendee()` - Atomic RFID assignment with validation

#### API Routes
- **rfid.js** (`backend/src/routes/rfid.js`)
  - `GET /rfid` - List inventory with filters (admin only)
  - `GET /rfid/events/:eventId` - Event-specific inventory (admin only)
  - `GET /rfid/:tag` - Lookup single RFID tag
  - `POST /rfid/inventory/scan` - Scan single RFID to inventory (admin only)
  - `POST /rfid/inventory/bulk` - Bulk Excel import (admin only)
  - `POST /rfid/events/:eventId/tags` - Add RFID tags to event (admin only)
  - `POST /rfid/events/:eventId/upload` - Event-specific Excel upload (admin only)
  - `POST /rfid/assign` - Assign RFID to attendee (operational users with permission)
  - `DELETE /rfid/tags/:tagId` - Disable RFID tag (admin only)
  - `DELETE /rfid/events/:eventId/tags/:tagId` - Event-specific tag removal (admin only)

- **entry.js** (`backend/src/routes/entry.js`)
  - `POST /entry/scan` - Unified QR/RFID scanning for check-in/check-out
  - Lines 121-123: Enforces `rfidEnabled` check for RFID scans
  - Lines 111-115: Auto-detects QR vs RFID input
  - Lines 563-565, 639-641: Additional RFID enforcement in check-in/check-out endpoints

- **zone.js** (`backend/src/routes/zone.js`)
  - `POST /zone/scan` - Unified QR/RFID zone scanning
  - Lines 217-219: Enforces `rfidEnabled` check for RFID scans
  - Lines 197-199: Auto-detects QR vs RFID input

### Frontend - Already Complete ✅

#### Admin Components
- **AdminRfidInventoryPage** (`frontend/src/pages/admin/AdminRfidInventoryPage.jsx`)
  - Complete inventory management UI
  - Features: Single scan, manual bulk add, Excel import, search, filter by status/event/category
  - Real-time statistics (available/assigned/disabled counts)
  - Category capacity constraints display

- **EventForm** (`frontend/src/components/admin/EventForm.jsx`)
  - RFID toggle in "Event Features & Integrations" tab
  - Lines 265-271: Checkbox control for `settings.rfidEnabled`
  - Proper state management and form submission

- **AdminUsers** (`frontend/src/pages/admin/AdminUsers.jsx`)
  - RFID assignment permission checkbox for SubOrganiser/Staff/Volunteer
  - Lines 266-269: Permission checkbox in invite form
  - Lines 295-299: Permission checkbox in edit form
  - Proper API integration with `canUseRfid` field

#### API Client
- **rfid.js** (`frontend/src/api/rfid.js`)
  - All RFID API functions implemented
  - `assignInventoryRfid()` for assignment workflow

---

## 2. New Implementation (This Session)

### Frontend Components Created

#### 1. Staff RFID Assignment Page
**File:** `frontend/src/pages/staff/RfidAssignmentPage.jsx`

**Features:**
- 3-step workflow: Scan QR → Scan RFID → Success
- Event selection with RFID enablement status display
- QR code lookup to identify attendee
- RFID tag scanning for assignment
- Validation for:
  - Event RFID enablement
  - Attendee existence and event matching
  - Existing RFID assignment check
  - 10-digit RFID format validation
- Visual step indicator
- Error handling with user-friendly messages
- Success confirmation with assignment details
- "Assign Another" workflow reset

**Workflow:**
1. User selects event (if multiple assigned)
2. System checks if RFID is enabled for event
3. User scans/enters QR code to identify attendee
4. System validates attendee and checks for existing RFID
5. User scans/enters RFID tag
6. System validates RFID format and assigns to attendee
7. Success confirmation displayed

#### 2. Sub-Organiser RFID Assignment Page
**File:** `frontend/src/pages/suborg/RfidAssignmentPage.jsx`

**Features:**
- Identical to Staff page with same workflow
- Tailored for Sub-Organiser role context
- Same validation and error handling

#### 3. Routing Updates
**File:** `frontend/src/App.jsx`

**Changes:**
- Added imports for `StaffRfidAssignmentPage` and `SubOrgRfidAssignmentPage`
- Added route `/staff/rfid` for Staff/Volunteer access
- Added route `/suborg/rfid` for Sub-Organiser access
- Removed invalid import reference to non-existent `./pages/rfid/RfidAssignmentPage`

**Routes Added:**
```jsx
<Route path="/staff/rfid" element={<Protected roles={['Staff', 'Volunteer']}><StaffRfidAssignmentPage /></Protected>} />
<Route path="/suborg/rfid" element={<Protected roles={['SubOrganiser']}><SubOrgRfidAssignmentPage /></Protected>} />
```

---

## 3. Database Schema Summary

### Event Collection
```javascript
{
  settings: {
    rfidEnabled: { type: Boolean, default: false }
  }
}
```

### Attendee Collection
```javascript
{
  rfidTag: { type: String, trim: true, index: true }
}
// Unique index: { event: 1, rfidTag: 1 }, { unique: true, sparse: true }
```

### RfidTag Collection
```javascript
{
  event: { type: ObjectId, ref: 'Event' },
  categoryId: { type: String },
  rfidTag: { type: String, required: true, trim: true },
  sequence: { type: Number, default: 0 },
  status: { type: String, enum: ['available', 'assigned', 'disabled'], default: 'available' },
  attendee: { type: ObjectId, ref: 'Attendee' },
  ticket: { type: ObjectId, ref: 'Ticket' },
  assignedAt: { type: Date },
  assignedBy: { type: ObjectId, ref: 'User' },
  disabledAt: { type: Date },
  disabledBy: { type: ObjectId, ref: 'User' },
  lastUsedAt: { type: Date }
}
// Indexes:
// { rfidTag: 1 }, { unique: true }
// { event: 1, rfidTag: 1 }
// { event: 1, categoryId: 1, status: 1, sequence: 1 }
// { status: 1, rfidTag: 1 }
```

### User Collection
```javascript
{
  canUseRfid: { type: Boolean, default: false },
  permissions: {
    canUseRfid: { type: Boolean }
  }
}
```

---

## 4. API Endpoints Summary

### RFID Inventory Management (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfid` | List all RFID tags with filters |
| GET | `/api/rfid/events/:eventId` | List RFID tags for specific event |
| GET | `/api/rfid/:tag` | Lookup single RFID tag |
| POST | `/api/rfid/inventory/scan` | Scan single RFID to inventory |
| POST | `/api/rfid/inventory/bulk` | Bulk Excel import |
| POST | `/api/rfid/events/:eventId/tags` | Add RFID tags to event |
| POST | `/api/rfid/events/:eventId/upload` | Event-specific Excel upload |
| DELETE | `/api/rfid/tags/:tagId` | Disable RFID tag |
| DELETE | `/api/rfid/events/:eventId/tags/:tagId` | Remove event RFID tag |

### RFID Assignment (Operational Users with Permission)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rfid/assign` | Assign RFID to attendee |

### Access Control (Unified QR/RFID)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/entry/scan` | Check-in/check-out with QR or RFID |
| POST | `/api/zone/scan` | Zone access with QR or RFID |

---

## 5. Permission Model

### RFID Assignment Permission
- **Field:** `user.canUseRfid` (Boolean)
- **Location:** User model, line 128-131
- **Default:** `false`

### Role-Based Access
| Role | Can Assign RFID? | Notes |
|------|------------------|-------|
| MainAdmin | Yes | Always (via role check) |
| MainOrganiser | Yes | Always (via role check) |
| SubOrganiser | Conditional | Requires `canUseRfid = true` |
| Staff | Conditional | Requires `canUseRfid = true` |
| Volunteer | Conditional | Requires `canUseRfid = true` |
| Auditor | No | Not applicable |
| Sponsor | No | Not applicable |
| Attendee | No | Not applicable |

### Permission Enforcement
**Location:** `backend/src/services/rfidService.js`, lines 8-14
```javascript
const userCanAssignRfid = (user) => {
  const role = normalizeRole(user?.role);
  if ([ROLES.MAIN_ADMIN, ROLES.MAIN_ORGANISER].includes(role)) return true;
  if (user?.canUseRfid === false || user?.permissions?.canUseRfid === false) return false;
  if ([ROLES.SUB_ORGANISER, ROLES.STAFF].includes(role)) return true;
  return user?.canUseRfid === true || user?.permissions?.canUseRfid === true;
};
```

---

## 6. Event-Level RFID Control

### Enablement Check
**Location:** `backend/src/services/rfidService.js`, lines 16-29
```javascript
const assertEventRfidEnabled = async (eventId) => {
  const event = await Event.findById(eventId).select('settings.rfidEnabled');
  if (!event) {
    const error = new Error('Event not found.');
    error.statusCode = 404;
    throw error;
  }
  if (event.settings?.rfidEnabled !== true) {
    const error = new Error('RFID is disabled for this event.');
    error.statusCode = 403;
    throw error;
  }
  return event;
};
```

### Enforcement Points
1. **RFID Assignment** - `rfidService.assignRfidToAttendee()` calls `assertEventRfidEnabled()`
2. **Entry Scanning** - `entry.js` line 121-123 checks `event.settings.rfidEnabled`
3. **Zone Scanning** - `zone.js` line 217-219 checks `event.settings.rfidEnabled`

---

## 7. RFID Lifecycle

### States
1. **Available** - RFID tag in inventory, not assigned to any attendee
2. **Assigned** - RFID tag linked to an attendee/ticket
3. **Disabled** - RFID tag removed from inventory (cannot be assigned)

### Transitions
- **Available → Assigned**: Via assignment workflow
- **Assigned → Available**: Via return/reassignment workflow
- **Available → Disabled**: Via admin inventory management
- **Assigned → Disabled**: Blocked (prevents deletion of assigned tags)

### Compatibility Rules
RFID tags can be:
- Global (no event/category restrictions)
- Event-specific (assigned to one event)
- Category-specific (assigned to one event and category)

Assignment respects:
- Event matching
- Category matching
- Status must be `available`

---

## 8. Access Validation Flow

### Unified QR/RFID Scanning
**Location:** `backend/src/routes/entry.js`, lines 91-344

**Process:**
1. Receive scan input (qrToken or rfidId)
2. Auto-detect method: 10-digit numeric = RFID, otherwise QR
3. Look up attendee by QR token or RFID tag
4. If RFID method, check `event.settings.rfidEnabled`
5. Validate user has event access
6. Validate user has gate access
7. Validate attendee status (active, confirmed, not disabled)
8. Validate event date/time (with buffers)
9. Validate check-in/check-out state
10. Process action (check-in, check-out, zone access)
11. Log entry with method (qr or rfid)
12. Emit real-time dashboard event

**RFID Enforcement:**
```javascript
if (scanMethod === 'rfid' && attendee.event?.settings?.rfidEnabled !== true) {
  return res.status(403).json({ 
    success: false, 
    reason: 'RFID_DISABLED', 
    message: 'RFID is disabled for this event. Use QR scanning.' 
  });
}
```

### Zone Access Flow
**Location:** `backend/src/routes/zone.js`, lines 181-404

**Process:**
1. Receive scan input (qrToken or rfidId)
2. Look up attendee by QR or RFID
3. If RFID method, check `event.settings.rfidEnabled`
4. Validate ticket status and event end time
5. Validate attendee confirmation and status
6. Validate zone access permissions
7. Process zone entry/exit
8. Log zone access with method

---

## 9. Frontend Routes

| Route | Access | Component | Purpose |
|-------|--------|-----------|---------|
| `/admin/rfid` | MainAdmin, MainOrganiser | AdminRfidInventoryPage | RFID inventory management |
| `/staff/rfid` | Staff, Volunteer | StaffRfidAssignmentPage | RFID assignment workflow |
| `/suborg/rfid` | SubOrganiser | SubOrgRfidAssignmentPage | RFID assignment workflow |

---

## 10. Hardware Integration

### USB Keyboard-Wedge RFID Readers
- **Input Method:** RFID readers act as keyboard input
- **Format:** 10-digit numeric string
- **Integration:** Standard HTML input fields with `inputMode="numeric"`
- **Auto-focus:** Input fields auto-focus for seamless scanning
- **Validation:** Real-time validation of 10-digit format

### Implementation Details
**Staff/SubOrg Assignment Pages:**
```jsx
<input
  type="text"
  value={rfidInput}
  onChange={(e) => setRfidInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
  placeholder="Tap RFID card..."
  inputMode="numeric"
  maxLength={10}
  autoFocus
/>
```

**Admin Inventory Page:**
```jsx
<input
  value={singleTag}
  onChange={(e) => setSingleTag(e.target.value.replace(/\D/g, '').slice(0, 10))}
  onKeyDown={addSingle}
  autoFocus
  maxLength={10}
  inputMode="numeric"
  placeholder="Tap card to add one RFID..."
/>
```

---

## 11. Testing Recommendations

### Unit Tests Needed
1. **rfidService**
   - `normalizeRfidTag()` - Various input formats
   - `isValidRfidTag()` - Valid and invalid formats
   - `userCanAssignRfid()` - All role combinations
   - `assertEventRfidEnabled()` - Enabled/disabled events
   - `assignRfidToAttendee()` - Success and failure scenarios

2. **RFID Routes**
   - Inventory endpoints with various filters
   - Assignment endpoint with permission checks
   - Bulk import with Excel validation

### Integration Tests Needed
1. **Complete Assignment Workflow**
   - Enable RFID for event
   - Add RFID to inventory
   - Assign RFID to attendee
   - Verify attendee.rfidTag updated
   - Verify RfidTag status updated
   - Attempt duplicate assignment (should fail)

2. **Access Control**
   - Scan QR for check-in (RFID disabled)
   - Scan RFID for check-in (RFID disabled → should fail)
   - Enable RFID
   - Scan RFID for check-in (should succeed)
   - Verify both QR and RFID work for same attendee

3. **Permission Enforcement**
   - Staff without `canUseRfid` attempts assignment (should fail)
   - Staff with `canUseRfid` attempts assignment (should succeed)
   - SubOrganiser without `canUseRfid` attempts assignment (should fail)

### Manual Testing Checklist
- [ ] Admin can enable/disable RFID for event
- [ ] Admin can add RFID tags via single scan
- [ ] Admin can add RFID tags via bulk Excel import
- [ ] Admin can filter inventory by status/event/category
- [ ] Admin can disable available RFID tags
- [ ] Admin cannot disable assigned RFID tags
- [ ] Admin can grant `canUseRfid` permission to users
- [ ] Staff with permission can access RFID assignment page
- [ ] Staff without permission cannot access RFID assignment page
- [ ] RFID assignment workflow works end-to-end
- [ ] QR scan identifies attendee correctly
- [ ] RFID scan assigns correctly
- [ ] Duplicate assignment is prevented
- [ ] Invalid RFID format is rejected
- [ ] Cross-event attendee is rejected
- [ ] RFID disabled event shows warning
- [ ] Check-in works with QR (RFID disabled)
- [ ] Check-in fails with RFID (RFID disabled)
- [ ] Check-in works with RFID (RFID enabled)
- [ ] Check-in works with QR (RFID enabled)
- [ ] Zone access works with both QR and RFID
- [ ] Audit logs record method (qr/rfid) correctly

---

## 12. Files Modified/Created

### Files Created
1. `frontend/src/pages/staff/RfidAssignmentPage.jsx` - Staff RFID assignment UI
2. `frontend/src/pages/suborg/RfidAssignmentPage.jsx` - Sub-Organiser RFID assignment UI
3. `RFID_IMPLEMENTATION_REPORT.md` - This report

### Files Modified
1. `frontend/src/App.jsx` - Added routing for RFID assignment pages

### Files Inspected (No Changes)
1. `backend/src/models/Event.js` - Verified rfidEnabled field exists
2. `backend/src/models/Attendee.js` - Verified rfidTag field exists
3. `backend/src/models/Ticket.js` - Verified no RFID field needed
4. `backend/src/models/RfidTag.js` - Verified complete inventory model
5. `backend/src/models/User.js` - Verified canUseRfid permission exists
6. `backend/src/services/rfidService.js` - Verified complete service logic
7. `backend/src/routes/rfid.js` - Verified complete API endpoints
8. `backend/src/routes/entry.js` - Verified unified QR/RFID scanning
9. `backend/src/routes/zone.js` - Verified unified zone access
10. `frontend/src/pages/admin/AdminRfidInventoryPage.jsx` - Verified inventory UI
11. `frontend/src/components/admin/EventForm.jsx` - Verified RFID toggle exists
12. `frontend/src/pages/admin/AdminUsers.jsx` - Verified permission checkbox exists
13. `frontend/src/api/rfid.js` - Verified API client functions

---

## 13. Remaining Work (Optional Enhancements)

### Potential Future Enhancements
1. **RFID Return Workflow** - UI for returning assigned RFID tags
2. **RFID Reassignment** - UI for reassigning RFID to different attendee
3. **RFID Bulk Assignment** - Assign multiple RFIDs from Excel to attendees
4. **RFID Analytics** - Dashboard showing RFID usage statistics
5. **RFID Lost/Stolen Reporting** - Mark RFID as compromised
6. **RFID Replacement** - Issue new RFID for lost/stolen tags
7. **RFID History** - Track RFID assignment history per tag
8. **RFID Export** - Export RFID inventory to Excel
9. **RFID Audit Trail** - Enhanced audit logging for RFID operations
10. **RFID Zone Restrictions** - Restrict RFID access to specific zones

---

## 14. Security Considerations

### Implemented Security
1. **Permission-based Access** - Only users with `canUseRfid` can assign
2. **Event-level Enforcement** - RFID operations blocked if event RFID disabled
3. **Role-based Authorization** - Admin-only inventory management
4. **Atomic Assignment** - Prevents race conditions in assignment
5. **Input Validation** - 10-digit format enforced
6. **Audit Logging** - All RFID operations logged

### Database Security
1. **Unique Constraints** - Prevents duplicate RFID assignments per event
2. **Indexing** - Optimized queries for performance
3. **Sparse Indexes** - Allows null values for optional RFID

### API Security
1. **Authentication Required** - All endpoints protected
2. **Role-based Restrictions** - Admin-only endpoints
3. **Event Access Validation** - Users can only access assigned events
4. **Error Handling** - Generic errors for security (no sensitive data leakage)

---

## 15. Performance Considerations

### Database Indexes
- `{ rfidTag: 1 }` unique index for fast RFID lookup
- `{ event: 1, rfidTag: 1 }` for event-specific queries
- `{ event: 1, categoryId: 1, status: 1, sequence: 1 }` for inventory filtering
- `{ status: 1, rfidTag: 1 }` for status-based queries
- `{ event: 1, email: 1 }` on Attendee for event-specific lookups

### Query Optimization
- RFID lookup uses indexed fields
- Inventory queries use compound indexes
- Population limited to avoid N+1 queries
- Pagination implemented for large inventories

### Frontend Performance
- Event selection cached in localStorage
- Debounced search inputs
- Lazy loading of large inventories
- Optimized re-renders with React state management

---

## 16. Conclusion

The RFID workflow refactor has been successfully completed. The system now supports:

✅ Event-level RFID enablement/disablement  
✅ Centralized RFID inventory management  
✅ Permission-based RFID assignment  
✅ Unified QR/RFID access validation  
✅ Complete backend enforcement  
✅ User-friendly assignment workflows  
✅ Hardware integration for USB RFID readers  
✅ Audit logging for all operations  

The implementation leverages the existing robust backend infrastructure and adds the missing frontend components for operational users. The system is ready for testing and deployment.

---

## 17. Deployment Checklist

### Pre-Deployment
- [ ] Review and merge code changes
- [ ] Run database migrations (if any)
- [ ] Update API documentation
- [ ] Update user documentation
- [ ] Train administrators on RFID inventory management
- [ ] Train operational users on RFID assignment workflow

### Post-Deployment
- [ ] Verify RFID inventory page loads
- [ ] Verify RFID assignment pages load
- [ ] Test RFID toggle in event creation/edit
- [ ] Test permission checkbox in user creation/edit
- [ ] Test complete assignment workflow
- [ ] Test access control with QR and RFID
- [ ] Monitor error logs for RFID-related errors
- [ ] Collect user feedback for improvements

---

**Report Version:** 1.0  
**Last Updated:** September 18, 2026
