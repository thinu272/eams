import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { getAuditReports } from '../../api/audit';
import Stat from '../../components/ui/Stat';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid';

const quickLinks = [
  {
    to: '/auditor/logs',
    title: 'Audit Logs',
    description: 'Review entry and zone activity without any write access.',
    icon: ClipboardDocumentListIcon,
    styles: 'border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700',
  },
  {
    to: '/auditor/reports',
    title: 'Audit Reports',
    description: 'Run attendance and zone movement reports with filters and CSV export.',
    icon: ChartBarIcon,
    styles: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
  },
];

const AuditorDashboard = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [summary, setSummary] = useState({
    totalAttendees: 0,
    confirmedAttendees: 0,
    checkedInCount: 0,
    deniedEntries: 0,
  });

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) setSelectedEvent(myEvents[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    getAuditReports({ eventId: selectedEvent }).then((response) => {
      setSummary(response.data?.data?.summary || {});
    });
  }, [selectedEvent]);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Auditor Dashboard</h1>
            <p className="text-sm text-gray-500">Read-only visibility into event entry activity, zone movement, and attendance reporting.</p>
          </div>
          <select
            value={selectedEvent}
            onChange={(event) => setSelectedEvent(event.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Audited Event</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">{selectedEventData?.name || 'Select an event'}</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            This dashboard is read-only. It is designed for evidence review, operational transparency, and exporting audit-ready CSV files.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Attendees" value={summary.totalAttendees || 0} color="blue" icon={<UserGroupIcon className="h-5 w-5" />} />
          <Stat label="Confirmed Attendees" value={summary.confirmedAttendees || 0} color="green" icon={<ShieldCheckIcon className="h-5 w-5" />} />
          <Stat label="Checked In" value={summary.checkedInCount || 0} color="purple" icon={<ClipboardDocumentListIcon className="h-5 w-5" />} />
          <Stat label="Denied Entries" value={summary.deniedEntries || 0} color="red" icon={<ChartBarIcon className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-2xl border p-6 transition-colors ${item.styles}`}
              >
                <Icon className="h-10 w-10" />
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorDashboard;
