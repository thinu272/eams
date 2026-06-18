import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { 
  QrCodeIcon, 
  ShieldCheckIcon, 
  MagnifyingGlassIcon, 
  ClockIcon, 
  SignalIcon, 
  SignalSlashIcon,
  SparklesIcon,
  UserIcon
} from '@heroicons/react/24/solid';
import { getAssignedGateLabel, getAssignedZoneLabel } from './staffUtils';
import { getMyEvents } from '../../api/events';
import { getEntryStats } from '../../api/entry';

const StaffDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeEvent, setActiveEvent] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  // Connectivity Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch event and active counters
  useEffect(() => {
    const initDashboard = async () => {
      try {
        const eventsRes = await getMyEvents();
        const nextEvents = eventsRes.data?.data?.events || [];
        const lastEventId = localStorage.getItem('lastSelectedEventId') || nextEvents[0]?._id;
        const current = nextEvents.find(e => e._id === lastEventId) || nextEvents[0];
        
        if (current) {
          setActiveEvent(current);
          const gate = (user?.assignedGates || [])[0] || 'Main Gate';
          const statsRes = await getEntryStats({ eventId: current._id, gateId: gate });
          const data = statsRes.data?.data?.today || {};
          setStats({
            total: data.totalScanned || 0,
            success: data.successfulEntries || 0,
            failed: data.deniedEntries || 0
          });
        }
      } catch (err) {
        console.warn('Unable to load initial dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    initDashboard();
  }, [user]);

  const actions = [
    {
      title: 'Ticket Scanner',
      desc: 'Process fast QR ticket check-ins and check-outs at your assigned gate.',
      icon: QrCodeIcon,
      path: '/staff/scan',
      badge: getAssignedGateLabel(user),
      theme: 'from-blue-600 to-indigo-600 shadow-blue-500/20',
      active: user?.permissions?.canEntryAccess === true || (user?.assignedGates?.length > 0)
    },
    {
      title: 'Restricted Zones',
      desc: 'Validate wristbands or tokens for internal sections (VIP, backstage).',
      icon: ShieldCheckIcon,
      path: '/staff/zone-access',
      badge: getAssignedZoneLabel(user),
      theme: 'from-emerald-600 to-teal-600 shadow-emerald-500/20',
      active: (user?.assignedZones?.length > 0) || (user?.responsibilities?.zoneIds?.length > 0)
    },
    {
      title: 'Registry Override',
      desc: 'Perform manual search lookups using attendee details (Name, NIC).',
      icon: MagnifyingGlassIcon,
      path: '/staff/search',
      badge: 'Manual Lookup',
      theme: 'from-purple-600 to-pink-600 shadow-purple-500/20',
      active: true
    },
    {
      title: 'Validation Ledger',
      desc: 'Access paginated event entry audits and recent gate activities.',
      icon: ClockIcon,
      path: '/staff/activity',
      badge: 'Audit Log',
      theme: 'from-slate-700 to-slate-900 shadow-slate-500/20',
      active: true
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto px-2">
        
        {/* Soft Hero Welcome Header */}
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-950 via-[#0b132b] to-[#1c2541] p-6 lg:p-10 text-white shadow-2xl border border-white/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 text-xs font-black text-blue-400 uppercase tracking-widest">
                <SparklesIcon className="h-4 w-4" />
                Terminal Ready
              </div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                Welcome Back, <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">{user?.name || 'Operator'}</span>
              </h1>
              <p className="text-sm text-slate-300 font-medium max-w-xl">
                Manage high-throughput entry streams, restricted areas, and real-time validation logging.
              </p>
            </div>

            {/* Offline indicator badge */}
            <div className={`shrink-0 self-start md:self-center flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider ${
              isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'
            }`}>
              {isOnline ? (
                <>
                  <SignalIcon className="h-4 w-4" />
                  Terminal Online
                </>
              ) : (
                <>
                  <SignalSlashIcon className="h-4 w-4" />
                  Terminal Offline
                </>
              )}
            </div>
          </div>

          {/* Quick Active Setup Banner */}
          {activeEvent && (
            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-bold text-slate-400 tracking-wide">
              <div>
                Active Event: <span className="text-white font-black">{activeEvent.name}</span>
              </div>
              <div>
                Assigned Station: <span className="text-white font-black">{getAssignedGateLabel(user)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Dynamic Counters Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-slate-100 p-4 sm:p-5 md:p-6 shadow-sm text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Gate Actions</p>
            <p className="mt-1 text-xl sm:text-2xl md:text-3xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50/50 border border-emerald-100 p-4 sm:p-5 md:p-6 shadow-sm text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Total Valid</p>
            <p className="mt-1 text-xl sm:text-2xl md:text-3xl font-black text-emerald-600">{stats.success}</p>
          </div>
          <div className="rounded-2xl bg-rose-50/50 border border-rose-100 p-4 sm:p-5 md:p-6 shadow-sm text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-600">Total Denied</p>
            <p className="mt-1 text-xl sm:text-2xl md:text-3xl font-black text-rose-600">{stats.failed}</p>
          </div>
        </section>

        {/* Beautiful Simple Operational Menu Grid */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Launch Operational Console</h2>
          
          <div className="grid gap-5 md:grid-cols-2">
            {actions.map((act, index) => {
              const Icon = act.icon;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!act.active}
                  onClick={() => navigate(act.path)}
                  className={`group text-left p-6 rounded-3xl border border-slate-150 bg-white transition duration-300 flex items-start gap-5 hover:border-slate-300 hover:shadow-xl ${
                    act.active ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${act.theme} text-white shrink-0 group-hover:scale-105 transition duration-300`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black text-slate-900 leading-none">{act.title}</h3>
                      <span className="text-[9px] font-black tracking-wider uppercase bg-slate-100 text-slate-600 rounded px-2.5 py-1 truncate max-w-[120px]">
                        {act.badge}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 leading-normal">
                      {act.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </DashboardLayout>
  );
};

export default StaffDashboardPage;
