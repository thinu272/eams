import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ActivityList from '../../components/staff/ActivityList';
import { getEntryLogs } from '../../api/entry';
import { getZoneLogs } from '../../api/zone';
import { getMyEvents } from '../../api/events';
import { useAuth } from '../../context/AuthContext';

const StaffActivityLogPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const gateName = useMemo(() => (user?.assignedGates || [])[0] || undefined, [user]);
  const zoneName = useMemo(() => (user?.assignedZones || [])[0] || undefined, [user]);

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const isValidEvent = nextEvents.some(e => e._id === selectedEventId);
      const fallbackEventId = (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, [selectedEventId]);

  useEffect(() => {
    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setSelectedEventId(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const refresh = useCallback(async () => {
    if (!selectedEventId) return;

    try {
      const [entryResponse, zoneResponse] = await Promise.all([
        getEntryLogs({ eventId: selectedEventId, gateId: gateName, limit: 100 }),
        getZoneLogs({ eventId: selectedEventId, zone: zoneName, limit: 100 }),
      ]);

      const entryItems = (entryResponse.data?.data?.logs || []).map((item) => ({
        id: `entry-${item._id}`,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: item.gateName || item.zoneName,
        action: item.accessGranted ? 'Entry granted' : item.denialReason || 'Entry denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
      }));

      const zoneItems = (zoneResponse.data?.data?.logs || []).map((item) => ({
        id: `zone-${item._id}`,
        attendeeName: item.attendeeId?.fullName || item.attendeeSnapshot?.fullName,
        zoneName: item.zoneName,
        action: item.accessGranted ? `${item.action} allowed` : item.denialReason || 'Zone denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
      }));

      setItems([...entryItems, ...zoneItems].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    } catch {
      setItems([]);
    }
  }, [selectedEventId, gateName, zoneName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(1);
  }, [selectedEventId, gateName, zoneName]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pagedItems = items.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Staff Operations</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Activity Log</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
            Review staff activity in pages of 10 entry and zone validations from your assigned station.
          </p>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Filters</p>
              <h2 className="mt-2 text-xl font-black text-slate-900">Recent staff activity</h2>
            </div>
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500"
            >
              {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
            </select>
          </div>
        </section>

        <section className="space-y-4">
          <ActivityList title={`Staff Actions - Page ${page}`} items={pagedItems} emptyMessage="No staff activity has been recorded yet." />
          <div className="flex items-center justify-between rounded-[28px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Showing {items.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, items.length)} of {items.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                {page} / {totalPages}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default StaffActivityLogPage;
