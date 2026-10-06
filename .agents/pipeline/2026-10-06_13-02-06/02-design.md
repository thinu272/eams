# Technical Design Document: Team Member Capabilities & Event-Scoped Data Access

**Version:** 1.0
**Date:** 2026-10-06
**Status:** Ready for Review

---

## Overview

This design addresses three intertwined issues: gate state inconsistency in the customization flow, incomplete capabilities enforcement for team members, and lack of event-scoped data filtering for Sub-Organisers and Staff. The solution modifies the gate handling logic in both frontend and backend to prevent duplicates and preserve state across soft reloads, extends the team member modal to properly sync capabilities, and adds scoped data filtering in Sub-Org pages using the existing `assignedZones`, `assignedGates`, and `assignedCategories` fields on user documents.

---

## 1. Gates Bug Fix

### Current Issue Analysis

The console logs show repeated `Add gate clicked` and `Remove gate clicked` messages with inconsistent array lengths (`Array(1)`, `Array(0)`, `Array(2)`), indicating race conditions or state loss during soft workspace reloads. The frontend already has ref-based protection (`gatesDirtyRef`, `eventGatesEventIdRef`, `gatesLockedUntilRef`, `lastSavedGatesRef`) but the logic has gaps:

1. **Missing duplicate validation:** Adding a gate with the same name as an existing gate is allowed
2. **Index-based removal bug:** `Array.splice(idx, 1)` may operate on stale state if the array was modified during a soft reload
3. **Race condition in loadWorkspace:** The gates sync logic checks `!gatesBelongToThisEvent` but never resets `eventGatesEventIdRef` when switching events
4. **Backend lacks uniqueness enforcement:** The API accepts duplicate gate names without validation

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/pages/organiser/OrganiserDashboard.jsx` | Modify | Fix gate state management and duplicate prevention |
| `backend/src/routes/organiser.js` | Modify | Add gate name uniqueness validation in PUT endpoint |
| `frontend/src/api/organiser.js` | Modify | Update `updateOrganiserEventCustomization` to return validation errors |

### Frontend Changes: Gate State Management

**Proposed Implementation:**

```javascript
// In OrganiserDashboard.jsx, replace the addGate and removeGate handlers

const handleAddGate = useCallback(() => {
  gatesDirtyRef.current = true;
  setEventGates((gates) => {
    const list = Array.isArray(gates) ? gates : [];
    const existingNames = new Set(list.map(g => String(g).trim().toLowerCase()));
    const nextIndex = list.length;
    // Generate unique name with counter suffix
    let newName = `Gate ${String.fromCharCode(65 + nextIndex)}`; // Gate A, Gate B, etc.
    let counter = 0;
    while (existingNames.has(newName.toLowerCase())) {
      counter++;
      newName = `Gate ${String.fromCharCode(65 + nextIndex)}-${counter}`;
    }
    return [...list, newName];
  });
}, []);

const handleRemoveGate = useCallback((idx) => {
  if (idx < 0) return;
  gatesDirtyRef.current = true;
  setEventGates((gates) => {
    const list = Array.isArray(gates) ? gates : [];
    if (idx >= list.length) return list; // Bounds check
    return list.filter((_, i) => i !== idx);
  });
}, []);
```

**Edge Case Handling:**

- **Duplicate gate names:** Prevent creation by checking against existing names with case-insensitive comparison
- **Empty gate name:** Reject empty strings in the `onChange` handler with inline validation
- **Special characters:** Allow alphanumeric, spaces, and basic punctuation; sanitize on submit
- **Race between add/remove:** Use functional state updates `setEventGates((prev) => ...)` to avoid stale closures

**Validation on Gate Name Change (onChange):**

```javascript
const handleGateNameChange = (idx, newValue) => {
  const trimmed = String(newValue || '').trim();
  if (!trimmed) {
    toast.error('Gate name cannot be empty');
    return;
  }
  gatesDirtyRef.current = true;
  setEventGates((list) => {
    const next = [...(list || [])];
    const existingNames = new Set(next.map((g, i) => i === idx ? null : String(g).trim().toLowerCase()).filter(Boolean));
    if (existingNames.has(trimmed.toLowerCase())) {
      toast.error(`Gate name '${trimmed}' already exists`);
      return next;
    }
    next[idx] = trimmed;
    return next;
  });
};
```

### Backend Changes: Duplicate Gate Prevention

In `backend/src/routes/organiser.js`, modify the PUT `/api/organiser/event-customization` endpoint. The endpoint already extracts gates from `basicInfo.gates`, `req.body.gates`, or `req.body.eventGates`. Add validation:

```javascript
// After extracting gates, before saving
const normalizeGates = (gates) => {
  if (!gates) return null;
  const normalized = Array.isArray(gates)
    ? gates.map(g => typeof g === 'string' ? g.trim() : g?.name?.trim() || '').filter(Boolean)
    : null;
  return normalized;
};

const extractedGates = normalizeGates(basicInfo?.gates) ?? normalizeGates(req.body.gates) ?? normalizeGates(req.body.eventGates);

// Add duplicate validation
if (extractedGates && extractedGates.length > 0) {
  const lowerGates = extractedGates.map(g => g.toLowerCase());
  const duplicates = lowerGates.filter((name, idx) => lowerGates.indexOf(name) !== idx);
  if (duplicates.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate gate names are not allowed',
      details: duplicates.map(name => `Gate '${name}' appears multiple times`)
    });
  }
}
```

**Error Handling:**

| Condition | HTTP Status | Response | Log Level |
|-----------|-------------|----------|-----------|
| Empty gates array | 200 | Success (valid) | Info |
| Duplicate names found | 400 | `{success: false, message, details: []}` | Warn |
| Gates not an array | 400 | `{success: false, message: 'Gates must be an array'}` | Warn |
| Server error during validation | 500 | `{success: false, message: 'Validation failed'}` | Error |

---

## 2. Team Member Capabilities Management

### Current Issue Analysis

The "Capabilities Actions this member can perform" section exists but may not properly sync with backend permissions. The empty `subOrg` form shows defaults for permissions (`canAddAttendees`, `canVerifyPhotos`, etc.) but the UI may not enforce scope limits when creating team members as a Sub-Organiser.

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/pages/organiser/OrganiserDashboard.jsx` | Modify | Enhance team member modal with proper capabilities sync |
| `backend/src/routes/organiser.js` | Modify | Add capability validation and scope enforcement |
| `backend/src/utils/rbac.js` | Read-only | Reference for permission definitions |
| `frontend/src/utils/rbac.js` | Read-only | Reference for frontend permission structure |

### Frontend Changes: Capabilities Panel

**Existing capability toggles (from emptySubOrg):**

```javascript
const emptySubOrg = {
  // ... other fields
  permissions: {
    canEntryAccess: false,
    canScanZones: false,
    canAddAttendees: true,
    canVerifyPhotos: true,
    canBulkUpload: false,
    canInviteAttendees: true,
    canCollectCash: false,
  },
  assignedZones: [],
  assignedGates: [],
  assignedCategories: [],
  operationScope: 'entry', // 'entry', 'zone', or 'both'
};
```

**Proposed UI enhancement in the team member modal:**

```javascript
// In the capabilities section, add operationScope-dependent visibility
const CapabilityToggle = ({ label, permissionKey, description }) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
    <input
      type="checkbox"
      checked={subOrgForm.permissions[permissionKey] ?? false}
      onChange={(e) => setSubOrgForm(prev => ({
        ...prev,
        permissions: { ...prev.permissions, [permissionKey]: e.target.checked }
      }))}
      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
    />
  </div>
);

// OperationScope selector with conditional field visibility
<div className="space-y-3">
  <label className="block text-sm font-medium text-slate-700">Operation Scope</label>
  <select
    value={subOrgForm.operationScope || 'entry'}
    onChange={(e) => setSubOrgForm(prev => ({ ...prev, operationScope: e.target.value }))}
    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
  >
    <option value="entry">Entry Only (assigned gates)</option>
    <option value="zone">Zone Only (assigned zones)</option>
    <option value="both">Both (gates and zones)</option>
  </select>

  {/* Conditionally show Assigned Gates or Zones based on operationScope */}
  {['entry', 'both'].includes(subOrgForm.operationScope) && (
    <div className="mt-3">
      <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Gates</label>
      <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
        {selectedEvent?.gates?.map(gate => (
          <label key={gate} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={subOrgForm.assignedGates.includes(gate)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSubOrgForm(prev => ({ ...prev, assignedGates: [...prev.assignedGates, gate] }));
                } else {
                  setSubOrgForm(prev => ({ ...prev, assignedGates: prev.assignedGates.filter(g => g !== gate) }));
                }
              }}
            />
            {gate}
          </label>
        ))}
      </div>
    </div>
  )}

  {['zone', 'both'].includes(subOrgForm.operationScope) && (
    <div className="mt-3">
      <label className="block text-sm font-medium text-slate-700 mb-2">Assigned Zones</label>
      <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
        {selectedEvent?.zones?.map(zone => (
          <label key={zone.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={subOrgForm.assignedZones.includes(zone.name || zone.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSubOrgForm(prev => ({ ...prev, assignedZones: [...prev.assignedZones, zone.name || zone.id] }));
                } else {
                  setSubOrgForm(prev => ({ ...prev, assignedZones: prev.assignedZones.filter(z => z !== (zone.name || zone.id)) }));
                }
              }}
            />
            {zone.name}
          </label>
        ))}
      </div>
    </div>
  )}
</div>
```

**Sub-Organiser Scope Limitation:**

When creating a team member while logged in as a Sub-Organiser, the available gates/zones must be filtered to only those the current user is assigned:

```javascript
// Get user's assigned gates/zones for scoping
const currentUserGates = user?.assignedGates || [];
const currentUserZones = user?.assignedZones || [];

// For Sub-Organisers, only show what they are assigned
const availableGates = user?.role === 'SubOrganiser'
  ? selectedEvent?.gates?.filter(g => currentUserGates.includes(g)) || []
  : selectedEvent?.gates || [];

const availableZones = user?.role === 'SubOrganiser'
  ? selectedEvent?.zones?.filter(z => currentUserZones.includes(z.name || z.id)) || []
  : selectedEvent?.zones || [];
```

### Backend Changes: Capability Validation

In `backend/src/routes/organiser.js`, add validation in the `createSubOrganiser` and `updateSubOrganiser` handlers:

```javascript
// Validate assigned zones/gates are subset of assigner's scope
const validateTeamMemberScope = async (req, assigner) => {
  const errors = [];
  
  // Normalize role
  const assignerRole = normalizeRole(assigner.role);
  if (![ROLES.MAIN_ORGANISER, ROLES.MAIN_ADMIN].includes(assignerRole)) {
    // Sub-Organisers have limited scope
    const allowedGates = assigner.assignedGates || [];
    const allowedZones = assigner.assignedZones || [];
    
    const requestedGates = (req.body.assignedGates || []).filter(Boolean);
    const requestedZones = (req.body.assignedZones || []).filter(Boolean);
    
    const invalidGates = requestedGates.filter(g => !allowedGates.includes(g));
    const invalidZones = requestedZones.filter(z => !allowedZones.includes(z));
    
    if (invalidGates.length > 0) {
      errors.push(`You cannot assign gates you don't have access to: ${invalidGates.join(', ')}`);
    }
    if (invalidZones.length > 0) {
      errors.push(`You cannot assign zones you don't have access to: ${invalidZones.join(', ')}`);
    }
  }
  
  return errors;
};

// Apply in the endpoint
const scopeErrors = await validateTeamMemberScope(req, req.user);
if (scopeErrors.length > 0) {
  return res.status(403).json({
    success: false,
    message: 'Scope validation failed',
    errors: scopeErrors
  });
}
```

**Error Handling:**

| Condition | HTTP Status | Response | Recoverable |
|-----------|-------------|----------|-------------|
| Sub-Organiser assigning unauthorized zone | 403 | `{success: false, message, errors: []}` | Yes - user can correct input |
| Main Organiser assigning any zone | 200 | Success | N/A |
| Invalid permission key | 400 | `{success: false, message: 'Invalid permission'}` | Yes |
| Missing required capability fields | 400 | `{success: false, message: 'Missing required fields'}` | Yes |

---

## 3. Event-Scoped Data Visibility

### Current Issue Analysis

Sub-Organisers and Staff may see data from all events rather than only their assigned scope. The SubOrgDashboard and SubOrgEntryScannerPage need to filter data based on `assignedEvents`, `assignedZones`, and `assignedGates`.

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/pages/suborg/SubOrgDashboard.jsx` | Modify | Filter all displayed data by user's event and zone scope |
| `frontend/src/pages/suborg/SubOrgEntryScannerPage.jsx` | Modify | Filter entry logs and stats by assigned gates/zones |
| `backend/src/routes/organiser.js` | Modify | Add scoped query filters for Sub-Org endpoints |
| `frontend/src/api/sub.js` | Modify | Pass scope parameters to backend APIs |

### Frontend Changes: SubOrgDashboard Scope Filtering

**Existing SubOrgDashboard structure (partial from grep_search):**

The dashboard shows stats, zones, team members, and attendees. All must be filtered.

**Proposed filtering implementation:**

```javascript
// In SubOrgDashboard.jsx
const { user } = useAuth();

// Get user's assigned events/zones/gates
const assignedEvents = user?.assignedEvents || [];
const assignedZones = user?.assignedZones || [];
const assignedGates = user?.assignedGates || [];

// Current event selection
const currentEventId = localStorage.getItem('lastSelectedEventId') || '';

// Filter zones based on user's assigned zones
const scopedZones = useMemo(() => {
  if (!workspace?.event?.zones) return [];
  if (assignedZones.length === 0) return workspace.event.zones;
  return workspace.event.zones.filter(zone => 
    assignedZones.includes(zone.name) || assignedZones.includes(zone.id)
  );
}, [workspace?.event?.zones, assignedZones]);

// Filter team members based on shared zone scope
const scopedTeamMembers = useMemo(() => {
  if (!workspace?.teamMembers) return [];
  return workspace.teamMembers.filter(member => {
    // Show if user is Main Organiser, or if they share at least one zone/gate
    if (['MainOrganiser', 'MainAdmin'].includes(user?.role)) return true;
    const memberZones = member.assignedZones || [];
    const memberGates = member.assignedGates || [];
    const sharesZone = assignedZones.some(z => memberZones.includes(z));
    const sharesGate = assignedGates.some(g => memberGates.includes(g));
    return sharesZone || sharesGate;
  });
}, [workspace?.teamMembers, assignedZones, assignedGates, user?.role]);

// Filter attendees by zone scope (for zone-specific views)
const scopedAttendees = useMemo(() => {
  if (!workspace?.attendees) return [];
  if (assignedZones.length === 0) return workspace.attendees;
  return workspace.attendees.filter(attendee => 
    (attendee.allowedZones || []).some(z => assignedZones.includes(z))
  );
}, [workspace?.attendees, assignedZones]);
```

**Zone Card Display Only Assigned Zones:**

```javascript
// In the zones section
{scopedZones.length === 0 ? (
  <div className="text-center py-8 text-slate-500">
    No zones assigned to you for this event.
  </div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {scopedZones.map(zone => (
      <ZoneCard 
        key={zone.id}
        zone={zone}
        onClick={() => handleZoneClick(zone)}
        utilization={getZoneUtilization(zone.id)}
      />
    ))}
  </div>
)}
```

### Frontend Changes: SubOrgEntryScannerPage Scope Filtering

**Existing gate selection uses `eventGates` from `currentEvent?.gates`. Add filter:**

```javascript
// Get assigned gates from user, filter to those that exist in current event
const availableGates = useMemo(() => {
  const eventGatesList = currentEvent?.gates || [];
  const userAssignedGates = user?.assignedGates || [];
  
  if (userAssignedGates.length === 0) return eventGatesList;
  // Only show gates that are both in the event AND assigned to user
  return eventGatesList.filter(gate => userAssignedGates.includes(gate));
}, [currentEvent?.gates, user?.assignedGates]);

// If no gates available after filtering, show warning
useEffect(() => {
  if (availableGates.length === 0 && currentEvent) {
    toast.error('No gates assigned to you for this event. Contact your administrator.');
  }
}, [availableGates.length, currentEvent]);
```

**Scope entry logs by assigned gates:**

```javascript
// In refreshLogs - already uses gateName, but we should filter available gates
const refreshLogs = useCallback(async () => {
  if (!selectedEventId || !gateName) return;
  try {
    const response = await getEntryLogs({
      eventId: selectedEventId,
      gateId: gateName,
      limit: 10,
    });
    // ... existing mapping logic
  } catch (err) {
    console.warn('Failed to load entry logs:', err);
  }
}, [selectedEventId, gateName]);
```

### Backend Changes: Scoped Queries

In `backend/src/routes/organiser.js`, add scope filtering for Sub-Org endpoints. The workspace endpoint already uses `requireScopedEvent` but needs additional filtering for zones and team members:

```javascript
// Extend workspace endpoint for Sub-Organiser scope
router.get('/workspace', protect, requireEventAccess, requireScopedEvent, async (req, res, next) => {
  try {
    const eventId = String(req.scopedEvent._id);
    const userRole = normalizeRole(req.user.role);
    const isSubOrgOrBelow = [ROLES.SUB_ORGANISER, ROLES.STAFF, ROLES.VOLUNTEER, ROLES.AUDITOR].includes(userRole);
    
    // Build zone filter for Sub-Organisers and below
    let zoneFilter = {};
    if (isSubOrgOrBelow) {
      const userZones = req.user.assignedZones || [];
      const userGates = req.user.assignedGates || [];
      zoneFilter = {
        $or: [
          { name: { $in: userZones } },
          { id: { $in: userZones } },
          { gates: { $in: userGates } }
        ]
      };
    }
    
    // Fetch zones with scope filter
    const zones = await Event.findById(eventId)
      .select('zones')
      .lean()
      .then(doc => {
        if (!doc?.zones) return [];
        let filtered = doc.zones;
        if (isSubOrgOrBelow) {
          const userZones = req.user.assignedZones || [];
          const userGates = req.user.assignedGates || [];
          filtered = filtered.filter(z => 
            userZones.includes(z.name) || 
            userZones.includes(z.id) ||
            (z.gates && userGates.some(g => z.gates.includes(g)))
          );
        }
        return filtered;
      });
    
    // Apply similar filtering to teamMembers query
    let teamFilter = { event: eventId, isActive: true };
    if (isSubOrgOrBelow) {
      const userZones = req.user.assignedZones || [];
      const userGates = req.user.assignedGates || [];
      teamFilter.$or = [
        { assignedZones: { $in: userZones } },
        { assignedGates: { $in: userGates } },
        { createdBy: req.user._id }
      ];
    }
    
    // ... rest of existing logic
  } catch (err) {
    next(err);
  }
});
```

**Error Handling:**

| Condition | HTTP Status | Response | Log Level |
|-----------|-------------|----------|-----------|
| User has no zones assigned and accesses SubOrgDashboard | 200 | Empty results with zeros | Info |
| Zone filter returns no zones | 200 | Empty zone array, zero stats | Info |
| Database query error during filtering | 500 | `{success: false, message: 'Failed to load scoped data'}` | Error |

---

## 4. Sub-Organiser Zone Management

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/pages/suborg/SubOrgDashboard.jsx` | Modify | Show only assigned zones in zone dropdowns and lists |
| `frontend/src/pages/suborg/SubOrgTeam.jsx` (if exists) | Modify | Pre-populate zone dropdown with assigned zones |
| `frontend/src/pages/suborg/SubOrgTeam.jsx` (if exists) | Modify | Filter team member list by shared zone scope |

### Frontend Changes: Zone Scope in Team Management

```javascript
// Zone dropdown in SubOrgTeam with scope limitation
const availableZones = useMemo(() => {
  if (!workspace?.event?.zones) return [];
  const userZones = user?.assignedZones || [];
  // For Sub-Organisers, only show their assigned zones
  if (userZones.length > 0) {
    return workspace.event.zones.filter(z => userZones.includes(z.name) || userZones.includes(z.id));
  }
  // Main Organiser sees all zones
  return workspace.event.zones;
}, [workspace?.event?.zones, user?.assignedZones, user?.role]);
```

**Team Member List Filtering:**

```javascript
// Filter team members by shared zone scope
const filteredTeamMembers = useMemo(() => {
  if (!teamMembers || teamMembers.length === 0) return [];
  if (['MainOrganiser', 'MainAdmin'].includes(user?.role)) return teamMembers;
  
  const userZones = user?.assignedZones || [];
  const userGates = user?.assignedGates || [];
  
  return teamMembers.filter(member => {
    const memberZones = member.assignedZones || [];
    const memberGates = member.assignedGates || [];
    // Show if they share at least one zone or gate
    return memberZones.some(z => userZones.includes(z)) ||
           memberGates.some(g => userGates.includes(g)) ||
           // Also show if this user created them
           String(member.createdBy) === String(user?._id);
  });
}, [teamMembers, user]);
```

---

## Validation Rules Summary

| Field | Required | Type | Limits | Behavior on Failure |
|-------|----------|------|--------|---------------------|
| Gate name | Yes (when added) | String | 1-50 chars, alphanumeric + spaces | Show inline error, prevent save |
| Gate array | No | Array | Max 100 gates | Truncate to 100, warn |
| Assigned zones | No | Array | Must be subset of event zones | Backend 403, clear invalid |
| Assigned gates | No | Array | Must be subset of event gates | Backend 403, clear invalid |
| Operation scope | Yes | Enum | 'entry', 'zone', 'both' | Default to 'entry' |
| Permission booleans | No | Boolean | Must be true/false | Default to false |

---

## Testability

### Unit Test Candidates

1. **Gate duplicate detection:** Test that `handleAddGate` prevents duplicate names case-insensitively
2. **Gate removal index safety:** Test that removing an out-of-bounds index is a no-op
3. **Scope filtering logic:** Test `scopedZones` filter with various assignedZones inputs
4. **Team member scope validation:** Test that Sub-Organiser cannot assign unauthorized zones
5. **Capability toggle state:** Test that permission toggles correctly update `subOrgForm.permissions`

### Integration Test Candidates

1. **Full gate CRUD flow:** Add gate -> save -> reload -> verify gate persists -> remove gate -> save -> verify removed
2. **Sub-Organiser zone assignment:** Create Sub-Organiser with restricted zones -> verify they only see those zones
3. **Entry logs filtering:** Staff with assignedGates=['Main Gate'] should only see logs from Main Gate
4. **Capability sync:** Update team member capabilities -> verify backend stores correctly -> reload -> verify read back

### Test Files to Create

| File | Coverage |
|------|----------|
| `frontend/src/pages/organiser/__tests__/OrganiserDashboard.gates.test.jsx` | Gate add/remove/rename operations |
| `frontend/src/pages/suborg/__tests__/SubOrgDashboard.scope.test.jsx` | Zone and gate scope filtering |
| `backend/src/routes/__tests__/organiser.capabilities.test.js` | Capability validation endpoints |

---

## Out of Scope Items (Preserved from Requirements)

- Changes to the main RBAC role hierarchy or role levels (OS-1)
- New roles beyond existing seven (OS-2)
- Time-based access restrictions (OS-3)
- Audit logging for capability changes (OS-4)
- Bulk capability assignment (OS-5)
- External identity provider integration (OS-6)
- Main Admin role capability changes (OS-7)

---

## Responses to Design Review Findings

*No design review exists yet. This is the initial design submission.*