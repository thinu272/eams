import React, { useMemo } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import BottomNav from './BottomNav';
import {
  HomeIcon,
  TicketIcon,
  UserCircleIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';

const BuyerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => ([
    { to: '/buyer/home', label: 'Home', icon: HomeIcon, end: true },
    { to: '/buyer/orders', label: 'Orders', icon: TicketIcon },
    { to: '/buyer/tickets', label: 'Tickets', icon: TicketIcon },
    { to: '/buyer/invites', label: 'Invites', icon: BellIcon },
    { to: '/buyer/profile', label: 'Profile', icon: UserCircleIcon },
  ]), []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 transition-all hover:opacity-90">
              <img src="/logo.png" alt="Entrynex Logo" className="w-8 h-8 object-contain" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-brand-main">ENTRYNEX</p>
                <h1 className="text-xs font-extrabold text-slate-900 leading-tight">Buyer Dashboard</h1>
              </div>
            </Link>
            
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1 border-l border-slate-200 pl-6 h-8">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (
                      `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ` +
                      (isActive
                        ? 'bg-brand-main text-white shadow-sm shadow-brand-main/20'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-all"
              title="Public Portal"
            >
              <GlobeAltIcon className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Public Portal</span>
            </Link>
            
            <div className="text-right hidden lg:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hi, {user?.name?.split(' ')[0] || 'Buyer'}</p>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 px-3 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pb-8">
        {children}
      </div>

      <BottomNav items={items} />
    </div>
  );
};

export default BuyerLayout;
