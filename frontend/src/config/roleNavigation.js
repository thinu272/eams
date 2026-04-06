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
} from '@heroicons/react/24/solid';
import { getCanonicalRole } from '../utils/rbac';

export const ROLE_NAVIGATION = {
  main_admin: {
    sections: [
      {
        title: 'Admin',
        items: [
          { to: '/admin/dashboard', label: 'Dashboard', icon: HomeIcon },
          { to: '/admin/events', label: 'Events', icon: TicketIcon },
          { to: '/admin/users', label: 'Users', icon: UsersIcon },
          { to: '/admin/reports', label: 'Reports', icon: ChartBarIcon },
        ],
      },
      {
        title: 'Operations',
        items: [
          { to: '/entry', label: 'Entry Scanner', icon: MagnifyingGlassIcon },
          { to: '/zone-scan', label: 'Zone Scanner', icon: ShieldCheckIcon },
        ],
      },
    ],
  },
  main_organiser: {
    sections: [
      {
        title: 'Event Control',
        items: [
          { to: '/organiser/dashboard', label: 'Dashboard', icon: HomeIcon },
          { to: '/organiser/events', label: 'Events', icon: TicketIcon },
          { to: '/organiser/attendees', label: 'Attendees', icon: UserGroupIcon },
          { to: '/organiser/team', label: 'My Team', icon: UsersIcon },
          { to: '/organiser/reports', label: 'Reports', icon: ChartBarIcon },
        ],
      },
      {
        title: 'Operations',
        items: [
          { to: '/entry', label: 'Entry Scanner', icon: MagnifyingGlassIcon },
          { to: '/zone-scan', label: 'Zone Scanner', icon: ShieldCheckIcon },
          { to: '/organiser/entry-logs', label: 'Entry Logs', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
  sub_organiser: {
    sections: [
      {
        title: 'Worklist',
        items: [
          { to: '/suborg/dashboard', label: 'Dashboard', icon: HomeIcon },
          { to: '/suborg/attendees', label: 'Attendees', icon: UserGroupIcon },
          { to: '/suborg/upload', label: 'Bulk Upload', icon: ArrowUpTrayIcon },
          { to: '/suborg/verify', label: 'Photo Verify', icon: CheckBadgeIcon },
        ],
      },
      {
        title: 'Operations',
        items: [
          { to: '/zone-scan', label: 'Zone Scanner', icon: ShieldCheckIcon },
        ],
      },
    ],
  },
  staff: {
    sections: [
      {
        title: 'Operations',
        items: [
          { to: '/entry', label: 'Entry Scanner', icon: MagnifyingGlassIcon },
          { to: '/zone-scan', label: 'Zone Scanner', icon: ShieldCheckIcon },
          { to: '/entry/logs', label: 'Scan Logs', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
  volunteer: {
    sections: [
      {
        title: 'Operations',
        items: [
          { to: '/entry', label: 'Entry Scanner', icon: MagnifyingGlassIcon },
          { to: '/zone-scan', label: 'Zone Scanner', icon: ShieldCheckIcon },
        ],
      },
    ],
  },
  auditor: {
    sections: [
      {
        title: 'Audit',
        items: [
          { to: '/auditor/dashboard', label: 'Dashboard', icon: HomeIcon },
          { to: '/auditor/reports', label: 'Reports', icon: ChartBarIcon },
          { to: '/auditor/logs', label: 'Entry Logs', icon: ClipboardDocumentListIcon },
        ],
      },
    ],
  },
};

export const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ORGANISER: 'Organiser',
  SUB_ORGANISER: 'Sub Organiser',
  STAFF: 'Staff',
  AUDITOR: 'Auditor',
  BUYER: 'Buyer',
};

export const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ORGANISER: 'bg-blue-100 text-blue-700',
  SUB_ORGANISER: 'bg-teal-100 text-teal-700',
  STAFF: 'bg-orange-100 text-orange-700',
  AUDITOR: 'bg-gray-100 text-gray-700',
  BUYER: 'bg-slate-100 text-slate-700',
};

export const PUBLIC_DASHBOARD_PATH = {
  SUPER_ADMIN: '/admin/dashboard',
  ORGANISER: '/organiser/dashboard',
  SUB_ORGANISER: '/suborg/dashboard',
  STAFF: '/entry',
  AUDITOR: '/auditor/dashboard',
  BUYER: '/dashboard',
};

export const getRoleLabel = (role) => ROLE_LABELS[getCanonicalRole(role)] || getCanonicalRole(role);
export const getRoleColor = (role) => ROLE_COLORS[getCanonicalRole(role)] || 'bg-slate-100 text-slate-700';
export const getDashboardPathForRole = (role) => PUBLIC_DASHBOARD_PATH[getCanonicalRole(role)] || '/';

export const PUBLIC_NAV_ITEMS = [
  { to: '/', label: 'Public Site', icon: GlobeAltIcon },
  { to: '/login', label: 'Logout', icon: ArrowLeftOnRectangleIcon },
];
