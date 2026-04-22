import React, { useRef, useState } from 'react';
import QRScannerComponent from '../events/QRScannerComponent';

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

const ScannerComponent = ({ title, description, zones, activeZone, onZoneChange, onSubmit, submitting, result }) => {
  const [scanMode, setScanMode] = useState('qr');
  const [manualValue, setManualValue] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef(null);

  const submitValue = async (value) => {
    const nextValue = parseScannedValue(value);
    if (!nextValue) return;
    await onSubmit({ value: nextValue, mode: scanMode, zoneId: activeZone });
    setManualValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px,1fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{description}</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Zone</label>
            <select
              value={activeZone}
              onChange={(event) => onZoneChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            >
              {zones.map((zone) => (
                <option key={zone.id || zone.name} value={zone.id || zone.name}>{zone.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Scan mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setScanMode('qr')} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${scanMode === 'qr' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                QR
              </button>
              <button type="button" onClick={() => setScanMode('rfid')} className={`rounded-2xl px-4 py-3 text-sm font-semibold ${scanMode === 'rfid' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                RFID
              </button>
            </div>
          </div>

          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await submitValue(manualValue);
            }}
            className="space-y-3"
          >
            <input
              ref={inputRef}
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder={scanMode === 'qr' ? 'Paste or scan QR token' : 'Enter RFID id'}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            />
            <button type="submit" disabled={submitting || !activeZone} className="w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Processing...' : 'Submit scan'}
            </button>
          </form>

          <button type="button" onClick={() => setShowCamera((value) => !value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {showCamera ? 'Hide camera' : 'Open camera scanner'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {showCamera && scanMode === 'qr' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <QRScannerComponent
              onScanSuccess={(value) => submitValue(value)}
              onScanError={() => {}}
              fps={12}
              qrbox={260}
              scanCooldownMs={1800}
            />
          </div>
        )}

        <div className={`rounded-3xl p-6 shadow-sm ${result?.accessGranted ? 'bg-emerald-600 text-white' : result ? 'bg-rose-600 text-white' : 'border border-dashed border-slate-300 bg-slate-50 text-slate-500'}`}>
          {!result ? (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">Ready</p>
              <p className="mt-2 text-lg">Scan an attendee to see zone validation and access feedback.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">{result.accessGranted ? 'Allowed' : 'Denied'}</p>
                <h3 className="mt-2 text-2xl font-bold">{result.attendee?.fullName || 'Unknown attendee'}</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm opacity-80">Category</p>
                  <p className="font-semibold">{result.attendee?.categoryName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm opacity-80">Zone</p>
                  <p className="font-semibold">{result.zone?.name || '-'}</p>
                </div>
              </div>
              <p className="text-sm font-medium">{result.denialReason || result.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerComponent;
