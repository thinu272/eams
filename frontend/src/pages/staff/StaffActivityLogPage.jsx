import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ActivityList from '../../components/staff/ActivityList';
import { getEntryLogs } from '../../api/entry';
import { getZoneLogs } from '../../api/zone';
import { getMyEvents } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const StaffActivityLogPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const gateName = useMemo(
    () => (user?.assignedGates || [])[0] || undefined,
    [user]
  );
  const zoneName = useMemo(
    () => (user?.assignedZones || [])[0] || undefined,
    [user]
  );

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const isValidEvent = nextEvents.some((e) => e._id === selectedEventId);
      const fallbackEventId =
        (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, [selectedEventId]);

  useEffect(() => {
    const handleEventSelect = (event) => {
      setSelectedEventId(event.detail || '');
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: nextId })
    );
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
        action: item.accessGranted
          ? 'Entry granted'
          : item.denialReason || 'Entry denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
      }));

      const zoneItems = (zoneResponse.data?.data?.logs || []).map((item) => ({
        id: `zone-${item._id}`,
        attendeeName:
          item.attendeeId?.fullName || item.attendeeSnapshot?.fullName,
        zoneName: item.zoneName,
        action: item.accessGranted
          ? `${item.action} allowed`
          : item.denialReason || 'Zone denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
      }));

      setItems(
        [...entryItems, ...zoneItems].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
      );
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
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Activity Operations
            </p>
            <span className="text-[11px] font-medium text-slate-400">•</span>
            <p className="text-[11px] font-semibold text-slate-500">
              Station Log
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Station Action History
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Combined entry and zone validation audits for this station.
          </p>
        </div>

        {/* Event filter */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Event Filter
              </p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Review station audits
              </h2>
            </div>

            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white sm:w-72"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Activity list + pagination */}
        <div className="space-y-4">
          <ActivityList
            title={`Validation Ledger (Page ${page})`}
            items={pagedItems}
            emptyMessage="No validation audits matching the criteria were logged today."
          />

          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm sm:flex-row">
            <p className="text-xs font-medium text-slate-500">
              Showing{' '}
              {items.length === 0 ? 0 : (page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, items.length)} of {items.length} audits
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((c) => Math.max(1, c - 1))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <div className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                {page} / {totalPages}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffActivityLogPage;