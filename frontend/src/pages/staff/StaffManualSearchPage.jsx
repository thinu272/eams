import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, MagnifyingGlassIcon, UserIcon, IdentificationIcon, PhoneIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import SearchBar from '../../components/staff/SearchBar';
import ActivityList from '../../components/staff/ActivityList';
import { checkInAttendee, checkOutAttendee, getEntryLogs } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { searchStaffAttendees } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { buildAssetUrl, getAssignedGateLabel } from './staffUtils';
import toast from 'react-hot-toast';

const StaffManualSearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
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
    setLogsPage(1);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getEntryLogs({ eventId: selectedEventId, gateId: gateName, limit: 50 });
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
        
        {/* Simple Premium Header with Status Bar */}
        <section className="rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 lg:p-6 text-white shadow-xl border border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Search Operations</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{gateName}</span>
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-black tracking-tight text-white">Manual Lookup</h1>
            </div>
          </div>
        </section>

        <div className="flex flex-col lg:grid lg:grid-cols-[1.1fr,0.9fr] lg:gap-6 space-y-6 lg:space-y-0">
          
          {/* SEARCH SECTORS (Primary) */}
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[0.45fr,1fr]">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Select Event</label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                  >
                    {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Search Query</label>
                  <SearchBar value={search} onChange={setSearch} placeholder="Attendee name, phone number, email..." autoFocus />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                <MagnifyingGlassIcon className="h-5 w-5 text-cyan-600 animate-pulse" />
                Gate Access Point: <span className="text-slate-800">{getAssignedGateLabel(user)}</span>
              </div>

              {/* Lookup Card Result Lists */}
              <div className="mt-6 space-y-4">
                {searching && (
                  <div className="rounded-2xl border border-slate-150 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500 flex items-center justify-center gap-3">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900" />
                    Searching event registry...
                  </div>
                )}

                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <div className="rounded-3xl border-2 border-dashed border-slate-200 px-4 py-12 text-center text-sm font-bold text-slate-400 leading-relaxed">
                    No registry matched your query.<br/>
                    <span className="text-xs font-medium text-slate-400">Please double-check attendee name or confirmation details.</span>
                  </div>
                )}

                {!searching && search.trim().length < 2 && (
                  <div className="rounded-3xl border border-slate-150 bg-slate-50 px-4 py-12 text-center text-sm font-bold text-slate-400 flex flex-col items-center justify-center gap-2">
                    <IdentificationIcon className="h-8 w-8 text-slate-300" />
                    <span>Awaiting lookup query...</span>
                    <span className="text-xs font-medium text-slate-400">Type at least 2 characters to initiate secure registry search.</span>
                  </div>
                )}

                {results.map((attendee) => (
                  <div key={attendee._id} className="rounded-[28px] border border-slate-200 bg-slate-50/50 p-5 hover:bg-slate-50 transition duration-200">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 shadow-inner">
                          {attendee.photo ? (
                            <img src={buildAssetUrl(attendee.photo)} alt={attendee.fullName} className="h-full w-full object-cover" />
                          ) : (
                            <UserIcon className="h-8 w-8 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xl font-black text-slate-900 leading-tight">{attendee.fullName}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-500 tracking-wide">{attendee.categoryName || 'General Category'}</p>
                          
                          <div className="mt-3.5 flex flex-wrap gap-2">
                            <span className={`rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                              attendee.confirmationStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {attendee.confirmationStatus || 'Pending'}
                            </span>
                            <span className={`rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                              attendee.checkedIn ? 'bg-indigo-100 text-indigo-800' : 'bg-cyan-100 text-cyan-800'
                            }`}>
                              {attendee.checkedIn ? 'Checked In' : 'Not Checked In'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                        <button
                          type="button"
                          onClick={() => handleCheckIn(attendee)}
                          disabled={attendee.checkedIn}
                          className="w-full md:w-auto rounded-2xl bg-slate-900 hover:bg-slate-800 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                          Force Entry Check-In
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCheckOut(attendee)}
                          disabled={!attendee.checkedIn}
                          className="w-full md:w-auto rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
                          Force Exit Check-Out
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* STATION RECENT LOG ACTIVITY */}
          {(() => {
            const pageSize = 5;
            const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
            const pagedLogs = logs.slice((logsPage - 1) * pageSize, logsPage * pageSize);
            return (
              <div className="space-y-4">
                <ActivityList title={`Recent Manual Registry Changes (Page ${logsPage})`} items={pagedLogs} emptyMessage="No manual registry entries logged today." />
                
                {logs.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Showing {logs.length === 0 ? 0 : (logsPage - 1) * pageSize + 1}-{Math.min(logsPage * pageSize, logs.length)} of {logs.length} audits
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={logsPage <= 1}
                        onClick={() => setLogsPage((current) => Math.max(1, current - 1))}
                        className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 transition"
                      >
                        Prev
                      </button>
                      <div className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 uppercase tracking-wider">
                        Page {logsPage} / {totalPages}
                      </div>
                      <button
                        type="button"
                        disabled={logsPage >= totalPages}
                        onClick={() => setLogsPage((current) => Math.min(totalPages, current + 1))}
                        className="rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffManualSearchPage;
