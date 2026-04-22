import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import { getMyEvents } from '../../api/events';
import { getAuditReports } from '../../api/audit';

const quickLinks = [
  {
    to: '/auditor/logs',
    title: 'Audit Logs',
    description: 'Review entry and zone activity with read-only filters and pagination.',
    icon: ClipboardDocumentListIcon,
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  {
    to: '/auditor/reports',
    title: 'Audit Reports',
    description: 'Inspect attendance and zone movement reports with export support.',
    icon: ChartBarIcon,
    tone: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  },
];

const statCards = [
  { key: 'totalAttendees', label: 'Total Attendees', icon: UserGroupIcon, tone: 'bg-white text-slate-900' },
  { key: 'confirmedAttendees', label: 'Confirmed', icon: ShieldCheckIcon, tone: 'bg-emerald-50 text-emerald-900' },
  { key: 'checkedInCount', label: 'Checked In', icon: EyeIcon, tone: 'bg-cyan-50 text-cyan-900' },
  { key: 'deniedEntries', label: 'Denied Entries', icon: ClipboardDocumentListIcon, tone: 'bg-rose-50 text-rose-900' },
];

const AuditorDashboard = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [summary, setSummary] = useState({
    totalAttendees: 0,
    confirmedAttendees: 0,
    checkedInCount: 0,
    deniedEntries: 0,
  });

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const fallbackEventId = selectedEventId || nextEvents[0]?._id || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, []);

  useEffect(() => {
    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setSelectedEventId(nextId);
    };

    window.addEventListener('eams:event-select', handleEventSelect);
    return () => window.removeEventListener('eams:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    getAuditReports({ eventId: selectedEventId }).then((response) => {
      setSummary(response.data?.data?.summary || {});
    });
  }, [selectedEventId]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('eams:event-select', { detail: nextId }));
  };

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId],
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-amber-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">Audit Workspace</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Auditor Dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
                Read-only visibility into attendance, access activity, and event evidence trails. Auditor access follows the event assignments granted by Main Organisers and Sub Organisers.
              </p>
            </div>
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Audited Event</p>
              <select
                value={selectedEventId}
                onChange={(event) => handleEventChange(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm font-semibold text-white outline-none"
              >
                {events.map((event) => (
                  <option key={event._id} value={event._id} className="text-slate-900">
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Current Scope</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{selectedEvent?.name || 'Select an event'}</h2>
              <p className="mt-2 text-sm text-slate-500">
                This workspace is synchronized with the global event selector and remains strictly read-only.
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              Auditor access only. No editing permissions.
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className={`rounded-[28px] border border-slate-200 p-5 shadow-sm ${tone}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-60">{label}</p>
                  <p className="mt-3 text-4xl font-black">{summary[key] || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-900/5 p-3">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`rounded-[28px] border p-6 shadow-sm transition ${item.tone}`}>
                <Icon className="h-10 w-10" />
                <h3 className="mt-4 text-xl font-black">{item.title}</h3>
                <p className="mt-2 text-sm font-medium text-slate-600">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorDashboard;
