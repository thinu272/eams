import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeftOnRectangleIcon, GlobeAltIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/solid';
import { getRoleColor, getRoleLabel, ROLE_NAVIGATION } from '../../config/roleNavigation';
import { getCanonicalRole } from '../../utils/rbac';

const Sidebar = ({ isMobileOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const navigation = ROLE_NAVIGATION[getCanonicalRole(user?.role)] || { sections: [] };

  const handleLogout = () => { logout(); navigate('/login'); };
  
  const currentSearchParams = new URLSearchParams(location.search);
  const currentSection = currentSearchParams.get('section') || '';

  const isItemActive = (to) => {
    const [targetPath, rawQuery = ''] = to.split('?');
    const targetParams = new URLSearchParams(rawQuery);
    const targetSection = targetParams.get('section') || '';

    if (location.pathname !== targetPath) return false;
    if (targetSection) return currentSection === targetSection;
    if (targetPath === '/admin/dashboard' || targetPath === '/organiser/dashboard') return currentSection === '';
    return true;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#020617] via-[#050b24] to-[#0a1128] border-r border-white/5 transition-all duration-500 ease-in-out lg:static lg:translate-x-0 ${
          collapsed ? 'w-20' : 'w-72'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg shadow-black/10 overflow-hidden">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-1" onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=EX'; }} />
            </div>
            {!collapsed && (
              <span className="text-xl font-black tracking-tighter text-white uppercase italic">
                Entry<span className="text-brand-main">Nex</span>
              </span>
            )}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
            {collapsed ? <ChevronDoubleRightIcon className="h-5 w-5" /> : <ChevronDoubleLeftIcon className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 space-y-8 px-4 py-6 overflow-y-auto custom-scrollbar">
          {navigation.sections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) => {
                if (['Verification'].includes(item.label)) {
                  return user?.responsibilities?.verificationAccess === true || ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(getCanonicalRole(user?.role));
                }
                if (['Entry Scanner', 'Scan Entry', 'Manual Search'].includes(item.label)) {
                  return user?.responsibilities?.entryAccess || (user?.assignedGates?.length > 0);
                }
                if (['Zone Scanner', 'Zone Access', 'My Zones', 'Zone Manual Search'].includes(item.label)) {
                  return (user?.responsibilities?.zoneIds?.length > 0) || (user?.assignedZones?.length > 0);
                }
                if (['Bulk Upload'].includes(item.label)) {
                  return user?.permissions?.canBulkUpload === true || ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(getCanonicalRole(user?.role));
                }
                return true;
              }),
            }))
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.title} className="space-y-2">
                {!collapsed && (
                  <p className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-blue-400/60 mb-3">
                    {section.title}
                  </p>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.to);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-bold tracking-tight transition-all duration-300 group ${
                        active
                          ? 'bg-gradient-to-r from-brand-main to-blue-500 text-white shadow-lg shadow-brand-main/30 active-glow'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-5 w-5 transition-transform duration-300 ${active ? '' : 'group-hover:scale-110'}`} />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))}
        </nav>

        <div className="border-t border-white/5 p-4 space-y-2">
          {!collapsed && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-main">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{getRoleLabel(user?.role)}</p>
              </div>
            </div>
          )}
          
          <NavLink to="/" className="flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all group">
            <GlobeAltIcon className="h-5 w-5 transition-transform group-hover:rotate-12" />
            {!collapsed && <span>Public Portal</span>}
          </NavLink>
          
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition-all group"
          >
            <ArrowLeftOnRectangleIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
