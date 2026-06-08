import React from 'react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';

import { getAssetUrl } from '../../utils/backend';
const buildAssetUrl = (path) => getAssetUrl(path);

const toneMap = {
  success: {
    wrapper: 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-emerald-100',
    badge: 'bg-emerald-600 text-white',
    icon: CheckCircleIcon,
    title: 'Valid Ticket',
    colorName: 'Valid',
  },
  checkout: {
    wrapper: 'border-blue-500 bg-blue-50 text-blue-950 shadow-blue-100',
    badge: 'bg-blue-600 text-white',
    icon: ArrowLeftOnRectangleIcon,
    title: 'Checked Out',
    colorName: 'Checked Out',
  },
  already_used: {
    wrapper: 'border-amber-500 bg-amber-50 text-amber-950 shadow-amber-100',
    badge: 'bg-amber-600 text-white',
    icon: InformationCircleIcon,
    title: 'Already Used',
    colorName: 'Already Used',
  },
  error: {
    wrapper: 'border-rose-500 bg-rose-50 text-rose-950 shadow-rose-100',
    badge: 'bg-rose-600 text-white',
    icon: XCircleIcon,
    title: 'Access Denied',
    colorName: 'Invalid',
  },
  idle: {
    wrapper: 'border-slate-200 bg-white text-slate-900 shadow-slate-100',
    badge: 'bg-slate-900 text-white',
    icon: CheckCircleIcon,
    title: 'Ready to Scan',
    colorName: 'Idle',
  },
};

const ResultCard = ({ state = 'idle', attendee, message, detail, meta = [], actions }) => {
  // Determine dynamic visual tone
  let activeTone = state;
  
  if (state === 'success') {
    const isExit = meta.some(m => m.label === 'Mode' && m.value === 'Exit') || attendee?.checkedIn === false;
    if (isExit) {
      activeTone = 'checkout';
    } else {
      activeTone = 'success';
    }
  } else if (state === 'error') {
    const isAlreadyUsed = detail?.toLowerCase().includes('already') || detail?.toLowerCase().includes('used');
    if (isAlreadyUsed) {
      activeTone = 'already_used';
    } else {
      activeTone = 'error';
    }
  }

  const tone = toneMap[activeTone] || toneMap.idle;
  const Icon = tone.icon;

  return (
    <section className={`rounded-[28px] border-2 p-5 lg:p-6 shadow-xl transition-all duration-300 ${tone.wrapper}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 lg:h-16 lg:w-16 shrink-0 items-center justify-center rounded-2xl shadow-md ${tone.badge}`}>
            <Icon className="h-8 w-8 lg:h-9 lg:w-9" />
          </div>
          <div>
            <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] opacity-60">Validation Status</p>
            <h2 className="mt-1 text-2xl lg:text-3xl font-black tracking-tight leading-none">{message || tone.title}</h2>
            <p className="mt-2 text-xs lg:text-sm font-semibold opacity-85">{detail || 'Point camera viewfinder at QR to validate access.'}</p>
          </div>
        </div>
        <span className={`rounded-full px-5 py-2 text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] self-start sm:self-center shadow-sm ${tone.badge}`}>
          {tone.colorName}
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-3xl bg-white/85 backdrop-blur-sm p-5 border border-white/40">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Attendee Info</p>
          
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 border border-slate-200 shadow-inner">
              {attendee?.photo ? (
                <img src={buildAssetUrl(attendee.photo)} alt={attendee.fullName || 'Attendee'} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 text-center px-2">No Image</span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-black text-slate-900 truncate leading-none mt-1">{attendee?.fullName || 'Waiting for QR...'}</p>
              <p className="mt-2 text-sm font-bold text-cyan-700 tracking-wide uppercase">{attendee?.categoryName || attendee?.ticketCategory || 'Scan a ticket code'}</p>
              
              <div className="mt-4 grid gap-3 grid-cols-2">
                <div className="rounded-2xl bg-slate-100/90 px-4 py-3 border border-slate-200/50">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Account</p>
                  <p className="mt-1.5 text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                    {attendee?.confirmationStatus || 'Pending'}
                  </p>
                </div>
                
                <div className="rounded-2xl bg-slate-100/90 px-4 py-3 border border-slate-200/50">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Entry Logs</p>
                  <p className="mt-1.5 text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                    {attendee?.checkedIn ? 'Checked In' : 'Checked Out'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/85 backdrop-blur-sm p-5 border border-white/40">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Scan Session Details</p>
          <div className="mt-3.5 space-y-2.5">
            {meta.length > 0 ? meta.map((item) => (
              <div key={item.label} className="flex justify-between items-center rounded-2xl bg-slate-100/95 px-4 py-3 border border-slate-200/35">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">{item.value || '-'}</p>
              </div>
            )) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-xs font-medium text-slate-400 leading-relaxed">
                Scan metadata will populate here automatically.
              </div>
            )}
          </div>
        </div>
      </div>

      {actions ? <div className="mt-5">{actions}</div> : null}
    </section>
  );
};

export default ResultCard;
