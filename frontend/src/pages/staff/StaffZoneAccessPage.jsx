import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';
import {
  CameraIcon,
  ShieldCheckIcon,
  SignalIcon,
  SignalSlashIcon,
  BoltIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  ListBulletIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import ResultCard from '../../components/staff/ResultCard';
import ActivityList from '../../components/staff/ActivityList';
import SearchBar from '../../components/staff/SearchBar';
import { getZoneLogs } from '../../api/zone';
import { getMyEvents } from '../../api/events';
import { scanStaffZone } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import {
  getAssignedZoneLabel,
  getAssignedZones,
  parseScannedValue,
  playFeedbackTone,
  triggerHaptic,
} from './staffUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const StaffZoneAccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [zoneName, setZoneName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('ENTRY');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [zoneInput, setZoneInput] = useState('');

  const [activeTab, setActiveTab] = useState('scan');
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [lastScan, setLastScan] = useState(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('entrynex:offline-zone-scans')) || [];
    } catch {
      return [];
    }
  });

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

  // Network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored. Syncing zone scans...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Offline mode activated');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Offline sync
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      const syncScans = async () => {
        const queueToProcess = [...offlineQueue];
        setOfflineQueue([]);
        localStorage.removeItem('entrynex:offline-zone-scans');

        let successfulSyncCount = 0;
        for (const scan of queueToProcess) {
          try {
            await scanStaffZone({
              qrToken: scan.qrToken,
              zone: scan.zone,
              eventId: scan.eventId,
              action: scan.action,
            });
            successfulSyncCount++;
          } catch (err) {
            console.error('Offline zone sync failure:', err);
          }
        }

        if (successfulSyncCount > 0) {
          toast.success(`Synced ${successfulSyncCount} offline zone scans`);
        }
        refreshLogs();
        fetchStats();
      };

      syncScans();
    }
  }, [isOnline, offlineQueue]);

  useEffect(() => {
    localStorage.setItem(
      'entrynex:offline-zone-scans',
      JSON.stringify(offlineQueue)
    );
  }, [offlineQueue]);

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

  useEffect(() => {
    if (assignedZones[0]) {
      setZoneName(assignedZones[0]);
      setZoneInput(assignedZones[0]);
    } else {
      setZoneName('VIP Zone');
      setZoneInput('VIP Zone');
    }
  }, [assignedZones]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
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
        zone: zoneName,
        limit: 10,
      });
      const nextLogs = (response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: getZoneDisplayName(item.zone),
        action: item.accessGranted
          ? item.action === 'EXIT'
            ? 'Zone Exit processed'
            : 'Zone Entry permitted'
          : item.denialReason || 'Access Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
        accessGranted: item.accessGranted,
      }));
      setLogs(nextLogs);
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, zoneName, getZoneDisplayName]);

  const fetchStats = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({
        eventId: selectedEventId,
        zone: zoneName,
        limit: 1,
      });
      const meta = response.data?.data?.meta || {};
      setStats({
        total: meta.totalScanned || 0,
        success: meta.allowedCount || 0,
        failed: meta.deniedCount || 0,
      });
    } catch {
      // fallback
    }
  }, [selectedEventId, zoneName]);

  useEffect(() => {
    refreshLogs();
    fetchStats();
  }, [refreshLogs, fetchStats]);

  // Socket.IO
  useEffect(() => {
    if (!selectedEventId) return;

    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId: selectedEventId });
    socket.emit('join_dashboard', { eventId: selectedEventId });

    const handleZoneUpdate = (data) => {
      if (
        data.eventId === selectedEventId &&
        String(data.zoneName || '').toLowerCase() ===
          String(zoneName || '').toLowerCase()
      ) {
        if (data.accessGranted) {
          setLastScan({
            action: data.action || 'ZONE ENTRY',
            name: data.name || 'Attendee',
            categoryName: data.categoryName || 'VIP Ticket',
            zoneName: getZoneDisplayName(data.zoneName),
            timestamp: data.timestamp || new Date(),
            processedByName: data.processedByName || 'System',
          });

          setStats((prev) => ({
            total: prev.total + 1,
            success: prev.success + 1,
            failed: prev.failed,
          }));
        } else {
          setStats((prev) => ({
            total: prev.total + 1,
            success: prev.success,
            failed: prev.failed + 1,
          }));
        }
        refreshLogs();
      }
    };

    socket.on('zone_update', handleZoneUpdate);
    return () => {
      socket.off('zone_update', handleZoneUpdate);
      socket.disconnect();
    };
  }, [selectedEventId, zoneName, getZoneDisplayName, refreshLogs]);

  const handleScan = useCallback(
    async (rawToken) => {
      const qrToken = parseScannedValue(rawToken);
      if (!qrToken || !selectedEventId || !zoneName || submitting) return;

      if (!isOnline) {
        playFeedbackTone(true);
        triggerHaptic(true);

        const simulatedAttendee = {
          fullName: 'Offline Attendee',
          categoryName: 'VIP Pass',
          checkedIn: true,
          confirmationStatus: 'confirmed',
        };

        setResult({
          state: 'success',
          attendee: simulatedAttendee,
          message:
            scanMode === 'EXIT'
              ? 'Zone Exit permitted (Offline)'
              : 'Zone Entry permitted (Offline)',
          detail:
            'Zone scan saved locally. Will sync automatically when online.',
          meta: [
            { label: 'Zone', value: getZoneDisplayName(zoneName) },
            { label: 'Mode', value: scanMode },
            { label: 'Network', value: 'Offline Cache' },
          ],
        });

        setOfflineQueue((prev) => [
          ...prev,
          {
            qrToken,
            zone: zoneName,
            eventId: selectedEventId,
            action: scanMode,
            timestamp: new Date(),
          },
        ]);

        setStats((prev) => ({
          total: prev.total + 1,
          success: prev.success + 1,
          failed: prev.failed,
        }));

        setLastScan({
          action: scanMode === 'EXIT' ? 'ZONE EXIT' : 'ZONE ENTRY',
          name: 'Offline Attendee',
          categoryName: 'VIP Pass',
          zoneName: getZoneDisplayName(zoneName),
          timestamp: new Date(),
          processedByName: user?.name || 'Staff',
        });

        return;
      }

      setSubmitting(true);
      try {
        const response = await scanStaffZone({
          qrToken,
          zone: zoneName,
          eventId: selectedEventId,
          action: scanMode,
        });

        const payload = response.data?.data || {};
        const isExit = scanMode === 'EXIT';

        setResult({
          state: payload.accessGranted ? 'success' : 'error',
          attendee: payload.attendee,
          message: payload.accessGranted
            ? isExit
              ? 'Zone Exit permitted'
              : 'Zone Entry permitted'
            : isExit
            ? 'Zone Exit Denied'
            : 'Zone Access Denied',
          detail: payload.accessGranted
            ? isExit
              ? 'Attendee exited zone successfully.'
              : 'Attendee permitted to enter zone.'
            : payload.denialReason || 'Zone validation failed.',
          meta: [
            { label: 'Zone', value: getZoneDisplayName(zoneName) },
            { label: 'Mode', value: scanMode },
            { label: 'Ticket Category', value: payload.attendee?.categoryName },
          ],
        });

        if (payload.accessGranted) {
          setLastScan({
            action: isExit ? 'ZONE EXIT' : 'ZONE ENTRY',
            name: payload.attendee?.fullName || 'Attendee',
            categoryName: payload.attendee?.categoryName || 'Standard Ticket',
            zoneName: getZoneDisplayName(zoneName),
            timestamp: new Date(),
            processedByName: user?.name || 'Staff',
          });
        }

        playFeedbackTone(payload.accessGranted);
        triggerHaptic(payload.accessGranted);
        setManualToken('');
        refreshLogs();
        fetchStats();
      } catch (error) {
        const data = error?.response?.data || {};
        const detailMsg = data.message || 'Zone permission validation failed.';

        setResult({
          state: 'error',
          attendee: data.data?.attendee || null,
          message: 'Access Denied',
          detail: detailMsg,
          meta: [
            { label: 'Zone', value: getZoneDisplayName(zoneName) },
            { label: 'Mode', value: scanMode },
            { label: 'Reason', value: detailMsg },
          ],
        });

        playFeedbackTone(false);
        triggerHaptic(false);
        refreshLogs();
        fetchStats();
      } finally {
        setSubmitting(false);
      }
    },
    [
      zoneName,
      selectedEventId,
      submitting,
      scanMode,
      isOnline,
      user,
      fetchStats,
      refreshLogs,
      getZoneDisplayName,
    ]
  );

  const tabItems = [
    { id: 'scan', label: 'Scanner', icon: CameraIcon },
    { id: 'manual', label: 'Manual', icon: DevicePhoneMobileIcon },
    { id: 'stats', label: 'Stats', icon: ChartBarIcon },
    { id: 'logs', label: 'Logs', icon: ListBulletIcon },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'animate-pulse border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {isOnline ? (
              <SignalIcon className="h-3.5 w-3.5" />
            ) : (
              <SignalSlashIcon className="h-3.5 w-3.5" />
            )}
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Zone Access
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Zone Terminal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Active zone:{' '}
            <span className="font-semibold text-slate-800">
              {getZoneDisplayName(zoneName)}
            </span>
          </p>
        </div>

        {/* Last Scan Card */}
        {lastScan ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  lastScan.action === 'ZONE EXIT'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                Last {lastScan.action === 'ZONE EXIT' ? 'Zone Exit' : 'Zone Entry'}
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                {new Date(lastScan.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Attendee
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                  {lastScan.name}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Ticket Type
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {lastScan.categoryName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Zone
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-blue-600">
                  {lastScan.zoneName}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Staff
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-600">
                  {lastScan.processedByName || 'System'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center">
            <p className="text-xs font-medium text-slate-400">
              No successful scans yet
            </p>
          </div>
        )}

        {/* Tabs */}
        <nav className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setResult({ state: 'idle' });
                  setLogsPage(1);
                }}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-3 text-[10px] font-semibold uppercase tracking-wider transition sm:flex-row sm:gap-1.5 sm:text-xs ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ===================== TAB CONTENT ===================== */}
        <div className="space-y-5">
          {/* SCANNER TAB */}
          {activeTab === 'scan' && (
            <div className="space-y-5">
              {/* Entry / Exit toggle — both blue */}
              <div className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setScanMode('ENTRY')}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    scanMode === 'ENTRY'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  Zone Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('EXIT')}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    scanMode === 'EXIT'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  Zone Exit
                </button>
              </div>

              {/* Camera */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
                <div className="aspect-[4/3] w-full sm:aspect-video">
                  <QRScannerComponent
                    onScanSuccess={handleScan}
                    onScanError={() => {}}
                    fps={12}
                    qrbox={260}
                  />
                </div>
              </div>

              {result.state !== 'idle' && (
                <ResultCard
                  state={result.state}
                  attendee={result.attendee}
                  message={result.message}
                  detail={result.detail}
                  meta={result.meta}
                />
              )}
            </div>
          )}

          {/* MANUAL TAB */}
          {activeTab === 'manual' && (
            <div className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Manual Zone Permission
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Type or paste the QR token below. Camera is paused to save
                  battery.
                </p>
              </div>

              <div className="flex gap-1 rounded-2xl bg-slate-50 p-1.5">
                <button
                  type="button"
                  onClick={() => setScanMode('ENTRY')}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    scanMode === 'ENTRY'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-blue-700'
                  }`}
                >
                  Zone Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('EXIT')}
                  className={`flex-1 rounded-xl py-3 text-xs font-semibold uppercase tracking-wider transition ${
                    scanMode === 'EXIT'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-blue-700'
                  }`}
                >
                  Zone Exit
                </button>
              </div>

              <div className="space-y-4">
                <SearchBar
                  value={manualToken}
                  onChange={setManualToken}
                  placeholder="Paste / type QR token here..."
                  autoFocus
                />

                <button
                  type="button"
                  disabled={!manualToken.trim() || submitting}
                  onClick={() => handleScan(manualToken)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-blue-700 disabled:opacity-40"
                >
                  <BoltIcon className="h-5 w-5" />
                  {submitting ? 'Validating...' : 'Verify Zone Token'}
                </button>
              </div>

              {result.state !== 'idle' && (
                <div className="border-t border-slate-100 pt-5">
                  <ResultCard
                    state={result.state}
                    attendee={result.attendee}
                    message={result.message}
                    detail={result.detail}
                    meta={result.meta}
                  />
                </div>
              )}
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Active Zone Setup
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure zone parameters
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              </div>

              {/* Metrics */}
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Today’s Zone Metrics
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Scans
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-blue-600">
                      {stats.total}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Total today</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Allowed
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">
                      {stats.success}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Successful</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Denied
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-rose-600">
                      {stats.failed}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Blocked</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' &&
            (() => {
              const pageSize = 10;
              const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
              const pagedLogs = logs.slice(
                (logsPage - 1) * pageSize,
                logsPage * pageSize
              );

              return (
                <div className="space-y-4">
                  <ActivityList
                    title={`Zone Access Scans (Page ${logsPage})`}
                    items={pagedLogs}
                    emptyMessage="No zone scanning history today."
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

export default StaffZoneAccessPage;