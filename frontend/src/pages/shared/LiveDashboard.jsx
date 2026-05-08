import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getAllEventsAdmin, getMyEvents } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import {
  getDashboardStats,
  getDashboardLogs,
  getDashboardTimeline,
} from '../../api/dashboard';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { 
  CheckCircleIcon, 
  ArrowRightOnRectangleIcon, 
  MapPinIcon, 
  ArrowLeftOnRectangleIcon, 
  XCircleIcon, 
  NoSymbolIcon, 
  TagIcon 
} from '@heroicons/react/24/solid';

/* ─── constants ───────────────────────────────────────────────── */
const ZONE_COLORS = ['#3b82f6','#0ea5e9','#6366f1','#7c3aed','#ec4899','#f43f5e','#14b8a6'];
const CAT_COLORS  = ['#2563eb','#0284c7','#4f46e5','#9333ea','#db2777','#0891b2','#0d9488'];

const actionColors = {
  'CHECK-IN':   'text-sky-400',
  'CHECK-OUT':  'text-blue-400',
  'ZONE ENTRY': 'text-purple-400',
  'ZONE EXIT':  'text-gray-400',
  'DENIED ENTRY':'text-red-400',
  'DENIED EXIT':'text-red-400',
  'ZONE DENIED':'text-red-400',
  'DUPLICATE SCAN':'text-amber-500',
};

const actionIcons = {
  'CHECK-IN':   CheckCircleIcon,
  'CHECK-OUT':  ArrowRightOnRectangleIcon,
  'ZONE ENTRY': MapPinIcon,
  'ZONE EXIT':  ArrowLeftOnRectangleIcon,
  'DENIED ENTRY': XCircleIcon,
  'DENIED EXIT': XCircleIcon,
  'ZONE DENIED': NoSymbolIcon,
  'DUPLICATE SCAN': NoSymbolIcon,
};

/* ─── stat card ───────────────────────────────────────────────── */
const LiveStat = ({ label, value, delta, color, icon }) => {
  const colours = {
    blue:   'from-blue-600 to-blue-700',
    green:  'from-blue-500 to-blue-700',
    red:    'from-rose-500 to-rose-700',
    purple: 'from-violet-500 to-violet-700',
    amber:  'from-sky-500 to-sky-700',
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colours[color] || colours.blue} p-5 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">{label}</p>
          <p className="mt-2 text-4xl font-black tabular-nums text-white">{value ?? 0}</p>
          {delta != null && (
            <p className="mt-1 text-xs font-medium text-white/70">
              {delta > 0 ? `+${delta}` : delta} this hour
            </p>
          )}
        </div>
        <div className="text-white/30">{icon}</div>
      </div>
    </div>
  );
};

/* ─── section header ──────────────────────────────────────────── */
const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-4">
    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
  </div>
);

/* ─── chart card wrapper ──────────────────────────────────────── */
const ChartCard = ({ children, title, subtitle, className = '' }) => (
  <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
    {title && <SectionHeader title={title} subtitle={subtitle} />}
    {children}
  </div>
);

/* ─── activity item ───────────────────────────────────────────── */
const updateZoneOccupancy = (zones = [], zoneName, delta) => {
  if (!zoneName) return zones;
  const existing = zones.find((zone) => zone.zoneName === zoneName);
  const nextZones = existing ? zones : [...zones, { zoneName, entries: 0, exits: 0, occupancy: 0 }];

  return nextZones.map((zone) => {
    if (zone.zoneName !== zoneName) return zone;
    return {
      ...zone,
      entries: Math.max((zone.entries || 0) + (delta.entries || 0), 0),
      exits: Math.max((zone.exits || 0) + (delta.exits || 0), 0),
      occupancy: Math.max((zone.occupancy || 0) + (delta.occupancy || 0), 0),
    };
  });
};

const ActivityItem = ({ log, isNew }) => {
  const action = log.action || '';
  const colorClass = actionColors[action] || 'text-gray-500';
  const Icon = actionIcons[action] || '•';
  const name = log.name || log.attendee?.fullName || log.snapshot?.fullName || 'Unknown';
  const zone = log.zoneName || log.gateName || '';
  const ts   = log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss') : '';

  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${isNew ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'}`}>
      <div className="w-7 text-center flex-shrink-0 flex items-center justify-center">
        {Icon === '•' ? <span className="text-gray-400">•</span> : <Icon className={`h-6 w-6 ${colorClass}`} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 truncate">{zone}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-xs font-bold ${colorClass}`}>{action}</p>
        <p className="text-xs text-gray-400">{ts}</p>
      </div>
    </div>
  );
};

/* ─── main component ──────────────────────────────────────────── */
const LiveDashboard = ({ readOnly = false }) => {
  const { isAdmin } = useAuth();
  const [events, setEvents]     = useState([]);
  const [selected, setSelected] = useState('');
  const [stats, setStats]       = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [activity, setActivity] = useState([]);
  const [newIds, setNewIds]     = useState(new Set());
  const [lastFetch, setLastFetch] = useState(null);
  const socketRef = useRef(null);

  /* Load events */
  useEffect(() => {
    const loadEvents = isAdmin
      ? getAllEventsAdmin({ limit: 100 })
      : getMyEvents();

    loadEvents.then(r => {
      const evs = r.data?.data?.events || [];
      setEvents(evs);
      if (evs.length) setSelected(evs[0]._id);
    }).catch(() => {
      setEvents([]);
      setSelected('');
    });
  }, [isAdmin]);

  const fetchAll = useCallback(async (eventId) => {
    if (!eventId) return;
    try {
      const [sr, lr, tr] = await Promise.all([
        getDashboardStats({ eventId }),
        getDashboardLogs({ eventId, limit: 20 }),
        getDashboardTimeline({ eventId }),
      ]);
      setStats(sr.data?.data);
      setActivity(lr.data?.data?.logs || []);
      setTimeline(tr.data?.data?.timeline || []);
      setLastFetch(new Date());
    } catch { /* ignore */ }
  }, []);

  /* Initial fetch + re-fetch on event change */
  useEffect(() => {
    if (!selected) return;
    fetchAll(selected);
  }, [selected, fetchAll]);

  /* Socket.io real-time updates */
  useEffect(() => {
    if (!selected) return;

    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    socketRef.current = socket;
    socket.emit('join_dashboard', { eventId: selected });

    const handleRealtimeUpdate = (data) => {
      const incomingEventId = data?.eventId ? String(data.eventId) : '';
      if (incomingEventId && incomingEventId !== String(selected)) return;

      const newEntry = {
        ...data,
        _id: data._id || `live-${data.source || 'event'}-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setActivity(prev => [newEntry, ...prev].slice(0, 20));

      setNewIds(prev => new Set([...prev, newEntry._id]));
      setTimeout(() => {
        setNewIds(prev => { const n = new Set(prev); n.delete(newEntry._id); return n; });
      }, 3000);

      // Bump counters instantly
      if (data.accessGranted && data.action === 'CHECK-IN') {
        setStats(prev => prev ? {
          ...prev,
          checkedInCount: (prev.checkedInCount || 0) + 1,
        } : prev);
      } else if (data.accessGranted && data.action === 'ZONE ENTRY') {
        setStats(prev => prev ? {
          ...prev,
          zoneOccupancy: updateZoneOccupancy(prev.zoneOccupancy, data.zoneName, { entries: 1, occupancy: 1 }),
        } : prev);
      } else if (data.accessGranted && data.action === 'ZONE EXIT') {
        setStats(prev => prev ? {
          ...prev,
          zoneOccupancy: updateZoneOccupancy(prev.zoneOccupancy, data.zoneName, { exits: 1, occupancy: -1 }),
        } : prev);
      } else if (!data.accessGranted) {
        setStats(prev => prev ? {
          ...prev,
          deniedCount: (prev.deniedCount || 0) + 1,
        } : prev);
      }

      // Refresh timeline every new event
      getDashboardTimeline({ eventId: selected })
        .then(r => setTimeline(r.data?.data?.timeline || []))
        .catch(() => {});
    };

    socket.on('entry_update', handleRealtimeUpdate);
    socket.on('zone_update', handleRealtimeUpdate);

    return () => socket.disconnect();
  }, [selected]);

  /* Derived data */
  const zoneData = stats?.zoneOccupancy || [];
  const catData  = (stats?.byCategory || []).map(c => ({ name: c.categoryName || c._id || 'Other', value: c.count }));
  const wristbandsIssued = stats?.checkedInCount || 0; // proxy - scan path gives wb

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Live Dashboard {readOnly && <span className="ml-2 text-xs rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 font-semibold">READ-ONLY</span>}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Real-time event monitoring | auto-updates via WebSocket
              {lastFetch && <span className="ml-2 text-gray-400">· Last sync {format(lastFetch, 'HH:mm:ss')}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-semibold text-blue-600">LIVE</span>
            </div>
            {events.length > 1 && (
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Live counters */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <LiveStat label="Checked In"       value={stats?.checkedInCount}       color="green"  icon={<CheckCircleIcon className="h-10 w-10" />} />
          <LiveStat label="Currently Inside" value={Math.max((stats?.checkedInCount || 0) - (stats?.zoneOccupancy?.reduce((a,z) => a + z.exits, 0) || 0), 0)} color="blue" icon={<MapPinIcon className="h-10 w-10" />} />
          <LiveStat label="Denied Entry"     value={stats?.deniedCount}          color="red"    icon={<XCircleIcon className="h-10 w-10" />} />
          <LiveStat label="Wristbands"       value={wristbandsIssued}            color="purple" icon={<TagIcon className="h-10 w-10" />} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Timeline */}
          <ChartCard title="Check-in Timeline" subtitle="Entries per hour today" className="xl:col-span-2">
            {timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} check-ins`, 'Count']} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#timelineGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-gray-400 text-sm">No check-ins yet today</div>
            )}
          </ChartCard>

          {/* Category donut */}
          <ChartCard title="Category Breakdown" subtitle="Attendees by ticket type">
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} label={false}>
                    {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-52 items-center justify-center text-gray-400 text-sm">No category data</div>
            )}
          </ChartCard>
        </div>

        {/* Zone + Activity row */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          {/* Zone occupancy */}
          <ChartCard title="Zone Occupancy" subtitle="Current occupancy vs total entries">
            {zoneData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={zoneData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="zoneName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="entries"   name="Total Entries"       fill="#6366f1" radius={[4,4,0,0]} />
                  <Bar dataKey="occupancy" name="Current Occupancy"   fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="exits"     name="Exits"               fill="#0ea5e9" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-56 items-center justify-center text-gray-400 text-sm">No zone data yet</div>
            )}
          </ChartCard>

          {/* Live activity feed */}
          <ChartCard title="Live Activity Feed" subtitle="Last 20 events">
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 280 }}>
              {activity.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400">No events yet | waiting for first scan…</div>
              )}
              {activity.map((log) => (
                <ActivityItem key={log._id || log.timestamp} log={log} isNew={newIds.has(log._id)} />
              ))}
            </div>
          </ChartCard>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default LiveDashboard;
