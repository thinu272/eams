import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const PermissionGuard = ({ 
  children, 
  permission, 
  permissions = [], 
  requireAll = false, 
  fallback = null,
  role = null 
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, role: userRole } = usePermissions();

  // Check role-based access
  if (role && userRole !== role) {
    return fallback;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  // Check multiple permissions
  if (permissions.length > 0) {
    const hasAccess = requireAll 
      ? hasAllPermissions(permissions) 
      : hasAnyPermission(permissions);
    
    if (!hasAccess) {
      return fallback;
    }
  }

  return children;
};

export const withPermission = (Component, permission, options = {}) => {
  return (props) => (
    <PermissionGuard 
      permission={permission} 
      {...options}
      fallback={options.fallback || <div>Access Denied</div>}
    >
      <Component {...props} />
    </PermissionGuard>
  );
};

export const withRole = (Component, role, options = {}) => {
  return (props) => (
    <PermissionGuard 
      role={role} 
      {...options}
      fallback={options.fallback || <div>Access Denied</div>}
    >
      <Component {...props} />
    </PermissionGuard>
  );
};

export default PermissionGuard;
