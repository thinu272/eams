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
} from '@heroicons/react/24/outline';

const BuyerLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => ([
    { to: '/buyer/home', label: 'Home', icon: HomeIcon, end: true },
    { to: '/buyer/tickets', label: 'Tickets', icon: TicketIcon },
    { to: '/buyer/invites', label: 'Invites', icon: BellIcon },
    { to: '/buyer/profile', label: 'Profile', icon: UserCircleIcon },
  ]), []);

  const headerTitle = useMemo(() => {
    const found = items.find((i) => location.pathname === i.to || (!i.end && location.pathname.startsWith(i.to)));
    return found?.label || 'Buyer';
  }, [items, location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">EAMS</p>
            <h1 className="text-lg font-bold text-slate-900">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              title="Public Home"
            >
              Public Home
            </Link>
            <div className="text-right">
              <p className="text-xs text-slate-500">Hi,</p>
              <p className="text-sm font-semibold text-slate-900">{user?.name || 'Buyer'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 md:px-6 md:pb-8">
        <div className="hidden md:flex md:gap-2 md:pb-5">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (
                `rounded-2xl px-4 py-2 text-sm font-semibold transition ` +
                (isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-100')
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        {children}
      </div>

      <BottomNav items={items} />
    </div>
  );
};

export default BuyerLayout;
