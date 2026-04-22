import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeftOnRectangleIcon, GlobeAltIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/solid';
import { getRoleColor, getRoleLabel, ROLE_NAVIGATION } from '../../config/roleNavigation';
import { getCanonicalRole } from '../../utils/rbac';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const navigation = ROLE_NAVIGATION[getCanonicalRole(user?.role)] || { sections: [] };

  const handleLogout = () => { logout(); navigate('/login'); };
  const currentSearchParams = new URLSearchParams(location.search);
  const currentSection = currentSearchParams.get('section') || '';
  const brandTitle = getCanonicalRole(user?.role) === 'MainOrganiser'
    ? 'EAMS Organiser'
    : getCanonicalRole(user?.role) === 'MainAdmin'
      ? 'EAMS Super Admin'
      : getCanonicalRole(user?.role) === 'Staff'
        ? 'EAMS Staff'
      : 'EAMS Admin';

  const isItemActive = (to) => {
    const [targetPath, rawQuery = ''] = to.split('?');
    const targetParams = new URLSearchParams(rawQuery);
    const targetSection = targetParams.get('section') || '';

    if (location.pathname !== targetPath) {
      return false;
    }

    if (targetSection) {
      return currentSection === targetSection;
    }

    if (targetPath === '/admin/dashboard') {
      return currentSection === '';
    }

    return true;
  };

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} flex min-h-screen shrink-0 flex-col bg-slate-950 text-white transition-all duration-200`}>
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        {!collapsed && <span className="font-bold text-lg tracking-tight text-white">{brandTitle}</span>}
        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-white p-1 rounded">
          {collapsed ? <ChevronDoubleRightIcon className="h-5 w-5" /> : <ChevronDoubleLeftIcon className="h-5 w-5" />}
        </button>
      </div>
      {!collapsed && user && (
        <div className="px-4 py-4 border-b border-slate-800">
          <p className="text-sm font-semibold truncate text-white">{user.name}</p>
          <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full font-semibold ${getRoleColor(user.role)}`}>
            {getRoleLabel(user.role)}
          </span>
        </div>
      )}
      <nav className="flex-1 py-4 px-2 space-y-4">
        {navigation.sections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={() =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                      isItemActive(item.to) ? 'bg-blue-500/20 text-blue-200 border border-blue-500/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
      <div className="px-2 py-4 border-t border-slate-800">
        <NavLink to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">
          <GlobeAltIcon className="h-5 w-5" />{!collapsed && <span>Public Site</span>}
        </NavLink>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-rose-700 hover:text-white w-full mt-1 transition-colors">
          <ArrowLeftOnRectangleIcon className="h-5 w-5" />{!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
