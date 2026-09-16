import React, { useRef, useState, useEffect } from 'react';
import QRScannerComponent from '../events/QRScannerComponent';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import {
  QrCodeIcon,
  SignalIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  XMarkIcon,
  CheckBadgeIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const parseScannedValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed.attendeeToken || parsed.token || parsed.qrToken || raw;
  } catch {
    return raw;
  }
};

const ScannerComponent = ({
  title,
  description,
  zones = [],
  activeZone,
  onZoneChange,
  onSubmit,
  onAssignRfid,
  submitting,
  result,
  rfidEnabled = false,
  scannerType = 'entry', // 'entry' or 'zone'
  onSwitchToCheckOut,
}) => {
  const [scanMode, setScanMode] = useState('qr');
  const [action, setAction] = useState(scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN');
  const [manualValue, setManualValue] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [assignRfidMode, setAssignRfidMode] = useState(false);
  const [assignRfidValue, setAssignRfidValue] = useState('');
  const [assignRfidSubmitting, setAssignRfidSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Auto-reset after successful result
  useEffect(() => {
    if (result && result.accessGranted !== undefined) {
      const timer = setTimeout(() => {
        // Keep result visible for a moment, then allow new scan
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const clearResult = () => {
    result && onSubmit({ value: '', mode: scanMode, zoneId: activeZone, action: 'CLEAR' });
  };

  const submitValue = async (value) => {
    const nextValue = parseScannedValue(value);
    if (!nextValue) return;
    await onSubmit({
      value: nextValue,
      mode: scanMode,
      zoneId: activeZone,
      action,
    });
    setManualValue('');
    inputRef.current?.focus();
  };

  const handleAssignRfid = async () => {
    if (!assignRfidValue.trim() || !onAssignRfid) return;
    setAssignRfidSubmitting(true);
    try {
      await onAssignRfid(assignRfidValue);
      setAssignRfidMode(false);
      setAssignRfidValue('');
      toast?.success?.('RFID assigned successfully');
    } catch (error) {
      toast?.error?.(error.response?.data?.message || 'Failed to assign RFID');
    } finally {
      setAssignRfidSubmitting(false);
    }
  };

  const actionLabel = scannerType === 'zone'
    ? (action === 'ENTRY' ? 'Zone Entry' : 'Zone Exit')
    : (action === 'CHECK_IN' ? 'Check-In' : 'Check-Out');

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      {/* Controls panel */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            scannerType === 'zone' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {scannerType === 'zone' ? (
              <QrCodeIcon className="h-5 w-5" />
            ) : (
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* Main Entry - for Entry Scanner */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              {scannerType === 'zone' ? 'Select Zone' : 'Main Entry'}
            </label>
            <select
              value={activeZone}
              onChange={(e) => onZoneChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {scannerType !== 'zone' && (
                <option value="main-entry">Main Entry</option>
              )}
              {zones.map((zone) => (
                <option key={zone.id || zone.name} value={zone.id || zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Toggle - Check-In/Check-Out or Zone Entry/Exit */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction(scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  action === (scannerType === 'zone' ? 'ENTRY' : 'CHECK_IN')
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                {scannerType === 'zone' ? 'Entry' : 'Check-In'}
              </button>
              <button
                type="button"
                onClick={() => setAction(scannerType === 'zone' ? 'EXIT' : 'CHECK_OUT')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  action === (scannerType === 'zone' ? 'EXIT' : 'CHECK_OUT')
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                {scannerType === 'zone' ? 'Exit' : 'Check-Out'}
              </button>
            </div>
          </div>

          {/* Mode - QR/RFID */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Credential
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScanMode('qr')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  scanMode === 'qr'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <QrCodeIcon className="h-4 w-4" />
                QR
              </button>
              <button
                type="button"
                onClick={() => setScanMode('rfid')}
                disabled={!rfidEnabled}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  !rfidEnabled
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400'
                    : scanMode === 'rfid'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700'
                }`}
              >
                <SignalIcon className="h-4 w-4" />
                RFID
              </button>
            </div>
            {!rfidEnabled && (
              <p className="mt-1.5 text-xs text-slate-400">RFID disabled for this event</p>
            )}
          </div>

          {/* Manual input */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await submitValue(manualValue);
            }}
            className="space-y-3"
          >
            <input
              ref={inputRef}
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={
                scanMode === 'qr' ? 'Paste or scan QR token' : 'Enter RFID id'
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            <Button
              type="submit"
              disabled={submitting || !activeZone}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 disabled:opacity-60"
            >
              {submitting ? 'Processing…' : `Submit ${actionLabel}`}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            disabled={scanMode !== 'qr'}
            className="w-full rounded-xl border border-blue-200 px-3.5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showCamera ? 'Hide camera' : 'Open camera scanner'}
          </button>
        </div>
      </div>

      {/* Result + camera */}
      <div className="space-y-5">
        {showCamera && scanMode === 'qr' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Camera
            </p>
            <QRScannerComponent
              onScanSuccess={(value) => {
                submitValue(value);
                setShowCamera(false);
              }}
              onScanError={() => {}}
              fps={12}
              qrbox={260}
              scanCooldownMs={1800}
            />
          </div>
        )}

        {/* Result panel — keep high contrast for distance visibility */}
        <div
          className={`rounded-2xl p-6 shadow-sm relative ${
            result?.accessGranted
              ? 'bg-emerald-600 text-white'
              : result
              ? 'bg-rose-600 text-white'
              : 'border border-dashed border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          {result && (
            <button
              type="button"
              onClick={clearResult}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}

          {!result ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider">
                Ready to Scan
              </p>
              <p className="mt-2 text-base font-medium">
                Scan attendee {actionLabel.toLowerCase()} credential
              </p>
              {activeZone && (
                <p className="mt-3 text-sm opacity-80">
                  {scannerType === 'zone' ? 'Zone: ' : 'Entry: '}
                  <span className="font-semibold">
                    {zones.find(z => (z.id || z.name) === activeZone)?.name || activeZone}
                  </span>
                  <span className="mx-2">·</span>
                  <span className="font-semibold">{actionLabel}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-bold uppercase tracking-wider">
                  {result.accessGranted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </p>
                {result.accessGranted && (
                  <CheckBadgeIcon className="h-5 w-5" />
                )}
              </div>
              <h3 className="text-2xl font-bold">
                {result.attendee?.fullName || 'Unknown attendee'}
              </h3>
              {result.action && (
                <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1">
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {result.action === 'check_in' ? 'CHECK-IN' : 'CHECK-OUT'}
                  </span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm opacity-80">Ticket Category</p>
                  <p className="font-semibold text-lg">
                    {result.attendee?.categoryName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-80">{scannerType === 'zone' ? 'Zone' : 'Entry Point'}</p>
                  <p className="font-semibold text-lg">{result.zone?.name || '—'}</p>
                </div>
              </div>

              {/* Photo and Verification Status */}
              <div className="flex items-center gap-4 pt-2 border-t border-white/20">
                {result.attendee?.photo ? (
                  <div className="flex-shrink-0">
                    <img
                      src={result.attendee.photo}
                      alt="Attendee"
                      className="h-16 w-16 rounded-xl object-cover border-2 border-white/30"
                    />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-slate-700 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {(result.attendee?.fullName || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-xs opacity-80">Photo Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {result.attendee?.photoVerificationStatus === 'verified' ? (
                      <>
                        <CheckBadgeIcon className="h-5 w-5 text-emerald-400" />
                        <span className="font-semibold text-emerald-300">Photo Verified</span>
                      </>
                    ) : result.attendee?.photoVerificationStatus === 'pending' ? (
                      <>
                        <ClockIcon className="h-5 w-5 text-amber-400" />
                        <span className="font-semibold text-amber-300">Pending Review</span>
                      </>
                    ) : result.attendee?.photoVerificationStatus === 'rejected' ? (
                      <>
                        <XMarkIcon className="h-5 w-5 text-rose-400" />
                        <span className="font-semibold text-rose-300">Photo Rejected</span>
                      </>
                    ) : (
                      <span className="font-semibold text-slate-300">Not Submitted</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">Status</p>
                  <p className="font-semibold text-lg">
                    {result.attendee?.checkedIn ? (
                      <span className="text-emerald-300">Checked In</span>
                    ) : (
                      <span className="text-slate-300">Not Checked In</span>
                    )}
                  </p>
                </div>
              </div>

              {result.attendee?.rfidTag ? (
                <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-1.5">
                  <SignalIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">RFID: {result.attendee.rfidTag}</span>
                </div>
              ) : result.accessGranted && !result.attendee?.rfidTag && rfidEnabled && onAssignRfid ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm font-medium text-amber-800">RFID Not Assigned</p>
                  <p className="text-xs text-amber-600 mt-1">Assign RFID for faster future check-ins</p>
                  <Button
                    size="sm"
                    className="mt-3 bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={() => setAssignRfidMode(true)}
                  >
                    Assign RFID
                  </Button>
                </div>
              ) : null}
              
              {/* Error actions - Switch to Exit Mode */}
              {!result.accessGranted && result.suggestCheckOut && scannerType === 'entry' && (
                <div className="pt-3 border-t border-white/20">
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={() => {
                      clearResult();
                      if (onSwitchToCheckOut) {
                        onSwitchToCheckOut();
                      } else {
                        setAction('CHECK_OUT');
                      }
                    }}
                  >
                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                    Switch to Exit Mode
                  </Button>
                </div>
              )}
              
              <p className="text-sm font-medium pt-2 border-t border-white/20">
                {result.denialReason || result.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RFID Assignment Modal */}
      <Modal
        open={assignRfidMode}
        onClose={() => {
          setAssignRfidMode(false);
          setAssignRfidValue('');
        }}
        title="Assign RFID Tag"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Scan or enter an available RFID tag to assign to this attendee.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              RFID Tag
            </label>
            <input
              type="text"
              value={assignRfidValue}
              onChange={(e) => setAssignRfidValue(e.target.value)}
              placeholder="Scan RFID tag..."
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setAssignRfidMode(false);
                setAssignRfidValue('');
              }}
              disabled={assignRfidSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignRfid}
              disabled={!assignRfidValue.trim() || assignRfidSubmitting}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {assignRfidSubmitting ? 'Assigning...' : 'Assign RFID'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ScannerComponent;