import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';
import { 
  ArrowsRightLeftIcon, 
  BoltIcon, 
  CameraIcon, 
  CheckCircleIcon, 
  DevicePhoneMobileIcon, 
  LightBulbIcon,
  Cog6ToothIcon,
  SignalIcon,
  SignalSlashIcon,
  ClockIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  ListBulletIcon
} from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import ResultCard from '../../components/staff/ResultCard';
import ActivityList from '../../components/staff/ActivityList';
import SearchBar from '../../components/staff/SearchBar';
import { checkInAttendee, getEntryLogs, getEntryStats } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { scanStaffEntry } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { playFeedbackTone, triggerHaptic, parseScannedValue } from './staffUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const normalizeEntryError = (error) => {
  const data = error?.response?.data || {};
  const reason = data.reason;
  const messageMap = {
    NOT_FOUND: 'Invalid ticket',
    ALREADY_CHECKED_IN: 'Already used',
    NOT_CHECKED_IN: 'Not currently inside',
    NOT_CONFIRMED: 'Not confirmed',
    DEACTIVATED: 'Invalid ticket',
  };

  return {
    accessGranted: false,
    attendee: data.data?.attendee || null,
    detail: messageMap[reason] || data.message || 'Entry validation failed',
    reason: reason || 'DENIED',
  };
};

const StaffScanPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [gateName, setGateName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('check_in'); // 'check_in' | 'check_out'
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [gateInput, setGateInput] = useState('');

  // Tab State for distraction-free UI/UX
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual' | 'stats' | 'logs'
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [lastScan, setLastScan] = useState(null);

  // Offline Sync State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('entrynex:offline-scans')) || [];
    } catch {
      return [];
    }
  });

  const availableGates = useMemo(() => (user?.assignedGates || []).filter(Boolean), [user]);
  const gateLocked = availableGates.length > 0;

  // Track network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet connection restored. Syncing pending scans...');
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
        localStorage.removeItem('entrynex:offline-scans');

        let successfulSyncCount = 0;
        for (const scan of queueToProcess) {
          try {
            await scanStaffEntry({
              qrToken: scan.qrToken,
              gateId: scan.gateId,
              gateName: scan.gateName,
              eventId: scan.eventId,
              action: scan.action,
              method: 'manual',
            });
            successfulSyncCount++;
          } catch (err) {
            console.error('Offline scan sync failure:', err);
          }
        }
        
        if (successfulSyncCount > 0) {
          toast.success(`Successfully synchronized ${successfulSyncCount} offline scans to cloud!`);
        }
        refreshLogs();
        fetchStats();
      };

      syncScans();
    }
  }, [isOnline, offlineQueue]);

  // Save offline queue changes
  useEffect(() => {
    localStorage.setItem('entrynex:offline-scans', JSON.stringify(offlineQueue));
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
    if (availableGates[0]) {
      setGateName(availableGates[0]);
      setGateInput(availableGates[0]);
    } else {
      setGateName('Main Gate');
      setGateInput('Main Gate');
    }
  }, [availableGates]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getEntryLogs({ eventId: selectedEventId, gateId: gateName, limit: 10 });
      const nextLogs = (response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendee?.fullName || item.snapshot?.fullName,
        zoneName: item.gateName || item.zoneName,
        action: item.accessGranted
          ? (item.action === 'check_out' ? 'Exit processed' : 'Access granted')
          : item.denialReason || 'Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
        accessGranted: item.accessGranted,
      }));
      setLogs(nextLogs);
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, gateName]);

  const fetchStats = useCallback(async () => {
    if (!selectedEventId) return;
    try {
      const response = await getEntryStats({ eventId: selectedEventId, gateId: gateName });
      const data = response.data?.data?.today || {};
      setStats({
        total: data.totalScanned || 0,
        success: data.successfulEntries || 0,
        failed: data.deniedEntries || 0
      });
    } catch (err) {
      console.warn('Failed to load today stats:', err);
    }
  }, [selectedEventId, gateName]);

  useEffect(() => {
    refreshLogs();
    fetchStats();
  }, [refreshLogs, fetchStats]);

  // Socket.IO real-time synchronization
  useEffect(() => {
    if (!selectedEventId) return;

    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId: selectedEventId });
    socket.emit('join_dashboard', { eventId: selectedEventId });

    const handleRealtimeUpdate = (data) => {
      if (data.eventId === selectedEventId) {
        if (data.accessGranted) {
          setLastScan({
            action: data.action || 'CHECK-IN',
            name: data.name || 'Attendee',
            categoryName: data.categoryName || 'General Entry',
            zoneName: data.zoneName || 'Main Gate',
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

    socket.on('entry_update', handleRealtimeUpdate);
    socket.on('zone_update', handleRealtimeUpdate);

    return () => {
      socket.off('entry_update', handleRealtimeUpdate);
      socket.off('zone_update', handleRealtimeUpdate);
      socket.disconnect();
    };
  }, [selectedEventId, refreshLogs]);

  const handleScan = useCallback(async (rawToken, method = 'qr') => {
    const qrToken = parseScannedValue(rawToken);
    if (!qrToken || !selectedEventId || !gateName || scanning) return;

    // --- OFFLINE SCAN ROUTING ---
    if (!isOnline) {
      playFeedbackTone(true);
      triggerHaptic(true);
      
      const simulatedAttendee = {
        fullName: 'Offline Attendee',
        categoryName: 'Standard Ticket',
        checkedIn: scanMode === 'check_in',
        confirmationStatus: 'confirmed'
      };

      setResult({
        state: 'success',
        attendee: simulatedAttendee,
        message: scanMode === 'check_out' ? 'Exit Recorded (Offline)' : 'Access Granted (Offline)',
        detail: 'Ticket saved locally. Syncing will occur automatically when online.',
        meta: [
          { label: 'Gate', value: gateName },
          { label: 'Mode', value: scanMode === 'check_out' ? 'Exit' : 'Entry' },
          { label: 'Network', value: 'Offline Cache' },
        ],
      });

      setOfflineQueue(prev => [
        ...prev,
        {
          qrToken,
          gateId: gateName,
          gateName,
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
        action: scanMode === 'check_out' ? 'CHECK-OUT' : 'CHECK-IN',
        name: 'Offline Attendee',
        categoryName: 'Standard Ticket',
        zoneName: gateName,
        timestamp: new Date(),
        processedByName: user?.name || 'Staff'
      });

      return;
    }

    setScanning(true);
    try {
      const response = await scanStaffEntry({
        qrToken,
        gateId: gateName,
        gateName,
        eventId: selectedEventId,
        action: scanMode,
        method,
      });

      const payload = response.data?.data || {};
      const isExit = scanMode === 'check_out';
      setResult({
        state: payload.accessGranted ? 'success' : 'error',
        attendee: payload.attendee,
        message: payload.accessGranted ? (isExit ? 'Exit Recorded' : 'Access Granted') : (isExit ? 'Exit Denied' : 'Access Denied'),
        detail: payload.accessGranted
          ? (isExit ? 'Attendee checked out successfully.' : 'Ticket validated successfully.')
          : payload.denialReason || 'Ticket validation failed',
        meta: [
          { label: 'Gate', value: gateName },
          { label: 'Mode', value: isExit ? 'Exit' : 'Entry' },
          { label: 'Ticket Category', value: payload.attendee?.categoryName },
        ],
      });

      if (payload.accessGranted) {
        setLastScan({
          action: isExit ? 'CHECK-OUT' : 'CHECK-IN',
          name: payload.attendee?.fullName || 'Attendee',
          categoryName: payload.attendee?.categoryName || 'Standard Ticket',
          zoneName: gateName,
          timestamp: new Date(),
          processedByName: user?.name || 'Staff'
        });
      }

      playFeedbackTone(true);
      triggerHaptic(true);
      setManualToken('');
      refreshLogs();
      fetchStats();
    } catch (error) {
      const denied = normalizeEntryError(error);
      setResult({
        state: 'error',
        attendee: denied.attendee,
        message: 'Access Denied',
        detail: denied.detail,
        meta: [
          { label: 'Gate', value: gateName },
          { label: 'Mode', value: scanMode === 'check_out' ? 'Exit' : 'Entry' },
          { label: 'Reason', value: denied.detail },
        ],
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      refreshLogs();
      fetchStats();
    } finally {
      setScanning(false);
    }
  }, [selectedEventId, gateName, scanMode, scanning, refreshLogs, fetchStats, isOnline, user]);

  const handleManualCheckIn = useCallback(async () => {
    if (!result?.attendee?._id || result.state !== 'error') return;

    try {
      await checkInAttendee({ attendeeId: result.attendee._id, gateId: gateName, gateName, method: 'manual' });
      toast.success('Manual check-in completed.');
      setResult((current) => ({
        ...current,
        state: 'success',
        message: 'Access Granted',
        detail: 'Manual check-in completed successfully.',
      }));
      setLastScan({
        action: 'CHECK-IN',
        name: result.attendee?.fullName || 'Attendee',
        categoryName: result.attendee?.categoryName || 'Standard Ticket',
        zoneName: gateName,
        timestamp: new Date(),
        processedByName: user?.name || 'Staff'
      });
      refreshLogs();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-in failed.');
    }
  }, [result, gateName, refreshLogs, fetchStats]);

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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gate Entry Scanner</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            Gate: <span className="text-slate-800 font-black">{gateName}</span>
          </p>
        </div>

        {/* Real-time Last Scanned Attendee Card */}
        {lastScan ? (
          <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 p-5 shadow-lg space-y-3 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Ambient cyan glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${
                lastScan.action === 'CHECK-OUT' ? 'bg-rose-500/20 text-rose-350' : 'bg-emerald-500/20 text-emerald-350'
              }`}>
                ● Last {lastScan.action === 'CHECK-OUT' ? 'Check-Out' : 'Check-In'}
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
                <p className="text-sm font-black text-cyan-400 mt-0.5 truncate">{lastScan.zoneName}</p>
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
                  setResult({ state: 'idle' }); // Clear previous scan results when changing tabs
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
              
              {/* Quick mode indicators (Check-In / Out) */}
              <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setScanMode('check_in')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'check_in'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Entry Mode
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('check_out')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'check_out'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Exit Mode
                </button>
              </div>

              {/* Distraction-Free Camera Viewfinder Component */}
              <div className="rounded-[32px] border-4 border-slate-900 bg-black overflow-hidden shadow-2xl relative aspect-[4/3] sm:aspect-square">
                <QRScannerComponent onScanSuccess={(value) => handleScan(value, 'qr')} onScanError={() => {}} fps={12} qrbox={260} />
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
                    actions={result.state === 'error' && result.attendee ? (
                      <button
                        type="button"
                        onClick={handleManualCheckIn}
                        className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 py-4 text-xs font-black uppercase tracking-widest text-white transition flex items-center justify-center gap-2"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                        Override Manual Entry
                      </button>
                    ) : null}
                  />
                </div>
              )}
            </div>
          )}

          {/* 2. MANUAL KEY IN TAB */}
          {activeTab === 'manual' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 animate-in fade-in duration-300">
              <div>
                <h2 className="text-lg font-black text-slate-900">Manual Entry Validation</h2>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                  Type or paste the attendee's QR token below to complete validation. Viewfinder camera is deactivated to conserve power.
                </p>
              </div>

              <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setScanMode('check_in')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'check_in'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Entry Mode
                </button>
                <button
                  type="button"
                  onClick={() => setScanMode('check_out')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition ${
                    scanMode === 'check_out'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-white/40'
                  }`}
                >
                  Exit Mode
                </button>
              </div>

              <div className="space-y-4">
                <SearchBar value={manualToken} onChange={setManualToken} placeholder="Paste/Type QR token code here..." autoFocus />
                
                <button
                  type="button"
                  disabled={!manualToken.trim() || scanning}
                  onClick={() => handleScan(manualToken, 'manual')}
                  className="w-full flex items-center justify-center rounded-2xl bg-slate-900 hover:bg-slate-800 py-4 text-xs font-black tracking-widest text-white uppercase transition disabled:opacity-40"
                >
                  <BoltIcon className="mr-2 h-5 w-5 text-cyan-400" />
                  {scanning ? 'Validating...' : 'Verify Token'}
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
                    actions={result.state === 'error' && result.attendee ? (
                      <button
                        type="button"
                        onClick={handleManualCheckIn}
                        className="w-full rounded-2xl bg-slate-900 hover:bg-slate-800 py-4 text-xs font-black uppercase tracking-widest text-white transition flex items-center justify-center gap-2"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                        Override Manual Entry
                      </button>
                    ) : null}
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
                  <h2 className="text-lg font-black text-slate-900">Active Gate Setup</h2>
                  <p className="text-xs text-slate-500 font-medium">Configure scanner parameters below.</p>
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
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Select Gate</label>
                    {gateLocked ? (
                      availableGates.length > 1 ? (
                        <select
                          value={gateName}
                          onChange={(e) => setGateName(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                        >
                          {availableGates.map((gate) => (
                            <option key={gate} value={gate}>{gate}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm font-bold text-slate-700">
                          {gateName}
                        </div>
                      )
                    ) : (
                      <input
                        value={gateInput}
                        onChange={(e) => setGateInput(e.target.value)}
                        onBlur={() => setGateName(gateInput)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setGateName(gateInput); }}
                        placeholder="Gate name"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500 focus:bg-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Grid Widgets */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-black text-slate-900">Today's Scanner Metrics</h2>
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
                <ActivityList title={`Gate Scans (Page ${logsPage})`} items={pagedLogs} emptyMessage="No scanning history today." />
                
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

export default StaffScanPage;
