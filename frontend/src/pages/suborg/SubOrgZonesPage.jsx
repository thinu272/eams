import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ZoneCard from '../../components/suborg/ZoneCard';
import { getSubZones } from '../../api/sub';
import toast from 'react-hot-toast';

const SubOrgZonesPage = () => {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState({ event: null, zones: [] });
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  const load = (eventId = currentEventId) => {
    getSubZones({ eventId })
      .then((response) => {
        setWorkspace(response.data?.data || { event: null, zones: [] });
        setLoadError('');
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Unable to load assigned zones.';
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(() => {
    load();

    const handleEventSelect = (e) => {
      const newId = e.detail;
      setCurrentEventId(newId);
      load(newId);
    };

    window.addEventListener('eams:event-select', handleEventSelect);
    return () => window.removeEventListener('eams:event-select', handleEventSelect);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">My zones</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{workspace.event?.name || 'Assigned event'}</h1>
          <p className="mt-2 text-sm text-slate-500">Monitor only the zones assigned to your role. Each card keeps the key operational numbers close at hand.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {workspace.zones.map((zone) => (
            <ZoneCard
              key={zone.id || zone.name}
              zone={zone}
              onViewAttendees={() => navigate(`/suborg/attendees?zone=${encodeURIComponent(zone.id || zone.name)}`)}
              onMonitor={() => navigate(`/suborg/zone-scan?zone=${encodeURIComponent(zone.id || zone.name)}`)}
            />
          ))}
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

export default SubOrgZonesPage;
