import React, { useRef, useState } from 'react';
import QRScannerComponent from '../events/QRScannerComponent';
import Button from '../ui/Button';
import {
  QrCodeIcon,
  SignalIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
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
  submitting,
  result,
}) => {
  const [scanMode, setScanMode] = useState('qr');
  const [action, setAction] = useState('ENTRY');
  const [manualValue, setManualValue] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef(null);

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

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      {/* Controls panel */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <QrCodeIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {/* Zone */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Zone
            </label>
            <select
              value={activeZone}
              onChange={(e) => onZoneChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {zones.length === 0 && (
                <option value="">No zones available</option>
              )}
              {zones.map((zone) => (
                <option key={zone.id || zone.name} value={zone.id || zone.name}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* Entry / Exit */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Scan action
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAction('ENTRY')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  action === 'ENTRY'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Entry
              </button>
              <button
                type="button"
                onClick={() => setAction('EXIT')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  action === 'EXIT'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                Exit
              </button>
            </div>
          </div>

          {/* Mode */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Scan mode
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
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  scanMode === 'rfid'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                <SignalIcon className="h-4 w-4" />
                RFID
              </button>
            </div>
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
              {submitting ? 'Processing…' : 'Submit scan'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            className="w-full rounded-xl border border-blue-200 px-3.5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
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
              onScanSuccess={(value) => submitValue(value)}
              onScanError={() => {}}
              fps={12}
              qrbox={260}
              scanCooldownMs={1800}
            />
          </div>
        )}

        {/* Result panel — keep high contrast for distance visibility */}
        <div
          className={`rounded-2xl p-6 shadow-sm ${
            result?.accessGranted
              ? 'bg-emerald-600 text-white'
              : result
              ? 'bg-rose-600 text-white'
              : 'border border-dashed border-slate-200 bg-slate-50 text-slate-500'
          }`}
        >
          {!result ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider">
                Ready
              </p>
              <p className="mt-2 text-base font-medium">
                Scan an attendee to see zone validation and access feedback.
              </p>
              {activeZone && (
                <p className="mt-3 text-sm opacity-80">
                  Active zone selected · action:{' '}
                  <span className="font-semibold">{action}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider">
                  {result.accessGranted ? 'Allowed' : 'Denied'}
                </p>
                <h3 className="mt-1.5 text-2xl font-bold">
                  {result.attendee?.fullName || 'Unknown attendee'}
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm opacity-80">Category</p>
                  <p className="font-semibold">
                    {result.attendee?.categoryName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm opacity-80">Zone</p>
                  <p className="font-semibold">{result.zone?.name || '—'}</p>
                </div>
              </div>
              <p className="text-sm font-medium">
                {result.denialReason || result.message}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerComponent;