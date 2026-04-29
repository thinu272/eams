# User Dashboard with Role-Based Access Control

This guide explains the comprehensive user dashboard system with role-based permissions and access control implemented for the EAMS (Event Access Management System).

## Overview

The enhanced user dashboard provides a role-aware interface that adapts to the user's permissions and displays relevant functionality based on their assigned role. The system includes:

- **Role-based navigation** that shows only accessible menu items
- **Permission-gated components** that hide/restrict functionality
- **Dynamic content loading** based on user role and assigned events/zones
- **Real-time activity feeds** and notifications
- **Responsive metrics** and analytics tailored to each role

## Architecture

### Frontend Components

#### 1. UserDashboard Component
**Location**: `frontend/src/components/dashboard/UserDashboard.jsx`

Main dashboard component that:
- Renders role-specific sections and metrics
- Handles navigation between different dashboard areas
- Displays permission-gated actions and quick actions
- Shows recent activity and notifications

#### 2. Permission Hook
**Location**: `frontend/src/hooks/usePermissions.js`

Custom React hook that provides:
- Permission checking functions (`hasPermission`, `hasAnyPermission`, `hasAllPermissions`)
- Route access validation (`canAccessRoute`)
- Role-based boolean flags (`isAdmin`, `isOrganiser`, `isStaff`, etc.)

#### 3. Permission Guard Component
**Location**: `frontend/src/components/auth/PermissionGuard.jsx`

Higher-order component that:
- Wraps components with permission checks
- Shows fallback content for unauthorized access
- Provides HOCs for component-level permission wrapping

#### 4. Role-Based Navigation
**Location**: `frontend/src/components/dashboard/RoleBasedNavigation.jsx`

Navigation component that:
- Filters menu items based on user permissions
- Highlights active routes
- Shows role-appropriate quick actions
- Displays notification badges

#### 5. Enhanced Dashboard Page
**Location**: `frontend/src/pages/enhanced/UserDashboardPage.jsx`

Page wrapper that:
- Handles authentication and routing
- Loads dashboard data from API
- Manages error states and loading
- Provides role-specific header and layout

### Backend Components

#### 1. Role-Based Dashboard Controller
**Location**: `backend/src/controllers/roleBasedDashboardController.js`

Controller that:
- Generates role-specific dashboard data
- Aggregates metrics and analytics
- Provides activity feeds and notifications
- Handles permission-based data filtering

#### 2. Role-Based Dashboard Routes
**Location**: `backend/src/routes/roleBasedDashboard.js`

API endpoints that provide:
- `/api/dashboard/role-based` - Main dashboard data
- `/api/dashboard/role-based/metrics` - Role-specific metrics
- `/api/dashboard/role-based/activity` - Activity feed
- `/api/dashboard/role-based/notifications` - Notifications

## Role-Based Features

### MainAdmin (Super Admin)
- **System Overview**: Total events, users, revenue, system health
- **User Management**: Create, edit, delete users across all roles
- **Event Management**: Full control over all events
- **System Settings**: Configure global settings and features
- **Reports**: Access to all system-wide reports and analytics
- **Audit Logs**: View system activity and audit trails

### MainOrganiser (Event Organizer)
- **Event Dashboard**: Overview of assigned events and metrics
- **Attendee Management**: Manage attendees for assigned events
- **Team Management**: Manage sub-organisers and staff
- **Verification**: Review and approve photo verifications
- **Reports**: Event-specific reports and analytics
- **Notifications**: Send communications to attendees

### SubOrganiser (Zone Manager)
- **Zone Management**: Monitor and manage assigned zones
- **Staff Coordination**: Oversee staff in assigned areas
- **Entry Monitoring**: Real-time entry and zone activity
- **Bulk Operations**: Upload attendees, manage invitations
- **Local Reports**: Zone-specific analytics and metrics

### Staff/Volunteer (Operations)
- **Entry Scanner**: Scan tickets and manage event entry
- **Zone Scanner**: Monitor zone access and capacity
- **Manual Search**: Look up attendee information
- **Activity Log**: Track personal scanning activity
- **Quick Actions**: Fast access to scanning functions

### Auditor (Compliance)
- **Audit Dashboard**: Overview of system compliance
- **Verification Reports**: Photo verification statistics
- **Access Analytics**: Entry and zone access patterns
- **Audit Logs**: Detailed audit trail review
- **Export Data**: Generate compliance reports

### Attendee (End User)
- **My Tickets**: View active and past tickets
- **Event Information**: Access event details and updates
- **Profile Management**: Update personal information
- **Order History**: View purchase history and receipts
- **Notifications**: Receive event-related updates

## Permission System

### Permission Categories

#### Basic Permissions
- `canViewDashboard` - Access to dashboard interface
- `canViewOwnProfile` - View and edit own profile

#### Event Permissions
- `canViewEvents` - View event listings
- `canCreateEvents` - Create new events
- `canEditEvents` - Modify event details
- `canDeleteEvents` - Remove events

#### Attendee Permissions
- `canViewAttendees` - View attendee lists
- `canEditAttendees` - Modify attendee information
- `canDeleteAttendees` - Remove attendees
- `canInviteAttendees` - Send event invitations
- `canBulkUpload` - Upload multiple attendees

#### Verification Permissions
- `canViewVerifications` - View verification queue
- `canVerifyPhotos` - Review photo submissions
- `canApproveVerifications` - Approve verified attendees
- `canRejectVerifications` - Reject submissions

#### Zone Permissions
- `canViewZones` - View zone information
- `canManageZones` - Modify zone settings
- `canCreateZones` - Create new zones
- `canEditZones` - Update zone configurations

#### Scanning Permissions
- `canScanEntry` - Scan event tickets
- `canScanZones` - Monitor zone access
- `canManualSearch` - Search attendee database

#### Reports Permissions
- `canViewReports` - Access report dashboards
- `canExportReports` - Download data exports
- `canGenerateReports` - Create new reports

### Permission Implementation

#### Using the Permission Hook
```jsx
import { usePermissions } from '../hooks/usePermissions';

function MyComponent() {
  const { hasPermission, canAccessRoute } = usePermissions();
  
  if (!hasPermission('canViewAttendees')) {
    return <div>Access Denied</div>;
  }
  
  return <div>Attendee Management</div>;
}
```

#### Using Permission Guard
```jsx
import PermissionGuard from '../components/auth/PermissionGuard';

function ProtectedComponent() {
  return (
    <PermissionGuard permission="canViewReports">
      <ReportsDashboard />
    </PermissionGuard>
  );
}
```

#### Higher-Order Components
```jsx
import { withPermission } from '../components/auth/PermissionGuard';

const AdminOnlyComponent = withPermission(
  AdminPanel,
  'canManageSettings',
  { fallback: <div>Admin access required</div> }
);
```

## API Integration

### Dashboard Data Endpoints

#### Get Role-Based Dashboard Data
```javascript
GET /api/dashboard/role-based
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "overview": { ... },
    "charts": { ... },
    "recentActivity": [ ... ],
    "permissions": { ... }
  },
  "role": "MainOrganiser"
}
```

#### Get Role-Specific Metrics
```javascript
GET /api/dashboard/role-based/metrics
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "totalEvents": 5,
    "totalAttendees": 1250,
    "totalRevenue": 75000,
    "activeEvents": 2,
    "todayCheckIns": 89,
    "pendingVerifications": 12
  }
}
```

#### Get Activity Feed
```javascript
GET /api/dashboard/role-based/activity?limit=20&type=scan
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": {
    "activity": [
      {
        "id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "type": "scan",
        "title": "CHECK-IN",
        "description": "John Doe - Tech Conference 2024",
        "time": "2024-01-15T10:30:00Z",
        "details": { ... }
      }
    ]
  }
}
```

## Usage Examples

### Creating a Role-Specific Component
```jsx
import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import PermissionGuard from '../auth/PermissionGuard';

const EventManagementPanel = () => {
  const { permissions, isOrganiser, isAdmin } = usePermissions();
  
  return (
    <div className="event-management-panel">
      {/* Show to all organisers and admins */}
      <PermissionGuard permission="canViewEvents">
        <EventList />
      </PermissionGuard>
      
      {/* Show only to main organisers and admins */}
      <PermissionGuard permissions={['canCreateEvents', 'canEditEvents']}>
        <EventCreationForm />
      </PermissionGuard>
      
      {/* Show only to admins */}
      <PermissionGuard permission="canDeleteEvents">
        <EventDeletionTools />
      </PermissionGuard>
    </div>
  );
};
```

### Conditional Navigation Items
```jsx
const navigationItems = [
  { to: '/dashboard', label: 'Overview', permission: 'canViewDashboard' },
  { to: '/events', label: 'Events', permission: 'canViewEvents' },
  { to: '/attendees', label: 'Attendees', permission: 'canViewAttendees' },
  { to: '/verification', label: 'Verification', permission: 'canViewVerifications' },
  { to: '/reports', label: 'Reports', permission: 'canViewReports' },
  { to: '/settings', label: 'Settings', permission: 'canManageSettings' }
].filter(item => hasPermission(item.permission));
```

### Route Protection
```jsx
// In your routing configuration
<Route 
  path="/admin/settings" 
  element={
    <ProtectedRoute>
      <PermissionGuard permission="canManageSettings">
        <AdminSettings />
      </PermissionGuard>
    </ProtectedRoute>
  } 
/>
```

## Customization and Extension

### Adding New Permissions

1. **Update Permission Hook** (`frontend/src/hooks/usePermissions.js`):
```javascript
// Add new permission to the permissions object
const permissions = useMemo(() => ({
  // ... existing permissions
  canManageCustomFeature: hasRolePower(user?.role, 'MainOrganiser'),
}), [user?.role]);
```

2. **Update Backend Controller** (`backend/src/controllers/roleBasedDashboardController.js`):
```javascript
// Add role-specific data for the new permission
const getOrganiserDashboardData = async (user) => {
  // ... existing code
  return {
    // ... existing data
    customFeatureData: await getCustomFeatureData(user),
    permissions: {
      // ... existing permissions
      canManageCustomFeature: true
    }
  };
};
```

3. **Update Role Navigation** (`frontend/src/config/roleNavigation.js`):
```javascript
export const ROLE_NAVIGATION = {
  MainOrganiser: {
    sections: [
      {
        title: 'Event Control',
        items: [
          // ... existing items
          { to: '/organiser/custom-feature', label: 'Custom Feature', icon: CustomIcon },
        ],
      },
    ],
  },
};
```

### Adding New Roles

1. **Update RBAC Utils** (`frontend/src/utils/rbac.js`):
```javascript
export const ROLES = {
  // ... existing roles
  CUSTOM_ROLE: 'CustomRole',
};

const ROLE_LEVELS = {
  // ... existing levels
  [ROLES.CUSTOM_ROLE]: 50,
};
```

2. **Update Role Navigation**:
```javascript
export const ROLE_NAVIGATION = {
  CustomRole: {
    sections: [
      {
        title: 'Custom Role',
        items: [
          { to: '/custom/dashboard', label: 'Dashboard', icon: HomeIcon },
        ],
      },
    ],
  },
};
```

3. **Update Backend Controller**:
```javascript
const getRoleBasedDashboardData = async (req, res, next) => {
  // ... existing code
  switch (role) {
    // ... existing cases
    case 'customrole':
      dashboardData = await getCustomRoleDashboardData(user);
      break;
  }
};
```

## Security Considerations

1. **Frontend Security**: Always verify permissions on the frontend to provide good UX, but never rely on it for security.

2. **Backend Validation**: All API endpoints must validate user permissions before returning data or allowing actions.

3. **Role Hierarchy**: Ensure role levels properly reflect the permission hierarchy in your organization.

4. **Data Filtering**: Always filter data based on user's assigned events, zones, and organizational scope.

5. **Audit Trail**: Log all permission checks and access attempts for security auditing.

## Testing

### Unit Testing Permissions
```javascript
import { renderHook } from '@testing-library/react';
import { usePermissions } from '../hooks/usePermissions';

describe('usePermissions', () => {
  it('should return correct permissions for admin role', () => {
    const { result } = renderHook(() => usePermissions(), {
      wrapper: ({ children }) => (
        <AuthProvider user={{ role: 'MainAdmin' }}>
          {children}
        </AuthProvider>
      )
    });
    
    expect(result.current.hasPermission('canManageSettings')).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });
});
```

### Integration Testing Dashboard
```javascript
import { render, screen } from '@testing-library/react';
import UserDashboard from '../components/dashboard/UserDashboard';

describe('UserDashboard', () => {
  it('should show admin features for admin users', async () => {
    render(
      <AuthProvider user={{ role: 'MainAdmin' }}>
        <UserDashboard />
      </AuthProvider>
    );
    
    expect(screen.getByText('System Settings')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });
  
  it('should hide admin features for regular users', async () => {
    render(
      <AuthProvider user={{ role: 'Attendee' }}>
        <UserDashboard />
      </AuthProvider>
    );
    
    expect(screen.queryByText('System Settings')).not.toBeInTheDocument();
    expect(screen.getByText('My Tickets')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **Permission Not Working**: Check that the permission is defined in both frontend hook and backend controller.

2. **Route Access Denied**: Verify the route protection and permission guard are properly configured.

3. **Missing Dashboard Data**: Ensure the backend controller handles the user's role correctly.

4. **Navigation Items Missing**: Check the role navigation configuration and permission filtering.

### Debug Tips

1. **Console Log User Role**: `console.log('User role:', user?.role);`

2. **Check Permission Hook**: `console.log('Permissions:', permissions);`

3. **Verify API Response**: Check network tab for dashboard API responses.

4. **Test Different Roles**: Use different user accounts to test role-specific functionality.

## Best Practices

1. **Consistent Naming**: Use consistent permission names across frontend and backend.

2. **Granular Permissions**: Create fine-grained permissions rather than broad ones.

3. **Default Deny**: Default to denying access unless explicitly permitted.

4. **Role-Based UI**: Design UI that naturally reflects the user's role and responsibilities.

5. **Performance**: Cache permission checks and minimize API calls for permission data.

6. **Documentation**: Keep permission documentation updated with new features and roles.

This comprehensive dashboard system provides a solid foundation for role-based access control in the EAMS application, ensuring users see only the functionality they're authorized to access while maintaining a clean and intuitive user experience.
