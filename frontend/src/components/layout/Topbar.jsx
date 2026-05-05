import React, { useEffect, useState } from 'react';
import { BellIcon, MagnifyingGlassIcon, ChevronDownIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../config/roleNavigation';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import { getMyEvents } from '../../api/events';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const Topbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  const isOrganiserWorkspace = ['MainOrganiser', 'SubOrganiser'].includes(user?.role);
  const isSuperAdminWorkspace = user?.role === 'MainAdmin';
  const isStaffWorkspace = user?.role === 'Staff';
  const assignedGateText = (user?.assignedGates || []).filter(Boolean).join(', ');

  const loadNotifications = async () => {
    try {
      const response = await getNotifications({ limit: 10 });
      setItems(response.data?.data?.notifications || []);
      setUnreadCount(response.data?.data?.unreadCount || 0);
    } catch (err) {
      toast.error('Failed to load notifications');
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!isOrganiserWorkspace) return;
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const fallbackEventId = selectedEventId || nextEvents[0]?._id || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
      }
    }).catch(() => {});
  }, [isOrganiserWorkspace]);

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleItemClick = async (item) => {
    if (item.read) return;
    try {
      await markNotificationRead(item._id);
      setItems((prev) => prev.map((n) => n._id === item._id ? { ...n, read: true } : n));
      setUnreadCount((count) => Math.max(count - 1, 0));
    } catch {
      toast.error('Failed to update notification');
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    window.dispatchEvent(new CustomEvent('entrynex:search', { detail: value }));
  };

  const handleEventChange = (value) => {
    setSelectedEventId(value);
    localStorage.setItem('lastSelectedEventId', value);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: value }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/50 bg-white/70 px-4 lg:px-8 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2.5 text-slate-500 hover:bg-slate-100/50 rounded-xl lg:hidden transition-colors"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <div className="animate-fade-in">
          <p className="hidden sm:block text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">System Dashboard</p>
          <p className="text-sm lg:text-base font-black text-slate-900 tracking-tight">
            {isOrganiserWorkspace ? 'Command Center' : isSuperAdminWorkspace ? 'Global Control' : isStaffWorkspace ? 'Operations Terminal' : 'Console'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        {isOrganiserWorkspace && events.length > 0 && (
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="hidden md:block rounded-xl border border-slate-200 bg-white/50 px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-brand-main transition-all"
          >
            {events.map((event) => (
              <option key={event._id} value={event._id}>{event.name}</option>
            ))}
          </select>
        )}

        <div className={`items-center gap-2 rounded-xl border border-slate-200/50 bg-white/50 px-4 py-2 text-slate-400 focus-within:border-brand-main focus-within:text-brand-main transition-all ${isStaffWorkspace ? 'hidden' : 'hidden lg:flex'}`}>
          <MagnifyingGlassIcon className="h-4 w-4" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Quick search..."
            className="bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Staff Workspace Info */}
        {isStaffWorkspace && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="rounded-xl bg-brand-main/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-main">
              {assignedGateText || 'General Gate'}
            </span>
          </div>
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/50 text-slate-500 hover:bg-slate-200/50 transition-all"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-lg bg-brand-main px-1 text-[9px] font-black text-white shadow-lg shadow-brand-main/30">
                {unreadCount}
              </span>
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-80 rounded-[28px] border border-slate-100 bg-white p-4 shadow-2xl animate-fade-in overflow-hidden">
              <div className="flex items-center justify-between mb-4 px-2">
                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Notifications</p>
                <button onClick={handleMarkAll} className="text-[10px] font-black text-brand-main uppercase tracking-widest hover:underline">
                  Clear All
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-auto custom-scrollbar">
                {items.length > 0 ? items.map((item) => (
                  <div key={item._id} onClick={() => handleItemClick(item)} className={`group cursor-pointer rounded-2xl p-3 transition-all ${item.read ? 'hover:bg-slate-50' : 'bg-brand-main/5 hover:bg-brand-main/10'}`}>
                    <p className={`text-sm font-bold ${item.read ? 'text-slate-600' : 'text-slate-900'}`}>{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{item.message}</p>
                    <p className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</p>
                  </div>
                )) : (
                  <div className="py-10 text-center">
                     <p className="text-sm text-slate-400 font-medium italic">No new alerts</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setProfileOpen((value) => !value)}
              className="flex items-center gap-3 rounded-xl border border-slate-200/50 bg-white/50 pl-3 pr-2 py-1.5 hover:bg-slate-50 transition-all"
            >
              <div className="h-7 w-7 rounded-lg bg-brand-main flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-brand-main/20">
                {user.name?.charAt(0) || 'U'}
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-3 w-56 rounded-[24px] border border-slate-100 bg-white p-2 shadow-2xl animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-50 mb-1">
                   <p className="text-sm font-black text-slate-900 truncate">{user.name}</p>
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-0.5">{user.role}</p>
                </div>
                <button onClick={() => navigate(isOrganiserWorkspace ? '/organiser/dashboard?section=settings' : isStaffWorkspace ? '/dashboard' : '/admin/dashboard?section=settings')} className="w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                  Dashboard Settings
                </button>
                <button onClick={handleLogout} className="mt-1 w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Topbar;
