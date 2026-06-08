import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ActivityList from '../../components/staff/ActivityList';
import { getEntryLogs } from '../../api/entry';
import { getZoneLogs } from '../../api/zone';
import { getMyEvents } from '../../api/events';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';

const StaffActivityLogPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      <div className="space-y-6 max-w-6xl mx-auto px-1">
        
        {/* Simple Minimal Back & Status Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>
        </div>
        
        {/* Simple Premium Header */}
        <section className="rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 lg:p-6 text-white shadow-xl border border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Activity Operations</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Station Log</span>
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-black tracking-tight text-white">Station Action History</h1>
            </div>
          </div>
        </section>

        {/* Filter Accordion style */}
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Select Event Filter</p>
              <h2 className="text-lg font-black text-slate-900 mt-1">Review active station audits</h2>
            </div>
            
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
            >
              {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
            </select>
          </div>
        </section>

        {/* Lists & pagination */}
        <section className="space-y-4">
          <ActivityList title={`Validation Ledger (Page ${page})`} items={pagedItems} emptyMessage="No validation audits matching the criteria were logged today." />
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white px-6 py-4.5 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Showing {items.length === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, items.length)} of {items.length} audits
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 transition"
              >
                Prev
              </button>
              <div className="rounded-xl bg-slate-100 px-4.5 py-2.5 text-xs font-black text-slate-700 uppercase tracking-wider">
                Page {page} / {totalPages}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 transition"
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
