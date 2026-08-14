import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ZoneCard from '../../components/suborg/ZoneCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getSubZones } from '../../api/sub';
import toast from 'react-hot-toast';
import {
  MapPinIcon,
  UsersIcon,
  CheckBadgeIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1.5 text-xs text-slate-500 truncate">{subtitle}</p>
        )}
      </div>
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const SubOrgZonesPage = () => {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState({ event: null, zones: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const load = (eventId = currentEventId) => {
    setLoading(true);
    getSubZones({ eventId })
      .then((response) => {
        const data = response.data?.data || { event: null, zones: [] };
        setWorkspace({
          event: data.event || null,
          zones: Array.isArray(data.zones) ? data.zones : [],
        });
        setLoadError('');

        if (data.event?._id && String(data.event._id) !== String(eventId)) {
          setCurrentEventId(String(data.event._id));
          localStorage.setItem('lastSelectedEventId', String(data.event._id));
        }
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 404 || status === 403) {
          localStorage.removeItem('lastSelectedEventId');
          setCurrentEventId('');
        }
        const message =
          error.response?.data?.message || 'Unable to load assigned zones.';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(currentEventId);

    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const zones = workspace.zones || [];
  const totalCapacity = zones.reduce(
    (sum, z) => sum + (Number(z.capacity) || 0),
    0
  );
  const totalCheckedIn = zones.reduce(
    (sum, z) =>
      sum + (Number(z.checkedInCount || z.checkedIn || z.occupancy) || 0),
    0
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    to="/suborg/dashboard"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-600 hover:text-blue-700"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                  <span className="text-slate-300">·</span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    My Zones
                  </p>
                </div>
                <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
                  {workspace.event?.name || 'Assigned Event'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Monitor only the zones assigned to your role. Each card keeps
                  the key operational numbers close at hand.
                </p>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 min-w-[100px] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Zones
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900">
                    {loading ? '—' : zones.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 min-w-[100px] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Capacity
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900">
                    {loading ? '—' : totalCapacity || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI cards — same MetricCard pattern as organiser */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Assigned Zones"
            value={loading ? '—' : zones.length}
            subtitle="In your scope"
            icon={MapPinIcon}
          />
          <MetricCard
            title="Total Capacity"
            value={loading ? '—' : totalCapacity || 0}
            subtitle="Across assigned zones"
            icon={UsersIcon}
          />
          <MetricCard
            title="Checked In"
            value={loading ? '—' : totalCheckedIn}
            subtitle={
              totalCapacity > 0
                ? `${Math.min(
                    100,
                    Math.round((totalCheckedIn / totalCapacity) * 100)
                  )}% of capacity`
                : 'No capacity set'
            }
            icon={CheckBadgeIcon}
          />
        </section>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {/* Zone grid */}
        {loading ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))}
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MapPinIcon className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No zones assigned yet
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              Ask the main organiser to assign at least one zone to your
              account.
            </p>
            <Button
              size="sm"
              className="mt-5 bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => navigate('/suborg')}
            >
              Back to dashboard
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id || zone._id || zone.name}
                zone={zone}
                onViewAttendees={() =>
                  navigate(
                    `/suborg/attendees?zone=${encodeURIComponent(
                      zone.id || zone._id || zone.name
                    )}`
                  )
                }
                onMonitor={() =>
                  navigate(
                    `/suborg/zone-scan?zone=${encodeURIComponent(
                      zone.id || zone._id || zone.name
                    )}`
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgZonesPage;