import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';
import { 
  ArrowsRightLeftIcon, 
  CameraIcon, 
  LightBulbIcon, 
  ShieldCheckIcon,
  Cog6ToothIcon,
  SignalIcon,
  SignalSlashIcon,
  ClockIcon,
  BoltIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  ListBulletIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import ResultCard from '../../components/staff/ResultCard';
import ActivityList from '../../components/staff/ActivityList';
import SearchBar from '../../components/staff/SearchBar';
import { getZoneLogs } from '../../api/zone';
import { getMyEvents } from '../../api/events';
import { scanStaffZone } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { getAssignedZoneLabel, getAssignedZones, parseScannedValue, playFeedbackTone, triggerHaptic } from './staffUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const StaffZoneAccessPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [zoneName, setZoneName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('ENTRY'); // 'ENTRY' | 'EXIT'
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [zoneInput, setZoneInput] = useState('');

  // Tab State for distraction-free UI/UX
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual' | 'stats' | 'logs'
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [lastScan, setLastScan] = useState(null);

  // Offline Sync State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('entrynex:offline-zone-scans')) || [];
    } catch {
      return [];
    }
  });

  const currentEvent = useMemo(() => events.find((e) => e._id === selectedEventId), [events, selectedEventId]);

  const getZoneDisplayName = useCallback((zone) => {
    if (!currentEvent || !currentEvent.zones) return zone;
    const found = currentEvent.zones.find((z) => z.id === zone || z.name === zone);
    return found ? found.name : zone;
  }, [currentEvent]);

  const assignedZones = useMemo(() => getAssignedZones(user), [user]);
  const zoneLocked = assignedZones.length > 0;

  // Track network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet connection restored. Syncing zone scans...');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Network disconnected. Operating in offline durability mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Offline Queue when back online
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
          toast.success(`Successfully synchronized ${successfulSyncCount} offline zone scans to cloud!`);
        }
        refreshLogs();
        fetchStats();
      };

      syncScans();
    }
  }, [isOnline, offlineQueue]);

  // Save offline queue changes
  useEffect(() => {
    localStorage.setItem('entrynex:offline-zone-scans', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

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
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({ eventId: selectedEventId, zone: zoneName, limit: 10 });
      const nextLogs = (response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: getZoneDisplayName(item.zone),
        action: item.accessGranted
          ? (item.action === 'EXIT' ? 'Zone Exit processed' : 'Zone Entry permitted')
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
      const response = await getZoneLogs({ eventId: selectedEventId, zone: zoneName, limit: 1 });
      const meta = response.data?.data?.meta || {};
      setStats({
        total: meta.totalScanned || 0,
        success: meta.allowedCount || 0,
        failed: meta.deniedCount || 0
      });
    } catch {
      // fallback metrics
    }
  }, [selectedEventId, zoneName]);

  useEffect(() => {
    refreshLogs();
    fetchStats();
  }, [refreshLogs, fetchStats]);

  // Socket.IO real-time zone listeners
  useEffect(() => {
    if (!selectedEventId) return;

    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId: selectedEventId });
    socket.emit('join_dashboard', { eventId: selectedEventId });

    const handleZoneUpdate = (data) => {
      if (data.eventId === selectedEventId && String(data.zoneName || '').toLowerCase() === String(zoneName || '').toLowerCase()) {
        if (data.accessGranted) {
          setLastScan({
            action: data.action || 'ZONE ENTRY',
            name: data.name || 'Attendee',
            categoryName: data.categoryName || 'VIP Ticket',
            zoneName: getZoneDisplayName(data.zoneName),
            timestamp: data.timestamp || new Date(),
            processedByName: data.processedByName || 'System',
          });

          setStats(prev => ({
            total: prev.total + 1,
            success: prev.success + 1,
            failed: prev.failed
          }));
        } else {
          setStats(prev => ({
            total: prev.total + 1,
            success: prev.success,
            failed: prev.failed + 1
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
  }, [selectedEventId, zoneName, getZoneDisplayName]);

  const handleScan = useCallback(async (rawToken) => {
    const qrToken = parseScannedValue(rawToken);
    if (!qrToken || !selectedEventId || !zoneName || submitting) return;

    // --- OFFLINE SCAN ROUTING ---
    if (!isOnline) {
      playFeedbackTone(true);
      triggerHaptic(true);

      const simulatedAttendee = {
        fullName: 'Offline Attendee',
        categoryName: 'VIP Pass',
        checkedIn: true,
        confirmationStatus: 'confirmed'
      };

      setResult({
        state: 'success',
        attendee: simulatedAttendee,
        message: scanMode === 'EXIT' ? 'Zone Exit permitted (Offline)' : 'Zone Entry permitted (Offline)',
        detail: 'Zone scan saved locally. Syncing will occur automatically when online.',
        meta: [
          { label: 'Zone', value: getZoneDisplayName(zoneName) },
          { label: 'Mode', value: scanMode },
          { label: 'Network', value: 'Offline Cache' },
        ],
      });

      setOfflineQueue(prev => [
        ...prev,
        {
          qrToken,
          zone: zoneName,
          eventId: selectedEventId,
          action: scanMode,
          timestamp: new Date()
        }
      ]);

      setStats(prev => ({
        total: prev.total + 1,
        success: prev.success + 1,
        failed: prev.failed
      }));

      setLastScan({
        action: scanMode === 'EXIT' ? 'ZONE EXIT' : 'ZONE ENTRY',
        name: 'Offline Attendee',
        categoryName: 'VIP Pass',
        zoneName: getZoneDisplayName(zoneName),
        timestamp: new Date(),
        processedByName: user?.name || 'Staff'
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
          ? (isExit ? 'Zone Exit permitted' : 'Zone Entry permitted')
          : (isExit ? 'Zone Exit Denied' : 'Zone Access Denied'),
        detail: payload.accessGranted
          ? (isExit ? 'Attendee exited zone successfully.' : 'Attendee permitted to enter zone.')
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
          processedByName: user?.name || 'Staff'
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
  }, [zoneName, selectedEventId, submitting, scanMode, isOnline, user, fetchStats, refreshLogs, getZoneDisplayName]);

  const tabItems = [
    { id: 'scan', label: 'Scanner', icon: CameraIcon },
    { id: 'manual', label: 'Manual Key', icon: DevicePhoneMobileIcon },
    { id: 'stats', label: 'Stats & Setup', icon: ChartBarIcon },
    { id: 'logs', label: 'Activity Logs', icon: ListBulletIcon }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto px-1">
        
        {/* Simple Minimal Back & Status Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>

          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${
              isOnline ? 'text-emerald-500' : 'text-rose-500 animate-pulse'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Minimal Operations Header */}
        <div className="text-center py-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Zone Access Console</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            Zone Area: <span className="text-emerald-600 font-black">{getZoneDisplayName(zoneName)}</span>
          </p>
        </div>

        {/* Real-time Last Scanned Attendee Card */}
        {lastScan ? (
          <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-5 shadow-lg space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Ambient emerald glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${
                lastScan.action === 'ZONE EXIT' ? 'bg-rose-500/20 text-rose-350' : 'bg-emerald-500/20 text-emerald-350'
              }`}>
                ● Last {lastScan.action === 'ZONE EXIT' ? 'Zone Exit' : 'Zone Entry'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {new Date(lastScan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Attendee Name</p>
                <p className="text-sm font-black text-white mt-0.5 truncate">{lastScan.name}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Ticket Type</p>
                <p className="text-sm font-semibold text-slate-300 mt-0.5 truncate">{lastScan.categoryName}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Scanned Location</p>
                <p className="text-sm font-black text-emerald-450 mt-0.5 truncate">{lastScan.zoneName}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Staff Member</p>
                <p className="text-sm font-semibold text-slate-300 mt-0.5 truncate">{lastScan.processedByName || 'System'}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4.5 text-center shadow-inner">
            <p className="text-xs text-slate-400 font-black uppercase tracking-wider">No successful scans registered yet</p>
          </div>
        )}

        {/* Unified Premium Tab Bar */}
        <nav className="flex rounded-2xl bg-slate-100 p-1.5 gap-1 shadow-inner">
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
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition ${
                  active 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/30'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Tab Contents */}
        <div className="space-y-6">

          {/* 1. CAMERA SCANNER TAB */}
          {activeTab === 'scan' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Quick mode indicators (Zone Entry / Exit) */}
              <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setScanMode('ENTRY')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'ENTRY'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Zone Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('EXIT')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'EXIT'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Zone Exit
                </button>
              </div>

              {/* Distraction-Free Camera Viewfinder Component */}
              <div className="rounded-[32px] border-4 border-slate-900 bg-black overflow-hidden shadow-2xl relative aspect-[4/3] sm:aspect-square">
                <QRScannerComponent onScanSuccess={handleScan} onScanError={() => {}} fps={12} qrbox={260} />
              </div>

              {/* Dynamic validation result overlay */}
              {result.state !== 'idle' && (
                <div className="animate-slide-up">
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

          {/* 2. MANUAL KEY IN TAB */}
          {activeTab === 'manual' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-black text-slate-900">Manual Zone Permission</h2>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                  Type or paste the attendee's QR token below to complete zone validation. Camera viewfinder is turned off to save battery.
                </p>
              </div>

              <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setScanMode('ENTRY')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'ENTRY'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Zone Entry
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('EXIT')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'EXIT'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Zone Exit
                </button>
              </div>

              <div className="space-y-4">
                <SearchBar value={manualToken} onChange={setManualToken} placeholder="Paste/Type QR token code here..." autoFocus />
                
                <button
                  type="button"
                  disabled={!manualToken.trim() || submitting}
                  onClick={() => handleScan(manualToken)}
                  className="w-full flex items-center justify-center rounded-2xl bg-slate-900 hover:bg-slate-800 py-4 text-xs font-black tracking-widest text-white uppercase transition disabled:opacity-40"
                >
                  <BoltIcon className="mr-2 h-5 w-5 text-emerald-400" />
                  {submitting ? 'Validating...' : 'Verify Zone Token'}
                </button>
              </div>

              {result.state !== 'idle' && (
                <div className="pt-4 border-t border-slate-100 animate-slide-up">
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

          {/* 3. STATS & SETUP TAB */}
          {activeTab === 'stats' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Settings Accordion Section */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Active Zone Setup</h2>
                  <p className="text-xs text-slate-500 font-medium">Configure active zone parameters below.</p>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Event</label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => handleEventChange(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                    >
                      {events.map((event) => (
                        <option key={event._id} value={event._id}>{event.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Zone</label>
                    {zoneLocked ? (
                      assignedZones.length > 1 ? (
                        <select
                          value={zoneName}
                          onChange={(e) => setZoneName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
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
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Grid Widgets */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-slate-900">Today's Zone Metrics</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 border border-slate-150 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scans</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{stats.total}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Success</p>
                    <p className="mt-1 text-2xl font-black text-emerald-600">{stats.success}</p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Denied</p>
                    <p className="mt-1 text-2xl font-black text-rose-600">{stats.failed}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. ACTIVITY LOGS TAB */}
          {activeTab === 'logs' && (() => {
            const pageSize = 10;
            const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
            const pagedLogs = logs.slice((logsPage - 1) * pageSize, logsPage * pageSize);
            return (
              <div className="space-y-4 animate-in fade-in duration-300">
                <ActivityList title={`Zone Access Scans (Page ${logsPage})`} items={pagedLogs} emptyMessage="No zone scanning history today." />
                
                {logs.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-white px-6 py-4 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Showing {logs.length === 0 ? 0 : (logsPage - 1) * pageSize + 1}-{Math.min(logsPage * pageSize, logs.length)} of {logs.length} scans
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

export default StaffZoneAccessPage;
