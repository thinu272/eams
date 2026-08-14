import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightStartOnRectangleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  UserIcon,
  IdentificationIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
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
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [zoneName, setZoneName] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [zoneInput, setZoneInput] = useState('');

  const currentEvent = useMemo(
    () => events.find((e) => e._id === selectedEventId),
    [events, selectedEventId]
  );

  const getZoneDisplayName = useCallback(
    (zone) => {
      if (!currentEvent || !currentEvent.zones) return zone;
      const found = currentEvent.zones.find(
        (z) => z.id === zone || z.name === zone
      );
      return found ? found.name : zone;
    },
    [currentEvent]
  );

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
    setLogsPage(1);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(
      new CustomEvent('entrynex:event-select', { detail: nextId })
    );
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({
        eventId: selectedEventId,
        zoneId: zoneName,
        limit: 50,
      });
      setLogs(
        (response.data?.data?.logs || []).map((item) => ({
          id: item._id,
          attendeeName:
            item.attendee?.fullName ||
            item.snapshot?.fullName ||
            item.attendeeSnapshot?.fullName,
          zoneName: item.zoneName,
          action: item.accessGranted
            ? item.action === 'EXIT'
              ? 'Exited zone'
              : 'Entered zone'
            : item.denialReason || 'Denied',
          status: item.accessGranted ? 'success' : 'error',
          timestamp: item.timestamp,
        }))
      );
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
        const response = await searchStaffAttendees({
          eventId: selectedEventId,
          q: search.trim(),
          limit: 12,
        });
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
      await scanStaffZone({
        qrToken: attendee.qrToken,
        zone: zoneName,
        eventId: selectedEventId,
        action,
      });
      toast.success(
        `${attendee.fullName} ${
          action === 'ENTRY' ? 'entered' : 'exited'
        } ${getZoneDisplayName(zoneName)}.`
      );
      refreshLogs();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `Manual zone ${action.toLowerCase()} failed.`
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
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
              Zone Operations
            </p>
            <span className="text-[11px] font-medium text-slate-400">•</span>
            <p className="text-[11px] font-semibold text-slate-500">
              {getZoneDisplayName(zoneName) || 'No zone selected'}
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Zone Registry Lookup
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Search attendees and manually log zone entry or exit.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          {/* LEFT — Search + Results */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
              {/* Filters */}
              <div className="grid gap-4 sm:grid-cols-[0.4fr_1fr]">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Select Event
                    </label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => handleEventChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
                    >
                      {events.map((event) => (
                        <option key={event._id} value={event._id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Select Zone
                    </label>
                    {zoneLocked ? (
                      assignedZones.length > 1 ? (
                        <select
                          value={zoneName}
                          onChange={(e) => setZoneName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
                        >
                          {assignedZones.map((zone) => (
                            <option key={zone} value={zone}>
                              {getZoneDisplayName(zone)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                          {getZoneDisplayName(zoneName)}
                        </div>
                      )
                    ) : (
                      <input
                        value={zoneInput}
                        onChange={(e) => setZoneInput(e.target.value)}
                        onBlur={() => setZoneName(zoneInput)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setZoneName(zoneInput);
                        }}
                        placeholder="Zone name"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Search Query
                  </label>
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Name, phone, NIC, passport..."
                    autoFocus
                  />
                </div>
              </div>

              {/* Results */}
              <div className="mt-6 space-y-3">
                {searching && (
                  <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-10 text-sm font-medium text-slate-500">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                    Searching zone registry...
                  </div>
                )}

                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      No matches found
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Verify attendee access tags or category settings
                    </p>
                  </div>
                )}

                {!searching && search.trim().length < 2 && (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-12 text-center">
                    <IdentificationIcon className="h-8 w-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                      Awaiting search query
                    </p>
                    <p className="text-xs text-slate-400">
                      Type at least 2 characters to search
                    </p>
                  </div>
                )}

                {results.map((attendee) => (
                  <div
                    key={attendee._id}
                    className="rounded-2xl border border-slate-200/70 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {attendee.photo ? (
                            <img
                              src={buildAssetUrl(attendee.photo)}
                              alt={attendee.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserIcon className="h-7 w-7 text-slate-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                            {attendee.fullName}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-slate-500">
                            {attendee.categoryName || 'General VIP'}
                          </p>

                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                attendee.confirmationStatus === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {attendee.confirmationStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => handleZoneAction(attendee, 'ENTRY')}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-blue-700"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Log Zone Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => handleZoneAction(attendee, 'EXIT')}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
                        >
                          <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                          Log Zone Exit
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Activity Logs */}
          {(() => {
            const pageSize = 5;
            const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
            const pagedLogs = logs.slice(
              (logsPage - 1) * pageSize,
              logsPage * pageSize
            );

            return (
              <div className="space-y-4">
                <ActivityList
                  title={`Recent Zone Actions (Page ${logsPage})`}
                  items={pagedLogs}
                  emptyMessage="Manual zone actions will appear here."
                />

                {logs.length > 0 && (
                  <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm sm:flex-row">
                    <p className="text-xs font-medium text-slate-500">
                      Showing{' '}
                      {logs.length === 0
                        ? 0
                        : (logsPage - 1) * pageSize + 1}
                      –{Math.min(logsPage * pageSize, logs.length)} of{' '}
                      {logs.length}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={logsPage <= 1}
                        onClick={() =>
                          setLogsPage((c) => Math.max(1, c - 1))
                        }
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <div className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                        {logsPage} / {totalPages}
                      </div>
                      <button
                        type="button"
                        disabled={logsPage >= totalPages}
                        onClick={() =>
                          setLogsPage((c) => Math.min(totalPages, c + 1))
                        }
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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