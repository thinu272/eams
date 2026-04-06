import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeftOnRectangleIcon, GlobeAltIcon } from '@heroicons/react/24/solid';
import { getRoleColor, getRoleLabel, ROLE_NAVIGATION } from '../../config/roleNavigation';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const navigation = ROLE_NAVIGATION[user?.role] || { sections: [] };

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
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span>
        </div>
      )}
      <nav className="flex-1 py-4 px-2 space-y-4">
        {navigation.sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-5 w-5" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-2 py-4 border-t border-gray-700">
        <NavLink to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800">
          <GlobeAltIcon className="h-5 w-5" />{!collapsed && <span>Public Site</span>}
        </NavLink>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-red-800 hover:text-white w-full mt-1 transition-colors">
          <ArrowLeftOnRectangleIcon className="h-5 w-5" />{!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
