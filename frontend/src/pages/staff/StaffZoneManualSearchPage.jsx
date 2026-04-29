import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, MagnifyingGlassIcon, UserIcon } from '@heroicons/react/24/solid';
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

const StaffZoneManualSearchPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [zoneName, setZoneName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
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
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({ eventId: selectedEventId, zoneId: zoneName, limit: 10 });
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
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Staff Operations</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Zone Manual Search</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
            Search by attendee name, phone, NIC, or passport to manually log zone entries and exits.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[0.4fr,1fr]">
              <div className="space-y-3">
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                >
                  {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
                </select>
                
                {zoneLocked ? (
                  assignedZones.length > 1 ? (
                    <select
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-emerald-700 outline-none focus:border-emerald-500"
                    >
                      {assignedZones.map((zone) => (
                        <option key={zone} value={zone}>{getZoneDisplayName(zone)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">{getZoneDisplayName(zoneName)}</div>
                  )
                ) : (
                  <input
                    value={zoneInput}
                    onChange={(e) => setZoneInput(e.target.value)}
                    onBlur={() => setZoneName(zoneInput)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setZoneName(zoneInput); }}
                    placeholder="Zone name"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  />
                )}
              </div>
              <div className="self-start w-full">
                <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone, NIC, passport..." autoFocus />
              </div>
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
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleZoneAction(attendee, 'ENTRY')}
                        className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-500"
                      >
                        <CheckCircleIcon className="mr-2 inline h-5 w-5" />
                        Zone Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => handleZoneAction(attendee, 'EXIT')}
                        className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
                      >
                        <ArrowRightStartOnRectangleIcon className="mr-2 inline h-5 w-5" />
                        Zone Exit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <ActivityList title={`Recent Zone Actions`} items={logs.slice(0, 5)} emptyMessage="Manual zone logs will appear here." />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffZoneManualSearchPage;
