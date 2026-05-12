# Maintenance Mode System Implementation

## Overview
I've implemented a complete maintenance mode system for EAMS that allows admins to put the website into maintenance mode from the admin dashboard's system settings.

## How It Works

### For Admins
1. Go to Admin Dashboard → Settings → General Settings
2. Change "System Status" from "Active" to "Maintenance"
3. Click "Save Settings"
4. The entire website immediately switches to maintenance mode for regular users
5. Admins and staff can still access the site normally

### For Regular Users
- When maintenance mode is active, they see a professional maintenance page
- They cannot access any features except the login page
- The change happens in **real-time** without page refresh (via WebSocket)

### Key Features
✅ **Real-time Updates** - Uses WebSocket to broadcast maintenance mode changes to all connected clients
✅ **Admin Bypass** - Admins, organizers, and staff can continue working during maintenance
✅ **API Protection** - Returns 503 Service Unavailable for API requests during maintenance
✅ **Automatic Enforcement** - Middleware automatically checks system status on every request
✅ **Graceful Fallback** - If WebSocket fails, system falls back to REST API polling

## Implementation Details

### Backend Components

1. **Maintenance Middleware** (`backend/src/middleware/maintenanceMode.js`)
   - Checks system status on every request
   - Returns 503 if maintenance mode is active
   - Bypasses check for admin users and auth endpoints

2. **Public Config Endpoint** (`backend/src/routes/events.js`)
   - Exposes `maintenanceMode` status
   - Used by frontend to check system status

3. **Settings Update** (`backend/src/routes/superAdmin.js`)
   - Broadcasts `system:maintenance-mode-changed` event via WebSocket
   - Allows instant updates across all browsers

### Frontend Components

1. **MaintenanceModeContext** (`frontend/src/context/MaintenanceModeContext.jsx`)
   - Global state management for maintenance mode
   - WebSocket listener for real-time updates
   - `useMaintenanceMode()` hook for accessing state

2. **App Integration** (`frontend/src/App.jsx`)
   - Shows MaintenancePage when maintenance mode is active
   - Allows authenticated users to bypass maintenance

3. **Maintenance Page** (`frontend/src/pages/public/MaintenancePage.jsx`)
   - Professional UI showing system is under maintenance
   - Animated status indicator

## Testing the Feature

### Test Case 1: Enable Maintenance Mode
1. Open two browser windows with the website
2. In one window, go to Admin Dashboard → Settings → General Settings
3. Change "System Status" to "Maintenance"
4. In the other window (refresh not needed), you should see the maintenance page appear

### Test Case 2: Admin Bypass
1. Enable maintenance mode
2. Try accessing admin dashboard - should work fine
3. Organizers and staff also have access

### Test Case 3: API Testing
```bash
# This will return 503 Service Unavailable
curl http://localhost:5000/api/events

# Public config still works
curl http://localhost:5000/api/events/config/public
# Returns: { maintenanceMode: true, systemStatus: "Maintenance", ... }
```

## Files Modified

### Created:
- `backend/src/middleware/maintenanceMode.js` - Maintenance mode enforcement
- `frontend/src/context/MaintenanceModeContext.jsx` - Real-time state management

### Modified:
- `backend/src/server.js` - Added middleware
- `backend/src/routes/events.js` - Updated public config endpoint
- `backend/src/routes/superAdmin.js` - Added WebSocket broadcast
- `frontend/src/App.jsx` - Integrated MaintenanceMode context
- `frontend/src/index.js` - Wrapped app with provider

## Admin Settings UI

In the Admin Dashboard Settings → General Settings tab:

```
System Status
├─ Active (Default)
└─ Maintenance

[Save Settings] button
```

When changed to "Maintenance":
- All users (except admins) see the maintenance page
- API returns 503 errors
- WebSocket broadcasts the change in real-time

When changed back to "Active":
- Website resumes normal operation
- Users can access all features again

## How the System Integrates with Existing Code

The maintenance mode system:
1. **Respects existing authentication** - Uses the same `protect` and `checkRole` middleware
2. **Integrates with SystemConfig** - Uses the existing `general.systemStatus` field
3. **Works with existing WebSocket setup** - Broadcasts via the already-configured Socket.IO instance
4. **Doesn't break existing features** - Authenticated admins can still use all functions
5. **Maintains audit trail** - Settings changes are logged in AuditLog

## Summary

The maintenance mode system is now fully implemented and ready to use. Admins can:
- **Activate maintenance mode** to temporarily disable access for regular users
- **Keep working** while the site is in maintenance - they have full access
- **See real-time updates** across all connected browsers
- **Easily deactivate** when maintenance is complete

Regular users will see a professional maintenance page with no disruption to admin operations.
