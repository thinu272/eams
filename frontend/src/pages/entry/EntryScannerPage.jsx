import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyEvents } from '../../api/events';
import { getEntryStats, scanEntry, searchEntryAttendees } from '../../api/entry';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  QrCodeIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const parseScannedValue = (value) => {
  const raw = value?.trim();
  if (!raw) return '';

  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch (error) {
    return raw;
  }
};

const buildAssetUrl = (photoPath) => {
  if (!photoPath) return '';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) return photoPath;
  const base = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
  return `${base}/${photoPath}`;
};

const resultLabel = {
  true: 'ACCESS GRANTED',
  false: 'ACCESS DENIED',
};

const statusColors = {
  confirmed: 'green',
  invited: 'blue',
  pending: 'yellow',
  rejected: 'red',
};

const EntryScannerPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [gateId, setGateId] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [stats, setStats] = useState({ totalScanned: 0, successfulEntries: 0, deniedEntries: 0 });
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef(null);

  const assignedGates = useMemo(
    () => (user?.assignedGates || []).filter(Boolean),
    [user]
  );

  const selectedEventData = useMemo(
    () => (events || []).find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) {
        setSelectedEvent(myEvents[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (assignedGates.length > 0) {
      setGateId((current) => (assignedGates.includes(current) ? current : assignedGates[0]));
      return;
    }
    setGateId((current) => current || 'Gate A');
  }, [assignedGates]);

  const loadStats = async (eventId, activeGate) => {
    if (!eventId) return;
    try {
      const response = await getEntryStats({ eventId, gateId: activeGate || undefined });
      const today = response.data?.data?.today || { totalScanned: 0, successfulEntries: 0, deniedEntries: 0 };
      setStats(today);
    } catch {
      setStats({ totalScanned: 0, successfulEntries: 0, deniedEntries: 0 });
    }
  };

  useEffect(() => {
    loadStats(selectedEvent, gateId);
  }, [selectedEvent, gateId]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [result]);

  useEffect(() => {
    if (!selectedEvent || manualSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchEntryAttendees({ eventId: selectedEvent, q: manualSearch.trim(), limit: 8 });
        setSearchResults(response.data?.data?.attendees || []);
      } catch (err) {
        setSearchResults([]);
        if (manualSearch.trim().length >= 3) {
          toast.error(err.response?.data?.message || 'Search failed');
        }
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [manualSearch, selectedEvent]);

  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = type === 'success' ? 880 : 220;
      gainNode.gain.value = 0.1;
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150);
    } catch {
      // Ignore browser audio restrictions.
    }
  };

  const handleScan = async (event, manualToken, scanMethod = 'qr') => {
    if (event) event.preventDefault();
    const token = parseScannedValue(manualToken || scanInput);
    if (!token || !selectedEvent || !gateId) return;

    setScanning(true);
    try {
      const payload = {
        qrToken: token,
        gateId,
        gateName: gateId,
        action: 'check_in',
        method: scanMethod,
      };
      const { data } = await scanEntry(payload);
      const outcome = data.data;
      setResult(outcome);
      playSound(outcome.accessGranted ? 'success' : 'error');
      setScanInput('');
      setManualSearch('');
      setSearchResults([]);
      if (manualToken) setShowCamera(false);
      loadStats(selectedEvent, gateId);
    } catch (err) {
      const fallback = {
        accessGranted: false,
        denialReason: err.response?.data?.message || err.response?.data?.reason || 'Scan failed',
        attendee: err.response?.data?.data?.attendee || null,
      };
      setResult(fallback);
      playSound('error');
      loadStats(selectedEvent, gateId);
    } finally {
      setScanning(false);
    }
  };

  const granted = !!result?.accessGranted;
  const gateLocked = ['staff', 'volunteer'].includes(user?.role) && assignedGates.length > 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Entry Staff Dashboard</h1>
            <p className="text-sm text-gray-500">Fast check-in for tablets with gate-aware scanning, manual lookup, and live entry totals.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <select
              value={selectedEvent}
              onChange={(event) => setSelectedEvent(event.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>

            {gateLocked ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Assigned Gate</p>
                <p className="mt-1 font-semibold">{gateId}</p>
              </div>
            ) : (
              <select
                value={gateId}
                onChange={(event) => setGateId(event.target.value)}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700"
              >
                {assignedGates.length > 0 ? (
                  assignedGates.map((gate) => (
                    <option key={gate} value={gate}>
                      {gate}
                    </option>
                  ))
                ) : (
                  ['Gate A', 'Gate B'].map((gate) => (
                    <option key={gate} value={gate}>
                      {gate}
                    </option>
                  ))
                )}
              </select>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mode</p>
              <p className="mt-1 font-semibold text-gray-900">Check-In Only</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Total scanned today</p>
            <p className="mt-2 text-4xl font-bold text-gray-900">{stats.totalScanned || 0}</p>
          </div>
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <p className="text-sm text-green-700">Successful entries</p>
            <p className="mt-2 text-4xl font-bold text-green-700">{stats.successfulEntries || 0}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-700">Denied entries</p>
            <p className="mt-2 text-4xl font-bold text-red-700">{stats.deniedEntries || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">QR Scanner</h2>
                  <p className="text-sm text-gray-500">Scan a ticket QR or paste the token manually.</p>
                </div>
                <button
                  onClick={() => setShowCamera((current) => !current)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    showCamera ? 'border-red-200 bg-red-50 text-red-600' : 'border-blue-200 bg-blue-50 text-blue-600'
                  }`}
                >
                  {showCamera ? 'Close Camera' : 'Use Camera'}
                </button>
              </div>

              {showCamera ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <QRScannerComponent
                    onScanSuccess={(text) => handleScan(null, text, 'qr')}
                    onScanError={() => {}}
                  />
                  <p className="mt-3 text-center text-xs text-gray-400">Position the attendee QR code inside the frame.</p>
                </div>
              ) : (
                <form onSubmit={handleScan} className="flex flex-col gap-3 md:flex-row">
                  <input
                    ref={inputRef}
                    value={scanInput}
                    onChange={(event) => setScanInput(event.target.value)}
                    placeholder="Scan QR code or paste token"
                    className="flex-1 rounded-2xl border border-gray-300 px-4 py-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <Button type="submit" loading={scanning} className="px-6 py-4 text-base">
                    {!scanning && <QrCodeIcon className="h-5 w-5" />}
                    Scan
                  </Button>
                </form>
              )}
            </div>

            {result && (
              <div className={`rounded-3xl border-2 p-6 shadow-sm ${granted ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                <div className="mb-5 flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full ${granted ? 'bg-green-500' : 'bg-red-500'}`}>
                    {granted ? <CheckCircleIcon className="h-10 w-10 text-white" /> : <XCircleIcon className="h-10 w-10 text-white" />}
                  </div>
                  <div>
                    <p className={`text-3xl font-bold ${granted ? 'text-green-800' : 'text-red-800'}`}>
                      {resultLabel[String(granted)]}
                    </p>
                    <p className={`mt-1 text-sm ${granted ? 'text-green-700' : 'text-red-700'}`}>
                      {granted ? `Checked in at ${gateId}` : result.denialReason || 'Entry denied'}
                    </p>
                  </div>
                </div>

                {result.attendee && (
                  <div className={`rounded-2xl p-4 ${granted ? 'bg-green-100' : 'bg-red-100'}`}>
                    <div className="flex flex-col gap-4 sm:flex-row">
                      {result.attendee.photo && (
                        <img
                          src={buildAssetUrl(result.attendee.photo)}
                          alt={result.attendee.fullName || 'Attendee'}
                          className="h-24 w-24 rounded-2xl border-2 border-white object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-gray-900">{result.attendee.fullName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge color="blue">{result.attendee.categoryName || 'No category'}</Badge>
                          {result.attendee.photoVerificationStatus && (
                            <Badge color={statusColors[result.attendee.photoVerificationStatus] || 'gray'}>
                              photo {result.attendee.photoVerificationStatus}
                            </Badge>
                          )}
                        </div>
                        {result.attendee.allowedZones?.length > 0 && (
                          <div className="mt-3">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Zone access</p>
                            <div className="flex flex-wrap gap-2">
                              {result.attendee.allowedZones.map((zone) => (
                                <span key={zone} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700">
                                  {zone}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.attendee.phone && <p className="mt-3 text-sm text-gray-600">{result.attendee.phone}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Manual Search</h2>
                  <p className="text-sm text-gray-500">Search by attendee name or phone when a QR cannot be scanned.</p>
                </div>
                <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
              </div>
              <input
                value={manualSearch}
                onChange={(event) => setManualSearch(event.target.value)}
                placeholder="Search name or phone"
                className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="mt-4 space-y-3">
                {searching && <p className="text-sm text-gray-400">Searching attendees...</p>}
                {!searching && manualSearch.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">
                    No attendees found for this search.
                  </div>
                )}
                {searchResults.map((attendee) => (
                  <div key={attendee._id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{attendee.fullName || 'Unnamed attendee'}</p>
                        <p className="text-sm text-gray-500">{attendee.phone || attendee.categoryName || 'No phone available'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge color={statusColors[attendee.confirmationStatus] || 'gray'}>
                            {attendee.confirmationStatus}
                          </Badge>
                          <Badge color={attendee.checkedIn ? 'red' : 'green'}>
                            {attendee.checkedIn ? 'already checked in' : 'ready to scan'}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleScan(null, attendee.qrToken, 'manual')}
                        disabled={scanning}
                      >
                        Check In
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">Gate Assignment</h2>
              <p className="mt-2 text-sm text-gray-500">
                {gateLocked
                  ? 'Your gate is locked by organiser permissions. All scans from this device will be logged against that gate.'
                  : 'Choose the active gate before scanning so every entry log is tracked to the correct checkpoint.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(assignedGates.length > 0 ? assignedGates : ['Gate A', 'Gate B']).map((gate) => (
                  <button
                    key={gate}
                    type="button"
                    onClick={() => !gateLocked && setGateId(gate)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      gateId === gate
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700'
                    } ${gateLocked ? 'cursor-default' : 'hover:border-blue-300 hover:bg-blue-50'}`}
                  >
                    {gate}
                  </button>
                ))}
              </div>
              {selectedEventData?.name && (
                <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                  Event: <span className="font-semibold text-gray-900">{selectedEventData.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default EntryScannerPage;
