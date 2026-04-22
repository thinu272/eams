import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_NAVIGATION, ROLE_LABELS } from '../../config/roleNavigation';
import { 
  HomeIcon, 
  TicketIcon, 
  UsersIcon, 
  MagnifyingGlassIcon, 
  ShieldCheckIcon, 
  ChartBarIcon, 
  UserGroupIcon, 
  ClipboardDocumentListIcon, 
  GlobeAltIcon, 
  ArrowLeftOnRectangleIcon, 
  ArrowUpTrayIcon, 
  CheckBadgeIcon, 
  SignalIcon,
  CogIcon,
  BellIcon
} from '@heroicons/react/24/outline';

const RoleBasedNavigation = ({ className = '' }) => {
  const { role, permissions } = usePermissions();
  const location = useLocation();
  
  const navigationConfig = ROLE_NAVIGATION[role] || { sections: [] };

  const isActiveRoute = (path) => {
    if (path === location.pathname) return true;
    if (path.includes('?')) {
      const basePath = path.split('?')[0];
      return location.pathname.startsWith(basePath);
    }
    return false;
  };

  const NavItem = ({ to, label, icon: Icon, disabled = false, badge = null }) => {
    const active = isActiveRoute(to);
    
    if (disabled) {
      return (
        <div className="flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg text-slate-400 cursor-not-allowed opacity-50">
          <Icon className="h-5 w-5" />
          <span>{label}</span>
          {badge && <span className="ml-auto">{badge}</span>}
        </div>
      );
    }

    return (
      <Link
        to={to}
        className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          active
            ? 'bg-blue-100 text-blue-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </Link>
    );
  };

  const renderNavigationSection = (section, sectionIndex) => {
    const filteredItems = section.items.filter(item => {
      // Filter items based on permissions
      if (item.to === '/admin/dashboard' && !permissions.canViewDashboard) return false;
      if (item.to === '/organiser/dashboard' && !permissions.canViewDashboard) return false;
      if (item.to === '/suborg/dashboard' && !permissions.canViewDashboard) return false;
      if (item.to === '/staff/scan' && !permissions.canScanEntry) return false;
      if (item.to === '/auditor/dashboard' && !permissions.canViewReports) return false;
      if (item.label === 'Attendees' && !permissions.canViewAttendees) return false;
      if (item.label === 'Verification' && !permissions.canViewVerifications) return false;
      if (item.label === 'Zones & Areas' && !permissions.canViewZones) return false;
      if (item.label === 'Reports' && !permissions.canViewReports) return false;
      if (item.label === 'Users' && !permissions.canViewUsers) return false;
      if (item.label === 'Events' && !permissions.canViewEvents) return false;
      if (item.label === 'Settings' && !permissions.canManageSettings) return false;
      if (item.label === 'Notifications' && !permissions.canManageNotifications) return false;
      if (item.label === 'Invites' && !permissions.canInviteAttendees) return false;
      if (item.label === 'Bulk Upload' && !permissions.canBulkUpload) return false;
      if (item.label === 'Entry Scanner' && !permissions.canScanEntry) return false;
      if (item.label === 'Zone Scanner' && !permissions.canScanZones) return false;
      if (item.label === 'Manual Search' && !permissions.canManualSearch) return false;
      if (item.label === 'Activity Log' && !permissions.canViewActivityLogs) return false;
      if (item.label === 'Entry Logs' && !permissions.canViewEntryLogs) return false;
      if (item.label === 'Zone Activity' && !permissions.canViewZoneActivity) return false;
      if (item.label === 'System Settings' && !permissions.canManageSettings) return false;
      if (item.label === 'Create Event' && !permissions.canCreateEvents) return false;
      
      return true;
    });

    if (filteredItems.length === 0) return null;

    return (
      <div key={sectionIndex} className="space-y-1">
        <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {section.title}
        </h3>
        {filteredItems.map((item, itemIndex) => (
          <NavItem
            key={itemIndex}
            to={item.to}
            label={item.label}
            icon={item.icon}
            badge={item.badge}
          />
        ))}
      </div>
    );
  };

  return (
    <nav className={`space-y-6 ${className}`}>
      {/* Role Header */}
      <div className="px-3 py-2">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium text-slate-700">
            {ROLE_LABELS[role] || role}
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      {navigationConfig.sections.map(renderNavigationSection)}

      {/* Additional Quick Actions based on permissions */}
      {(permissions.canScanEntry || permissions.canVerifyPhotos || permissions.canManageZones) && (
        <div className="space-y-1 pt-4 border-t border-slate-200">
          <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Quick Actions
          </h3>
          {permissions.canScanEntry && (
            <NavItem
              to="/scan"
              label="Quick Scan"
              icon={MagnifyingGlassIcon}
            />
          )}
          {permissions.canVerifyPhotos && (
            <NavItem
              to="/verification/queue"
              label="Verification Queue"
              icon={ShieldCheckIcon}
              badge="3" // This would be dynamic
            />
          )}
          {permissions.canManageZones && (
            <NavItem
              to="/zones/monitor"
              label="Zone Monitor"
              icon={SignalIcon}
            />
          )}
        </div>
      )}

      {/* Public Navigation */}
      <div className="space-y-1 pt-4 border-t border-slate-200">
        <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Public
        </h3>
        <NavItem
          to="/"
          label="Public Site"
          icon={GlobeAltIcon}
        />
        <NavItem
          to="/profile"
          label="My Profile"
          icon={UsersIcon}
        />
        <NavItem
          to="/logout"
          label="Logout"
          icon={ArrowLeftOnRectangleIcon}
        />
      </div>
    </nav>
  );
};

export default RoleBasedNavigation;
