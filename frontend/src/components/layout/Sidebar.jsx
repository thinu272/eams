import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = {
  main_admin: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/admin/events', label: 'Events', icon: '🏟' },
    {to: '/admin/users', label: 'Users', icon: '👥'},
    {to: '/entry', label: 'Entry Scanner', icon: '🔍'},
    {to: '/admin/reports', label: 'Reports', icon: '📊'},
  ],
  main_organiser: [
    { to: '/organiser/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/organiser/attendees', label: 'Attendees', icon: '👤' },
    {to: '/organiser/team', label: 'My Team', icon: '👥'},
    {to: '/entry', label: 'Entry Scanner', icon: '🔍'},
    {to: '/organiser/entry-logs', label: 'Entry Logs', icon: '📋'},
    { to: '/organiser/reports', label: 'Reports', icon: '📊' },
  ],
  sub_organiser: [
    { to: '/suborg/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/suborg/attendees', label: 'Attendees', icon: '👤' },
    { to: '/suborg/upload', label: 'Bulk Upload', icon: '📤' },
    { to: '/suborg/verify', label: 'Photo Verify', icon: '✅' },
  ],
  staff: [
    { to: '/entry', label: 'Entry Scanner', icon: '🔍' },
    { to: '/entry/logs', label: 'Scan Logs', icon: '📋' },
  ],
  volunteer: [
    { to: '/entry', label: 'Entry Scanner', icon: '🔍' },
  ],
  auditor: [
    { to: '/auditor/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/auditor/reports', label: 'Reports', icon: '📊' },
    { to: '/auditor/logs', label: 'Entry Logs', icon: '📋' },
  ],
};

const roleLabel = { main_admin: 'Main Admin', main_organiser: 'Organiser', sub_organiser: 'Sub Organiser', staff: 'Staff', volunteer: 'Volunteer', auditor: 'Auditor' };
const roleColor = { main_admin: 'bg-purple-100 text-purple-700', main_organiser: 'bg-blue-100 text-blue-700', sub_organiser: 'bg-teal-100 text-teal-700', staff: 'bg-orange-100 text-orange-700', volunteer: 'bg-green-100 text-green-700', auditor: 'bg-gray-100 text-gray-700' };

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const links = NAV[user?.role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-60'} bg-gray-900 text-white flex flex-col min-h-screen transition-all duration-200 shrink-0`}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        {!collapsed && <span className="font-bold text-lg tracking-tight">EAMS</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-white p-1 rounded">
          {collapsed ? '→' : '←'}
        </button>
      </div>
      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-gray-700">
          <p className="text-sm font-semibold truncate">{user.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[user.role]}`}>{roleLabel[user.role]}</span>
        </div>
      )}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {links.map(l => (
          <NavLink key={l.to} to={l.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
            }>
            <span className="text-base">{l.icon}</span>
            {!collapsed && <span>{l.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="px-2 py-4 border-t border-gray-700">
        <NavLink to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
          <span>🌐</span>{!collapsed && <span>Public Site</span>}
        </NavLink>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-red-800 hover:text-white w-full mt-1 transition-colors">
          <span>🚪</span>{!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
