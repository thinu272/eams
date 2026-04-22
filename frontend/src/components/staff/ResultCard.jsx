import React from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

const buildAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const baseUrl = process.env.REACT_APP_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const toneMap = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    icon: CheckCircleIcon,
    title: 'Access Granted',
  },
  error: {
    wrapper: 'border-rose-200 bg-rose-50 text-rose-950',
    badge: 'bg-rose-600 text-white',
    icon: XCircleIcon,
    title: 'Access Denied',
  },
  idle: {
    wrapper: 'border-slate-200 bg-white text-slate-900',
    badge: 'bg-slate-900 text-white',
    icon: CheckCircleIcon,
    title: 'Ready to Scan',
  },
};

const ResultCard = ({ state = 'idle', attendee, message, detail, meta = [], actions }) => {
  const tone = toneMap[state] || toneMap.idle;
  const Icon = tone.icon;

  return (
    <section className={`rounded-[28px] border p-6 shadow-sm transition-colors ${tone.wrapper}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tone.badge}`}>
            <Icon className="h-9 w-9" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] opacity-60">Scan Result</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">{message || tone.title}</h2>
            <p className="mt-2 text-sm font-medium opacity-80">{detail || 'Scan a ticket to validate event access.'}</p>
          </div>
        </div>
        <span className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.2em] ${tone.badge}`}>
          {state === 'success' ? 'Green' : state === 'error' ? 'Red' : 'Idle'}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl bg-white/70 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Attendee</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100">
              {attendee?.photo ? (
                <img src={buildAssetUrl(attendee.photo)} alt={attendee.fullName || 'Attendee'} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">No Photo</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-2xl font-black text-slate-900">{attendee?.fullName || 'Waiting for a scan'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">{attendee?.categoryName || attendee?.ticketCategory || 'Ticket category will appear here'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{attendee?.confirmationStatus || (state === 'success' ? 'Confirmed' : 'Pending')}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Entry</p>
                  <p className="mt-2 text-sm font-bold text-slate-900">{attendee?.checkedIn ? 'Already used' : 'Not used yet'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/70 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Access Details</p>
          <div className="mt-3 space-y-3">
            {meta.length > 0 ? meta.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-100 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-bold text-slate-900">{item.value || '-'}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                Assigned zone, gate, and validation details will show here.
              </div>
            )}
          </div>
        </div>
      </div>

      {actions ? <div className="mt-6">{actions}</div> : null}
    </section>
  );
};

export default ResultCard;
