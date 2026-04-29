import React, { useEffect, useState } from 'react';
import { BellIcon, MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { getRoleLabel, getRoleColor } from '../../config/roleNavigation';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications';
import { getMyEvents } from '../../api/events';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const Topbar = () => {
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
  const assignedZoneText = (user?.assignedZones || []).filter(Boolean).join(', ');

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
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Event Access Management System</p>
        <p className="text-lg font-bold text-slate-900">
          {isOrganiserWorkspace ? 'Organiser Command Desk' : isSuperAdminWorkspace ? 'Super Admin Control Center' : isStaffWorkspace ? 'Staff Operations Desk' : 'System Administration Console'}
        </p>
        {isStaffWorkspace && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">
              Staff: {user?.name || 'Operator'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              Gate: {assignedGateText || 'Any gate'}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">
              Zone: {assignedZoneText || 'Any zone'}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {isOrganiserWorkspace && events.length > 0 && (
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
          >
            {events.map((event) => (
              <option key={event._id} value={event._id}>{event.name}</option>
            ))}
          </select>
        )}
        <div className={`items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-500 ${isStaffWorkspace ? 'hidden' : 'hidden lg:flex'}`}>
          <MagnifyingGlassIcon className="h-4 w-4" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={isSuperAdminWorkspace ? 'Search events, users, organisers...' : 'Search attendees, logs, events...'}
            className="w-72 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="relative">
          <button
            className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900"
            onClick={() => setOpen((value) => !value)}
          >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <button onClick={handleMarkAll} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                Mark all read
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-auto">
              {items.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    item.read ? 'border-slate-100 bg-slate-50 text-slate-500' : 'border-blue-100 bg-blue-50 text-slate-900'
                  }`}
                >
                  <p className="font-semibold">{item.title}</p>
                  {item.message && <p className="text-xs text-slate-500">{item.message}</p>}
                  <p className="mt-1 text-[10px] text-slate-400">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                </button>
              ))}
              {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                  No notifications yet.
                </div>
              )}
            </div>
          </div>
        )}
        </div>
        {user && (
          <div className="relative">
            <button
              onClick={() => setProfileOpen((value) => !value)}
              className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="leading-tight text-left">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-widest ${getRoleColor(user.role)} rounded-full px-2 py-0.5`}>
                  {getRoleLabel(user.role)}
                </span>
              </div>
              <ChevronDownIcon className="h-4 w-4 text-slate-500" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <button onClick={() => navigate(isOrganiserWorkspace ? '/organiser/dashboard?section=settings' : isStaffWorkspace ? '/dashboard' : '/admin/dashboard?section=settings')} className="w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                  Open dashboard
                </button>
                <button onClick={handleLogout} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-rose-500 hover:bg-rose-500/10">
                  Sign out
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
