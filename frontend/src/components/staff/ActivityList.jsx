import React from 'react';

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const ActivityList = ({ title = 'Activity Log', items = [], emptyMessage = 'No recent activity.' }) => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Operations</p>
        <h2 className="mt-2 text-xl font-black text-slate-900">{title}</h2>
      </div>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-slate-600">
        Last {items.length || 0}
      </span>
    </div>

    <div className="mt-5 space-y-3">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        items.map((item, index) => (
          <div key={item.id || item._id || `${item.timestamp}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{item.attendeeName || item.attendee?.fullName || item.snapshot?.fullName || item.fullName || 'Unknown attendee'}</p>
                <p className="mt-1 text-sm font-medium text-slate-500">{item.zoneName || item.gateName || item.zone || item.gateId || 'Assigned gate/zone'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${
                item.status === 'error' || item.accessGranted === false
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {item.status || (item.accessGranted === false ? 'Denied' : 'Allowed')}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <span>{item.action || item.message || item.denialReason || 'Scan recorded'}</span>
              <span>{formatTime(item.timestamp)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  </section>
);

export default ActivityList;
