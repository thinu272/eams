import React from 'react';

const ZoneCard = ({ zone, onViewAttendees, onMonitor }) => {
  const occupancy = zone.capacity > 0 ? Math.min(100, Math.round((zone.currentOccupancy / zone.capacity) * 100)) : 0;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Assigned zone</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">{zone.name}</h3>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
          {zone.currentOccupancy}/{zone.capacity || '-'} inside
        </span>
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Occupancy</span>
            <span>{occupancy}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-sky-500" style={{ width: `${occupancy}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-sm">
          <div>
            <p className="text-slate-500">Attendees</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{zone.attendeeCount}</p>
          </div>
          <div>
            <p className="text-slate-500">Categories</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{zone.allowedCategories?.length || 0}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Allowed tickets</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(zone.allowedCategories || []).length > 0 ? zone.allowedCategories.map((category) => (
              <span key={category.id || category.name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                {category.name}
              </span>
            )) : (
              <span className="text-sm text-slate-500">No category mapping yet.</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => onViewAttendees?.(zone)}
          className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          View attendees
        </button>
        <button
          type="button"
          onClick={() => onMonitor?.(zone)}
          className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Monitor entries
        </button>
      </div>
    </article>
  );
};

export default ZoneCard;
