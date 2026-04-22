import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsRightLeftIcon, BoltIcon, CameraIcon, CheckCircleIcon, DevicePhoneMobileIcon, LightBulbIcon } from '@heroicons/react/24/solid';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import ResultCard from '../../components/staff/ResultCard';
import ActivityList from '../../components/staff/ActivityList';
import SearchBar from '../../components/staff/SearchBar';
import { checkInAttendee, getEntryLogs } from '../../api/entry';
import { getMyEvents } from '../../api/events';
import { scanStaffEntry } from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { getAssignedGateLabel, playFeedbackTone, triggerHaptic, parseScannedValue } from './staffUtils';
import toast from 'react-hot-toast';

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
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [gateName, setGateName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [scanMode, setScanMode] = useState('check_in');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);

  const availableGates = useMemo(() => (user?.assignedGates || []).filter(Boolean), [user]);
  const gateLocked = availableGates.length > 0;

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const fallbackEventId = selectedEventId || nextEvents[0]?._id || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, []);

  useEffect(() => {
    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setSelectedEventId(nextId);
    };

    window.addEventListener('eams:event-select', handleEventSelect);
    return () => window.removeEventListener('eams:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    if (availableGates[0]) setGateName(availableGates[0]);
    else setGateName('Main Gate');
  }, [availableGates]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('eams:event-select', { detail: nextId }));
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

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const handleScan = useCallback(async (rawToken, method = 'qr') => {
    const qrToken = parseScannedValue(rawToken);
    if (!qrToken || !selectedEventId || !gateName || scanning) return;

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
          ? (isExit ? 'Attendee checked out successfully at the assigned gate.' : 'Ticket validated successfully at the assigned gate.')
          : payload.denialReason || 'Ticket validation failed',
        meta: [
          { label: 'Gate', value: gateName },
          { label: 'Mode', value: isExit ? 'Exit' : 'Entry' },
          { label: 'Ticket Category', value: payload.attendee?.categoryName },
          { label: 'Validation', value: payload.accessGranted ? 'Confirmed' : 'Denied' },
        ],
      });
      playFeedbackTone(true);
      triggerHaptic(true);
      setManualToken('');
      refreshLogs();
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
          { label: 'Validation', value: denied.reason },
        ],
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      refreshLogs();
    } finally {
      setScanning(false);
    }
  }, [selectedEventId, gateName, scanMode, scanning, refreshLogs]);

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
      refreshLogs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual check-in failed.');
    }
  }, [result, gateName, refreshLogs]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-cyan-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Staff Operations</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Entry Scanner</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
                Fast, tablet-friendly ticket validation for assigned entry points. Scan QR codes, confirm valid attendees, and keep the queue moving.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Assigned Gates</p>
                <p className="mt-2 text-lg font-black">{getAssignedGateLabel(user)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Response Goal</p>
                <p className="mt-2 text-lg font-black">&lt; 1 second</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Scanner Setup</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-900">Live Entry Validation</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={selectedEventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500"
                  >
                    {events.map((event) => (
                      <option key={event._id} value={event._id}>{event.name}</option>
                    ))}
                  </select>
                  {gateLocked ? (
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-cyan-700">
                      {gateName}
                    </div>
                  ) : (
                    <input
                      value={gateName}
                      onChange={(e) => setGateName(e.target.value)}
                      placeholder="Gate name"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-cyan-500"
                    />
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ['check_in', 'Entry Scan'],
                  ['check_out', 'Exit Scan'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScanMode(value)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition ${
                      scanMode === value
                        ? 'border-cyan-600 bg-cyan-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,0.95fr]">
                <div className="space-y-4">
                  <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-cyan-700">
                        <CameraIcon className="h-5 w-5" />
                        Camera Scanner
                      </p>
                      <div className="flex gap-2">
                        <button type="button" className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
                          <LightBulbIcon className="mr-1 inline h-4 w-4" />
                          Flash
                        </button>
                        <button type="button" className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
                          <ArrowsRightLeftIcon className="mr-1 inline h-4 w-4" />
                          Camera
                        </button>
                      </div>
                    </div>
                    <QRScannerComponent onScanSuccess={(value) => handleScan(value, 'qr')} onScanError={() => {}} fps={12} qrbox={260} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-slate-700">
                      <DevicePhoneMobileIcon className="h-5 w-5" />
                      Manual Token Input
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Use this when a QR code is damaged but the token is available.</p>
                    <div className="mt-4">
                      <SearchBar value={manualToken} onChange={setManualToken} placeholder="Paste QR token" />
                    </div>
                    <button
                      type="button"
                      disabled={!manualToken.trim() || scanning}
                      onClick={() => handleScan(manualToken, 'manual')}
                      className="mt-4 flex w-full items-center justify-center rounded-2xl bg-cyan-600 px-5 py-5 text-lg font-black text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <BoltIcon className="mr-2 h-5 w-5" />
                      {scanning ? 'Processing...' : scanMode === 'check_out' ? 'Validate Exit' : 'Validate Ticket'}
                    </button>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Scan Rules</p>
                    <div className="mt-3 space-y-3 text-sm font-medium text-slate-600">
                      <p>Entry mode checks attendees in at the assigned gate.</p>
                      <p>Exit mode checks attendees out at the same main entry point.</p>
                      <p>Red means invalid ticket, wrong state, or denied validation.</p>
                      <p>Large controls are tuned for tablet use at busy gates.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <ActivityList title="Last 10 Entry Scans" items={logs.slice(0, 10)} emptyMessage="No entry scans yet for this staff station." />
          </div>

          <div className="space-y-6">
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
                  className="rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                >
                  <CheckCircleIcon className="mr-2 inline h-5 w-5" />
                  Manual Check-In
                </button>
              ) : null}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffScanPage;
