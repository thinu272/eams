import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsRightLeftIcon, CameraIcon, LightBulbIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';
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

const StaffZoneAccessPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [zoneName, setZoneName] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState({ state: 'idle' });
  const [logs, setLogs] = useState([]);

  const assignedZones = useMemo(() => getAssignedZones(user), [user]);
  const zoneLocked = assignedZones.length > 0;

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
    if (assignedZones[0]) setZoneName(assignedZones[0]);
  }, [assignedZones]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('eams:event-select', { detail: nextId }));
  };

  const refreshLogs = useCallback(async () => {
    if (!selectedEventId || !zoneName) return;
    try {
      const response = await getZoneLogs({ eventId: selectedEventId, zone: zoneName, limit: 10 });
      const nextLogs = (response.data?.data?.logs || []).map((item) => ({
        id: item._id,
        attendeeName: item.attendeeId?.fullName || item.attendeeSnapshot?.fullName,
        zoneName: item.zoneName,
        action: item.accessGranted ? `${item.action} allowed` : item.denialReason || 'Denied',
        status: item.accessGranted ? 'success' : 'error',
        timestamp: item.timestamp,
        accessGranted: item.accessGranted,
      }));
      setLogs(nextLogs);
    } catch {
      setLogs([]);
    }
  }, [selectedEventId, zoneName]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const handleZoneScan = useCallback(async (rawValue, mode = 'qr') => {
    const token = parseScannedValue(rawValue);
    if (!token || submitting) return;
    if (!selectedEventId) {
      setResult({
        state: 'error',
        attendee: null,
        message: 'Zone Access Unavailable',
        detail: 'Select an event before scanning zone access.',
        meta: [
          { label: 'Zone', value: zoneName || '-' },
          { label: 'Reason', value: 'EVENT_REQUIRED' },
          { label: 'Allowed', value: 'No' },
        ],
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      return;
    }

    if (!zoneName) {
      setResult({
        state: 'error',
        attendee: null,
        message: 'Zone Access Unavailable',
        detail: 'Choose the zone to validate before scanning.',
        meta: [
          { label: 'Zone', value: '-' },
          { label: 'Reason', value: 'ZONE_REQUIRED' },
          { label: 'Allowed', value: 'No' },
        ],
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      return;
    }

    setSubmitting(true);
    try {
      const payload = mode === 'rfid'
        ? { rfidId: token, zone: zoneName, eventId: selectedEventId }
        : { qrToken: token, zone: zoneName, eventId: selectedEventId };
      const response = await scanStaffZone(payload);
      const data = response.data?.data || {};
      setResult({
        state: data.accessGranted ? 'success' : 'error',
        attendee: data.attendee,
        message: data.accessGranted ? 'Zone Access Allowed' : 'Zone Access Denied',
        detail: data.accessGranted ? 'The attendee is allowed in this zone.' : response.data?.message || 'Zone validation failed.',
        meta: [
          { label: 'Zone', value: data.zoneName || zoneName },
          { label: 'Action', value: data.action || 'ENTRY' },
          { label: 'Allowed', value: data.accessGranted ? 'Yes' : 'No' },
        ],
      });
      playFeedbackTone(true);
      triggerHaptic(true);
      setManualToken('');
      refreshLogs();
    } catch (error) {
      const data = error.response?.data || {};
      setResult({
        state: 'error',
        attendee: data.data?.attendee || null,
        message: 'Zone Access Denied',
        detail: data.message || 'This attendee is not allowed in the selected zone.',
        meta: [
          { label: 'Zone', value: data.data?.zoneName || zoneName },
          { label: 'Reason', value: data.reason || 'NOT_ALLOWED' },
          { label: 'Allowed', value: 'No' },
        ],
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      refreshLogs();
    } finally {
      setSubmitting(false);
    }
  }, [zoneName, selectedEventId, submitting, refreshLogs]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Staff Operations</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Zone Access</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
                Verify whether an attendee can enter a restricted area. Fast feedback keeps queues clear while protecting zone boundaries.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Assigned Zones</p>
              <p className="mt-2 text-lg font-black">{getAssignedZoneLabel(user)}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-2">
                <select
                  value={selectedEventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                >
                  {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
                </select>
                {zoneLocked ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">{zoneName}</div>
                ) : (
                  <input
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="Zone name"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,0.95fr]">
                <div className="rounded-[28px] border border-emerald-100 bg-emerald-50 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
                      <CameraIcon className="h-5 w-5" />
                      Zone Scanner
                    </p>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-emerald-700">
                        <LightBulbIcon className="mr-1 inline h-4 w-4" />
                        Flash
                      </button>
                      <button type="button" className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-emerald-700">
                        <ArrowsRightLeftIcon className="mr-1 inline h-4 w-4" />
                        Camera
                      </button>
                    </div>
                  </div>
                  <QRScannerComponent onScanSuccess={(value) => handleZoneScan(value, 'qr')} onScanError={() => {}} fps={12} qrbox={260} />
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-slate-700">
                      <ShieldCheckIcon className="h-5 w-5" />
                      Manual Validation
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Paste the attendee token to re-check zone access without using the camera.</p>
                    <div className="mt-4">
                      <SearchBar value={manualToken} onChange={setManualToken} placeholder="Paste QR token" />
                    </div>
                    <button
                      type="button"
                      disabled={!manualToken.trim() || submitting}
                      onClick={() => handleZoneScan(manualToken, 'manual')}
                      className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-5 text-lg font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? 'Processing...' : 'Check Zone Access'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <ActivityList title="Last 10 Zone Scans" items={logs.slice(0, 10)} emptyMessage="No zone access activity yet for this station." />
          </div>

          <div className="space-y-6">
            <ResultCard
              state={result.state}
              attendee={result.attendee}
              message={result.message}
              detail={result.detail}
              meta={result.meta}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffZoneAccessPage;
