import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import SearchBar from '../../components/staff/SearchBar';
import ActivityList from '../../components/staff/ActivityList';
import { checkInAttendee, checkOutAttendee, getEntryLogs } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { searchStaffAttendees } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { buildAssetUrl, getAssignedGateLabel } from './staffUtils';
import toast from 'react-hot-toast';

const StaffManualSearchPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searching, setSearching] = useState(false);

  const gateName = useMemo(() => (user?.assignedGates || [])[0] || 'Main Gate', [user]);

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

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getEntryLogs({ eventId: selectedEventId, gateId: gateName, limit: 10 });
      setLogs((response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: item.gateName || item.zoneName,
        action: item.accessGranted ? (item.action === 'check_out' ? 'Checked out' : 'Checked in') : item.denialReason || 'Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
      })));
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, gateName]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  useEffect(() => {
    if (!selectedEventId || search.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchStaffAttendees({ eventId: selectedEventId, q: search.trim(), limit: 12 });
        setResults(response.data?.data?.attendees || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, selectedEventId]);

  const handleCheckIn = async (attendee) => {
    try {
      await checkInAttendee({ attendeeId: attendee._id, gateId: gateName, gateName, method: 'manual' });
      toast.success(`${attendee.fullName} checked in.`);
      setResults((current) => current.map((item) => item._id === attendee._id ? { ...item, checkedIn: true } : item));
      refreshLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-in failed.');
    }
  };

  const handleCheckOut = async (attendee) => {
    try {
      await checkOutAttendee({ attendeeId: attendee._id, gateId: gateName, gateName, method: 'manual' });
      toast.success(`${attendee.fullName} checked out.`);
      setResults((current) => current.map((item) => item._id === attendee._id ? { ...item, checkedIn: false } : item));
      refreshLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-out failed.');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[24px] lg:rounded-[32px] bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-5 lg:p-8 text-white shadow-xl">
          <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Staff Operations</p>
          <h1 className="mt-2 text-3xl lg:text-5xl font-black tracking-tight">Manual Search</h1>
          <p className="mt-3 max-w-2xl text-xs lg:text-sm font-medium text-slate-300 leading-relaxed">
            Search by attendee name or phone, review ticket state, and perform manual check-in when queue conditions require it.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr] xl:grid-cols-[1.15fr,0.85fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-[0.4fr,1fr]">
              <select
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 lg:py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500"
              >
                {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
              </select>
              <div className="self-start w-full">
                <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone, email..." autoFocus />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              <MagnifyingGlassIcon className="h-4 w-4" />
              Assigned gate: {getAssignedGateLabel(user)}
            </div>

            <div className="mt-6 space-y-4">
              {searching && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                  Searching attendees...
                </div>
              )}

              {!searching && search.trim().length >= 2 && results.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-medium text-slate-500">
                  No attendee matched your search.
                </div>
              )}

              {results.map((attendee) => (
                <div key={attendee._id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {attendee.photo ? (
                      <img src={buildAssetUrl(attendee.photo)} alt={attendee.fullName} className="h-20 w-20 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
                        <UserIcon className="h-10 w-10" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-xl font-black text-slate-900">{attendee.fullName}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">{attendee.phone || 'No phone'} • {attendee.categoryName || 'Unknown category'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${attendee.confirmationStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {attendee.confirmationStatus || 'Pending'}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${attendee.checkedIn ? 'bg-rose-100 text-rose-700' : 'bg-cyan-100 text-cyan-700'}`}>
                          {attendee.checkedIn ? 'Already used' : 'Not used'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleCheckIn(attendee)}
                        disabled={attendee.checkedIn}
                        className="rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckCircleIcon className="mr-2 inline h-5 w-5" />
                        Manual Check-In
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCheckOut(attendee)}
                        disabled={!attendee.checkedIn}
                        className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ArrowRightStartOnRectangleIcon className="mr-2 inline h-5 w-5" />
                        Manual Check-Out
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <ActivityList title="Recent Manual Actions" items={logs.slice(0, 5)} emptyMessage="Manual check-ins will appear here." />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffManualSearchPage;
