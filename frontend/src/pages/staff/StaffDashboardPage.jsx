import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  QrCodeIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  SignalIcon,
  SignalSlashIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { getAssignedGateLabel, getAssignedZoneLabel } from './staffUtils';
import { getMyEvents } from '../../api/events';
import { getEntryStats } from '../../api/entry';

const MetricCard = ({ title, value, subtitle, accent = 'blue' }) => {
  const valueColor = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    rose: 'text-rose-600',
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${valueColor[accent] || 'text-slate-900'}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      )}
    </div>
  );
};

const StaffDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeEvent, setActiveEvent] = useState(null);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

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

  const initDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const eventsRes = await getMyEvents();
      const nextEvents = eventsRes.data?.data?.events || [];
      const lastEventId =
        localStorage.getItem('lastSelectedEventId') || nextEvents[0]?._id;
      const current =
        nextEvents.find((e) => e._id === lastEventId) || nextEvents[0];

      if (current) {
        setActiveEvent(current);
        const gate = (user?.assignedGates || [])[0] || 'Main Gate';
        const statsRes = await getEntryStats({
          eventId: current._id,
          gateId: gate,
        });
        const data = statsRes.data?.data?.today || {};
        setStats({
          total: data.totalScanned || 0,
          success: data.successfulEntries || 0,
          failed: data.deniedEntries || 0,
        });
      }
    } catch (err) {
      console.warn('Unable to load initial dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useAutoRefresh(initDashboard, {
    enabled: !!user,
    interval: 15000,
    immediate: true,
    deps: [user],
  });

  const actions = [
    {
      title: 'Ticket Scanner',
      desc: 'QR check-in / check-out at your assigned gate.',
      icon: QrCodeIcon,
      path: '/staff/scan',
      badge: getAssignedGateLabel(user),
      active:
        user?.permissions?.canEntryAccess === true ||
        (user?.assignedGates?.length > 0),
    },
    {
      title: 'Restricted Zones',
      desc: 'Validate access for VIP, backstage, and internal zones.',
      icon: ShieldCheckIcon,
      path: '/staff/zone-access',
      badge: getAssignedZoneLabel(user),
      active:
        user?.assignedZones?.length > 0 ||
        user?.responsibilities?.zoneIds?.length > 0,
    },
    {
      title: 'Registry Override',
      desc: 'Manual lookup by name, phone, NIC, or passport.',
      icon: MagnifyingGlassIcon,
      path: '/staff/search',
      badge: 'Manual lookup',
      active: true,
    },
    {
      title: 'Validation Ledger',
      desc: 'Entry audits and recent gate activity.',
      icon: ClockIcon,
      path: '/staff/activity',
      badge: 'Audit log',
      active: true,
    },
    {
      title: 'Cash Collection',
      desc: 'Confirm entrance cash for reserved ticket orders.',
      icon: BanknotesIcon,
      path: '/staff/cash-collection',
      badge: 'Cash desk',
      active:
        ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(user?.role) ||
        user?.canCollectCash === true ||
        user?.permissions?.canCollectCash === true,
    },
  ];

  return (
    <DashboardLayout>
      {/* Wider container so it fills more of the screen */}
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-20 sm:px-6 lg:px-8">
        
        {/* ========== HEADER ========== */}
        <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="px-5 py-6 sm:px-7 sm:py-7">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                Staff Terminal
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                  isOnline
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'animate-pulse border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {isOnline ? (
                  <>
                    <SignalIcon className="h-3 w-3" />
                    Online
                  </>
                ) : (
                  <>
                    <SignalSlashIcon className="h-3 w-3" />
                    Offline
                  </>
                )}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome,{' '}
              <span className="text-blue-600">
                {user?.name || 'Operator'}
              </span>
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Manage entry streams, restricted zones, and validation logging from this terminal.
            </p>

            {activeEvent && (
              <div className="mt-5 flex flex-col gap-1 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Active event:{' '}
                  <span className="font-semibold text-slate-800">
                    {activeEvent.name}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Station:{' '}
                  <span className="font-semibold text-slate-800">
                    {getAssignedGateLabel(user)}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ========== METRICS ========== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Gate Actions"
            value={loading ? '—' : stats.total}
            subtitle="Scans today"
            accent="blue"
          />
          <MetricCard
            title="Valid"
            value={loading ? '—' : stats.success}
            subtitle="Allowed entries"
            accent="green"
          />
          <MetricCard
            title="Denied"
            value={loading ? '—' : stats.failed}
            subtitle="Blocked attempts"
            accent="rose"
          />
        </div>

        {/* ========== OPERATIONS ========== */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Operations
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.path}
                  type="button"
                  disabled={!act.active}
                  onClick={() => act.active && navigate(act.path)}
                  className={`group flex items-start gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 text-left shadow-sm transition ${
                    act.active
                      ? 'hover:border-blue-200 hover:shadow-md cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-slate-900">
                        {act.title}
                      </h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        {act.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      {act.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboardPage;