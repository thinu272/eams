import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasRolePower, getCanonicalRole } from '../utils/rbac';

export const usePermissions = () => {
  const { user } = useAuth();
  const canonicalRole = getCanonicalRole(user?.role);

  const permissions = useMemo(() => ({
    // Basic permissions
    canViewDashboard: hasRolePower(user?.role, 'Attendee'),
    canViewOwnProfile: true, // All users can view their own profile
    
    // Event permissions
    canViewEvents: hasRolePower(user?.role, 'Attendee'),
    canCreateEvents: hasRolePower(user?.role, 'MainOrganiser'),
    canEditEvents: hasRolePower(user?.role, 'MainOrganiser'),
    canDeleteEvents: hasRolePower(user?.role, 'MainAdmin'),
    
    // Attendee permissions
    canViewAttendees: hasRolePower(user?.role, 'SubOrganiser'),
    canEditAttendees: hasRolePower(user?.role, 'MainOrganiser'),
    canDeleteAttendees: hasRolePower(user?.role, 'MainAdmin'),
    canInviteAttendees: hasRolePower(user?.role, 'MainOrganiser'),
    canBulkUpload: hasRolePower(user?.role, 'SubOrganiser'),
    
    // Ticket permissions
    canViewTickets: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    canCreateTickets: hasRolePower(user?.role, 'MainOrganiser'),
    canEditTickets: hasRolePower(user?.role, 'MainOrganiser'),
    canDeleteTickets: hasRolePower(user?.role, 'MainAdmin'),
    canScanTickets: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    
    // Verification permissions
    canViewVerifications: hasRolePower(user?.role, 'SubOrganiser'),
    canVerifyPhotos: hasRolePower(user?.role, 'SubOrganiser'),
    canApproveVerifications: hasRolePower(user?.role, 'MainOrganiser'),
    canRejectVerifications: hasRolePower(user?.role, 'SubOrganiser'),
    
    // Zone permissions
    canViewZones: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    canManageZones: hasRolePower(user?.role, 'SubOrganiser'),
    canCreateZones: hasRolePower(user?.role, 'MainOrganiser'),
    canEditZones: hasRolePower(user?.role, 'SubOrganiser'),
    canDeleteZones: hasRolePower(user?.role, 'MainAdmin'),
    
    // Scanning permissions
    canScanEntry: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    canScanZones: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    canManualSearch: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    
    // Reports permissions
    canViewReports: hasRolePower(user?.role, 'Auditor'),
    canExportReports: hasRolePower(user?.role, 'Auditor'),
    canGenerateReports: hasRolePower(user?.role, 'MainOrganiser'),
    
    // User management permissions
    canViewUsers: hasRolePower(user?.role, 'MainOrganiser'),
    canCreateUsers: hasRolePower(user?.role, 'MainAdmin'),
    canEditUsers: hasRolePower(user?.role, 'MainAdmin'),
    canDeleteUsers: hasRolePower(user?.role, 'MainAdmin'),
    canAssignRoles: hasRolePower(user?.role, 'MainAdmin'),
    
    // Organiser permissions
    canViewOrganisers: hasRolePower(user?.role, 'MainAdmin'),
    canCreateOrganisers: hasRolePower(user?.role, 'MainAdmin'),
    canEditOrganisers: hasRolePower(user?.role, 'MainAdmin'),
    canDeleteOrganisers: hasRolePower(user?.role, 'MainAdmin'),
    
    // System permissions
    canViewSystemLogs: hasRolePower(user?.role, 'MainAdmin'),
    canManageSettings: hasRolePower(user?.role, 'MainAdmin'),
    canViewSystemHealth: hasRolePower(user?.role, 'MainAdmin'),
    canManageNotifications: hasRolePower(user?.role, 'MainOrganiser'),
    
    // Activity permissions
    canViewActivityLogs: hasRolePower(user?.role, 'SubOrganiser'),
    canViewEntryLogs: hasRolePower(user?.role, 'Staff') || canonicalRole === 'Volunteer',
    canViewZoneActivity: hasRolePower(user?.role, 'SubOrganiser'),
    
    // Financial permissions
    canViewRevenue: hasRolePower(user?.role, 'MainOrganiser'),
    canViewOrders: hasRolePower(user?.role, 'MainOrganiser'),
    canProcessRefunds: hasRolePower(user?.role, 'MainAdmin'),
    
    // Communication permissions
    canSendNotifications: hasRolePower(user?.role, 'MainOrganiser'),
    canSendEmails: hasRolePower(user?.role, 'MainOrganiser'),
    canSendSMS: hasRolePower(user?.role, 'MainOrganiser'),
  }), [user?.role]);

  const hasPermission = (permission) => {
    return permissions[permission] || false;
  };

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => permissions[permission] || false);
  };

  const hasAllPermissions = (permissionList) => {
    return permissionList.every(permission => permissions[permission] || false);
  };

  const canAccessRoute = (route) => {
    // Route-based permission checking
    const routePermissions = {
      '/admin/dashboard': ['canViewDashboard'],
      '/organiser/dashboard': ['canViewDashboard'],
      '/suborg/dashboard': ['canViewDashboard'],
      '/staff/scan': ['canScanEntry'],
      '/auditor/dashboard': ['canViewReports'],
      '/events': ['canViewEvents'],
      '/events/create': ['canCreateEvents'],
      '/attendees': ['canViewAttendees'],
      '/verification': ['canViewVerifications'],
      '/zones': ['canViewZones'],
      '/reports': ['canViewReports'],
      '/users': ['canViewUsers'],
      '/settings': ['canManageSettings'],
    };

    const requiredPermissions = routePermissions[route];
    if (!requiredPermissions) return true; // Default to allowed if no specific permissions required
    
    return hasAllPermissions(requiredPermissions);
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessRoute,
    role: canonicalRole,
    isAdmin: canonicalRole === 'MainAdmin',
    isOrganiser: ['MainOrganiser', 'SubOrganiser'].includes(canonicalRole),
    isStaff: ['Staff', 'Volunteer'].includes(canonicalRole),
    isAuditor: canonicalRole === 'Auditor',
    isAttendee: canonicalRole === 'Attendee',
  };
};

export default usePermissions;
