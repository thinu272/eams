import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubLogs, getSubZones } from '../../api/sub';
import toast from 'react-hot-toast';

const formatTime = (value) => new Date(value).toLocaleString();

const SubOrgActivityLogsPage = () => {
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState('');
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  const load = async (nextZone = zone, eventId = currentEventId) => {
    try {
      const response = await getSubLogs({ 
        zone: nextZone || undefined, 
        eventId 
      });
      setLogs(response.data?.data?.logs || []);
      setLoadError('');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to load activity logs.';
      setLogs([]);
      setLoadError(message);
      toast.error(message);
    }
  };

  const loadZones = (eventId = currentEventId) => {
    getSubZones({ eventId })
      .then((response) => {
        const nextZones = response.data?.data?.zones || [];
        setZones(nextZones);
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Unable to load assigned zones.';
        setZones([]);
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(() => {
    loadZones();
    load('');

    const handleEventSelect = (e) => {
      const newId = e.detail;
      setCurrentEventId(newId);
      loadZones(newId);
      load('', newId);
    };

    window.addEventListener('eams:event-select', handleEventSelect);
    return () => window.removeEventListener('eams:event-select', handleEventSelect);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Activity logs</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Recent operational actions</h1>
            <p className="mt-2 text-sm text-slate-500">Entry scans and zone validations limited to your own assignment.</p>
          </div>
          <select
            value={zone}
            onChange={(event) => {
              const nextZone = event.target.value;
              setZone(nextZone);
              load(nextZone);
            }}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
          >
            <option value="">All assigned zones</option>
            {zones.map((item) => <option key={item.id || item.name} value={item.id || item.name}>{item.name}</option>)}
          </select>
        </div>

        <div className="space-y-3">
          {logs.map((item) => (
            <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{item.action}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.attendeeName} - {item.zoneName}</p>
                  <p className="mt-1 text-xs text-slate-400">Handled by {item.actorName}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {item.status}
                  </span>
                  <p className="mt-2 text-xs text-slate-400">{formatTime(item.timestamp)}</p>
                </div>
              </div>
              {item.detail && <p className="mt-3 text-sm text-slate-500">{item.detail}</p>}
            </article>
          ))}
          {logs.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
              No logs found for the selected zone.
            </div>
          )}
        </div>
        {loadError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {loadError}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgActivityLogsPage;
