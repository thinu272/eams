# Requirements Document: Team Member Capabilities & Event-Scoped Data Access

**Version:** 1.0
**Date:** 2026-10-06
**Status:** Draft

---

## Summary

This document outlines requirements for:
1. Fixing existing bugs in the gates functionality (both frontend and backend)
2. Implementing proper capabilities-based access control for team members
3. Ensuring team members see only event-specific data aligned with their assigned zones, checkpoints, and categories

**Assumptions:**
- The RBAC system (backend/src/utils/rbac.js) and frontend rbac.js are the canonical source for role definitions
- Event selection is managed via `lastSelectedEventId` in localStorage and the `entrynex:event-select` event
- Team members include: MainOrganiser, SubOrganiser, Staff, Volunteer, Auditor
- Checkpoints = Gates in the current codebase terminology
- Capabilities are stored on the user object as `permissions`, `assignedZones`, `assignedGates`, `assignedCategories`

---

## Functional Requirements

### 1. Gates Functionality (Bug Fix)

**Current Issue:** Console logs indicate state inconsistency where `eventGates` state does not properly persist across workspace reloads, and duplicate gate entries may occur.

**FR-1.1:** The `eventGates` state in OrganiserDashboard.jsx must persist correctly when the workspace is soft-reloaded during customization mode.

**FR-1.2:** Adding a gate must use a unique identifier, not just the gate name, to prevent duplicates when multiple gates share a name like "Gate A".

**FR-1.3:** Removing a gate must immediately reflect in both the UI and the backend, without requiring a full page reload.

**FR-1.4:** The PUT `/api/organiser/event-customization` endpoint must validate that gate names are unique per event and reject duplicate gate names with a clear error message.

**FR-1.5:** The `gatesDirtyRef` must correctly track unsaved changes to prevent silent data loss when workspace reloads occur.

---

### 2. Team Member Capabilities Management

**Current Issue:** The "Capabilities Actions this member can perform" section exists but may not properly sync with backend permissions or enforce access control.

**FR-2.1:** The Main Organiser must be able to view, create, and modify capabilities for each team member, including:
- `canAddAttendees` - Add attendees manually
- `canVerifyPhotos` - Approve/reject attendee photos
- `canInviteAttendees` - Send invitations
- `canBulkUpload` - Upload attendees via CSV
- `canEntryAccess` - Perform entry/exit operations
- `canCollectCash` - Accept cash payments

**FR-2.2:** The `operationScope` field for Staff/Volunteer must determine visibility scope:
- `entry` - Can only access assigned gates/checkpoints
- `zone` - Can only access assigned zones
- `both` - Can access both assigned gates and zones

**FR-2.3:** Assigned Zones, Assigned Gates, and Assigned Categories must be selectable multi-select fields when editing team members.

**FR-2.4:** When a Sub-Organiser creates a team member, their assigned zones/gates/categories must be a subset of what they themselves are assigned (scoping enforcement).

**FR-2.5:** The backend must validate capability assignments and reject unauthorized assignments with appropriate error messages.

---

### 3. Event-Scoped Data Visibility for Team Members

**Current Issue:** Team members (especially Sub-Organisers and Staff) may see data from all events rather than only their assigned event scope.

**FR-3.1:** Sub-Organisers must only see data (zones, checkpoints, team members, attendees, tickets) for events they are assigned to via `assignedEvents`.

**FR-3.2:** Staff and Volunteers must only see:
- Zones listed in their `assignedZones` array
- Gates listed in their `assignedGates` array
- Categories listed in their `assignedCategories` array

**FR-3.3:** The SubOrgDashboard must filter all displayed data (stats, tickets, attendees, zones) based on the logged-in user's event assignments and zone/gate scope.

**FR-3.4:** The SubOrgEntryScannerPage must only show entry logs and operations for the user's assigned gates/zones.

**FR-3.5:** Zone checkpoints in SubOrgDashboard must display only the zones the user is assigned to manage.

**FR-3.6:** The SubOrgTeam page must filter the team member list to show only team members who are also scoped to the same event and zones.

---

### 4. Sub-Organiser Zone Management

**Current Issue:** Sub-Organisers may not be able to properly view or manage their assigned zones.

**FR-4.1:** The SubOrgDashboard must fetch and display only zones where the user's ID or name appears in the zone's assignment list.

**FR-4.2:** Sub-Organisers with zone scope must be able to view zone utilization and checkpoint activity only for their assigned zones.

**FR-4.3:** The zone selection dropdown in SubOrgTeam must be pre-populated with only the zones the current user can assign (their own assigned zones).

---

## Non-Functional Requirements

**NFR-1:** All capability and scope filtering must be enforced on both frontend (for UX) and backend (for security).

**NFR-2:** Error messages for unauthorized access must be clear and indicate what capability or scope is missing.

**NFR-3:** Performance impact of scope filtering must be minimal; use efficient database queries with proper indexing on `assignedZones` and `assignedGates` fields.

**NFR-4:** All new filtering logic must include unit tests for boundary conditions (empty arrays, null values, mixed ID/name formats).

---

## Acceptance Criteria

### Gates Bug Fix

**AC-1.1:** When a user adds "Gate A", saves, then adds another "Gate A", the system rejects the second addition with error "Gate name 'Gate A' already exists for this event".

**AC-1.2:** Opening the customization tab, adding gates, then triggering a soft workspace reload preserves all gate additions without data loss.

**AC-1.3:** Removing a gate at index 0 from a list of ['Gate A', 'Gate B', 'Gate C'] results in ['Gate B', 'Gate C'], not ['Gate A', 'Gate C'].

**AC-1.4:** Console shows no duplicate gate entries or state inconsistencies during add/remove operations.

---

### Team Member Capabilities

**AC-2.1:** When editing a Staff member, the Capabilities panel shows all 6 permission toggles with their current values.

**AC-2.2:** Changing a Staff member's operationScope from 'entry' to 'zone' hides the Assigned Gates field and shows the Assigned Zones field.

**AC-2.3:** Creating a Staff member while logged in as a Sub-Organiser with only 'Zone A' assigned prevents selecting 'Zone B' in the Assigned Zones dropdown.

**AC-2.4:** Saving a team member with updated capabilities persists to the backend and reflects immediately on the frontend without page reload.

---

### Event-Scoped Data Visibility

**AC-3.1:** A Sub-Organiser assigned only to Event X cannot see any attendees, tickets, or zones from Event Y.

**AC-3.2:** A Staff member with assignedZones=['Zone A'] and assignedGates=['Main Gate'] sees only Zone A in all zone-related dropdowns and lists.

**AC-3.3:** The SubOrgDashboard stats cards show zeros or empty states for all data categories when the user has no assignments for the selected event.

**AC-3.4:** The entry scanner page for a Staff member only shows logs from their assigned gates/zones.

**AC-3.5:** The SubOrgTeam page shows only team members who share at least one assigned zone with the current user.

---

### Sub-Organiser Zone Management

**AC-4.1:** Sub-Organiser with assignedZones=['VIP Area', 'Backstage'] sees only these two zones in the SubOrgDashboard zone list.

**AC-4.2:** Clicking on a zone card for an assigned zone shows utilization data specific to that zone.

**AC-4.3:** The zone dropdown in SubOrgTeam shows only assigned zones, preventing assignment to unauthorized zones.

---

## Out of Scope

The following are explicitly NOT in scope for this iteration:

- **OS-1:** Changes to the main RBAC role hierarchy or role levels
- **OS-2:** Adding new roles beyond the existing seven roles (MainAdmin, MainOrganiser, SubOrganiser, Staff, Volunteer, Auditor, Attendee)
- **OS-3:** Implementing time-based access restrictions (e.g., "can only access zone between 9 AM and 5 PM")
- **OS-4:** Audit logging for capability changes (may be added in a future release)
- **OS-5:** Bulk capability assignment to multiple team members at once
- **OS-6:** Integration with external identity providers (SSO, SAML)
- **OS-7:** Changes to the Main Admin role capabilities (only Main Organiser scope is addressed)

---

## Assumptions & Open Questions

| ID | Assumption | Impact if Incorrect |
|----|------------|---------------------|
| A1 | `assignedZones` and `assignedGates` are stored as arrays of strings (IDs or names) on the user document | May require migration if stored as ObjectId references |
| A2 | Zone IDs are consistent between frontend (selectedEvent.zones) and backend (user.assignedZones) | Could cause mismatches in zone filtering |
| A3 | The `getSubOrgTeam` API already filters by event; only additional zone filtering is needed | If full filtering is missing, backend changes are required |
| A4 | Gates are stored in the event customization object, not in a separate collection | Would require schema changes if incorrect |

**Open Questions:**
1. Should Main Organisers be able to override zone scope limitations?
2. What happens when a zone is deleted—should assigned staff be notified or reassigned?
3. Is there a maximum limit on the number of assignable zones/gates per team member?