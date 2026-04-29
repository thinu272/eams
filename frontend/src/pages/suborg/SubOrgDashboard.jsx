import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubDashboard } from '../../api/sub';
import toast from 'react-hot-toast';

const metricCards = [
  { key: 'totalAttendees', label: 'Attendees in scope', accent: 'text-slate-900' },
  { key: 'checkedInCount', label: 'Checked in', accent: 'text-emerald-600' },
  { key: 'pendingVerifications', label: 'Pending verification', accent: 'text-amber-600' },
  { key: 'zoneCount', label: 'Assigned zones', accent: 'text-sky-600' },
];

const formatTime = (value) => new Date(value).toLocaleString();

const SubOrgDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  const load = (eventId) => {
    setLoading(true);
    getSubDashboard({ eventId })
      .then((response) => {
        setData(response.data?.data || null);
        setLoadError('');
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Unable to load sub-organiser workspace.';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load(currentEventId);

    const handleEventSelect = (e) => {
      const newId = e.detail;
      setCurrentEventId(newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => {
      window.removeEventListener('entrynex:event-select', handleEventSelect);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Sub Organiser workspace</p>
          <div className="mt-3">
            <div>
              <h1 className="text-3xl font-bold">{data?.event?.name || 'Assigned event'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Keep your zone operations fast and clear. This workspace only shows the zones and attendees assigned to you.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <div key={card.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className={`mt-3 text-3xl font-bold ${card.accent}`}>
                {loading ? '-' : data?.metrics?.[card.key] || 0}
              </p>
            </div>
          ))}
        </div>

        {loadError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Assigned zones</h2>
                <p className="mt-1 text-sm text-slate-500">Capacity and operational visibility for your current scope.</p>
              </div>
              <Link to="/suborg/zones" className="text-sm font-semibold text-sky-700">Open zone workspace</Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(data?.zones || []).map((zone) => (
                <div key={zone.id || zone.name} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{zone.name}</h3>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">cap {zone.capacity || 0}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Use entry and zone scans here only. Other event areas stay hidden.</p>
                </div>
              ))}
              {!loading && (data?.zones || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 md:col-span-2">
                  No zones assigned yet. Ask the main organiser to assign at least one zone.
                </div>
              )}
            </div>
          </div>

          {/* Managed Categories Section */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 font-bold">Your Managed Categories</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {data?.categories?.map((cat) => (
                <span 
                  key={cat.id} 
                  className="inline-flex items-center rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10"
                >
                  {cat.name}
                </span>
              ))}
              {(!data?.categories || data.categories.length === 0) && (
                <p className="text-xs italic text-slate-400">No specific categories assigned.</p>
              )}
            </div>
            <p className="mt-4 text-[10px] italic text-slate-400">
              You can only view and manage attendees belonging to these categories.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Last 5 actions</h2>
                <p className="mt-1 text-sm text-slate-500">Recent entry and zone activity inside your assignment.</p>
              </div>
              <Link to="/suborg/logs" className="text-sm font-semibold text-sky-700">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {(data?.activity || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.action}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.attendeeName} - {item.zoneName}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.actorName} - {formatTime(item.timestamp)}</p>
                </div>
              ))}
              {!loading && (data?.activity || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No actions recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SubOrgDashboard;
