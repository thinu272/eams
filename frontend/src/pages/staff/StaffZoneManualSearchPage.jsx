import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, MagnifyingGlassIcon, UserIcon, IdentificationIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import SearchBar from '../../components/staff/SearchBar';
import ActivityList from '../../components/staff/ActivityList';
import { scanStaffZone } from '../../api/staff';
import { getMyEvents } from '../../api/events';
import { searchStaffAttendees } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { buildAssetUrl, getAssignedZones } from './staffUtils';
import toast from 'react-hot-toast';
import { getZoneLogs } from '../../api/zone';
import { useNavigate } from 'react-router-dom';

const StaffZoneManualSearchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [zoneName, setZoneName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [zoneInput, setZoneInput] = useState('');

  const currentEvent = useMemo(() => events.find((e) => e._id === selectedEventId), [events, selectedEventId]);

  const getZoneDisplayName = useCallback((zone) => {
    if (!currentEvent || !currentEvent.zones) return zone;
    const found = currentEvent.zones.find((z) => z.id === zone || z.name === zone);
    return found ? found.name : zone;
  }, [currentEvent]);

  const assignedZones = useMemo(() => getAssignedZones(user), [user]);
  const zoneLocked = assignedZones.length > 0;

  useEffect(() => {
    if (zoneLocked && !zoneName) {
      setZoneName(assignedZones[0]);
      setZoneInput(assignedZones[0]);
    }
  }, [zoneLocked, assignedZones, zoneName]);

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
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({ eventId: selectedEventId, zoneId: zoneName, limit: 50 });
      setLogs((response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName || item.attendeeSnapshot?.fullName,
        zoneName: item.zoneName,
        action: item.accessGranted ? (item.action === 'EXIT' ? 'Exited zone' : 'Entered zone') : item.denialReason || 'Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
      })));
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, zoneName]);

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

  const handleZoneAction = async (attendee, action) => {
    if (!zoneName) {
      toast.error('Please select a zone first.');
      return;
    }
    
    try {
      await scanStaffZone({ qrToken: attendee.qrToken, zone: zoneName, eventId: selectedEventId, action });
      toast.success(`${attendee.fullName} ${action === 'ENTRY' ? 'entered' : 'exited'} ${getZoneDisplayName(zoneName)}.`);
      refreshLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || `Manual zone ${action.toLowerCase()} failed.`);
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
        
        {/* Simple Premium Header */}
        <section className="rounded-[28px] bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-5 lg:p-6 text-white shadow-xl border border-emerald-500/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Zone Operations</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getZoneDisplayName(zoneName)}</span>
              </div>
              <h1 className="mt-1 text-2xl lg:text-3xl font-black tracking-tight text-white">Zone Registry Lookup</h1>
            </div>
          </div>
        </section>

        <div className="flex flex-col lg:grid lg:grid-cols-[1.1fr,0.9fr] lg:gap-6 space-y-6 lg:space-y-0">
          
          {/* SEARCH CONTROLS */}
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[0.45fr,1fr]">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Select Event</label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => handleEventChange(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                    >
                      {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Select Zone</label>
                    {zoneLocked ? (
                      assignedZones.length > 1 ? (
                        <select
                          value={zoneName}
                          onChange={(e) => setZoneName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                        >
                          {assignedZones.map((zone) => (
                            <option key={zone} value={zone}>{getZoneDisplayName(zone)}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-700">
                          {getZoneDisplayName(zoneName)}
                        </div>
                      )
                    ) : (
                      <input
                        value={zoneInput}
                        onChange={(e) => setZoneInput(e.target.value)}
                        onBlur={() => setZoneName(zoneInput)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setZoneName(zoneInput); }}
                        placeholder="Zone name"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Search Query</label>
                  <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone, NIC, passport..." autoFocus />
                </div>
              </div>

              {/* Secure Zone Search lists */}
              <div className="mt-6 space-y-4">
                {searching && (
                  <div className="rounded-2xl border border-slate-150 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-500 flex items-center justify-center gap-3">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900" />
                    Searching zone registry...
                  </div>
                )}

                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <div className="rounded-3xl border-2 border-dashed border-slate-200 px-4 py-12 text-center text-sm font-bold text-slate-400 leading-relaxed">
                    No registry matched your query.<br/>
                    <span className="text-xs font-medium text-slate-400">Please verify attendee access tags or category settings.</span>
                  </div>
                )}

                {!searching && search.trim().length < 2 && (
                  <div className="rounded-3xl border border-slate-150 bg-slate-50 px-4 py-12 text-center text-sm font-bold text-slate-400 flex flex-col items-center justify-center gap-2">
                    <IdentificationIcon className="h-8 w-8 text-slate-300" />
                    <span>Awaiting lookup query...</span>
                    <span className="text-xs font-medium text-slate-400">Type at least 2 characters to initiate secure restricted zone search.</span>
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
                          <p className="mt-1 text-sm font-semibold text-slate-500 tracking-wide">{attendee.categoryName || 'General VIP'}</p>
                          
                          <div className="mt-3.5 flex flex-wrap gap-2">
                            <span className={`rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${
                              attendee.confirmationStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {attendee.confirmationStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0">
                        <button
                          type="button"
                          onClick={() => handleZoneAction(attendee, 'ENTRY')}
                          className="w-full md:w-auto rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition flex items-center justify-center gap-2"
                        >
                          <CheckCircleIcon className="h-5 w-5" />
                          Log Zone Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleZoneAction(attendee, 'EXIT')}
                          className="w-full md:w-auto rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition flex items-center justify-center gap-2"
                        >
                          <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
                          Log Zone Exit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ZONE ACTIONS RECENT LOG LIST */}
          {(() => {
            const pageSize = 5;
            const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
            const pagedLogs = logs.slice((logsPage - 1) * pageSize, logsPage * pageSize);
            return (
              <div className="space-y-4">
                <ActivityList title={`Recent Zone Registry Actions (Page ${logsPage})`} items={pagedLogs} emptyMessage="Manual zone check-ins will show here." />
                
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

export default StaffZoneManualSearchPage;
