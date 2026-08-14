import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import ScannerComponent from '../../components/suborg/ScannerComponent';
import { getSubZones, scanSubZone } from '../../api/sub';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, QrCodeIcon, MapPinIcon } from '@heroicons/react/24/outline';

const SubOrgZoneScannerPage = () => {
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const loadZones = (eventId = currentEventId) => {
    setLoading(true);
    getSubZones(eventId ? { eventId } : undefined)
      .then((response) => {
        const nextZones = response.data?.data?.zones || [];
        setZones(nextZones);
        setActiveZone((prev) => {
          const stillValid = nextZones.some(
            (z) => String(z.id || z.name) === String(prev)
          );
          if (stillValid) return prev;
          return nextZones[0]?.id || nextZones[0]?.name || '';
        });
      })
      .catch((error) => {
        const message =
          error.response?.data?.message ||
          'Unable to load assigned zones for zone scanning.';
        setZones([]);
        setActiveZone('');
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadZones(currentEventId);

    const handleEventSelect = (event) => {
      const nextId = event.detail ? String(event.detail) : '';
      if (!nextId || nextId === 'undefined') return;
      setCurrentEventId(nextId);
      localStorage.setItem('lastSelectedEventId', nextId);
      setResult(null);
      loadZones(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleSubmit = async ({ value, mode, zoneId, action }) => {
    setSubmitting(true);
    setResult(null);
    try {
      const payload = { zoneId, eventId: currentEventId, action };
      if (mode === 'rfid') payload.rfidId = value;
      else payload.qrToken = value;
      const response = await scanSubZone(payload);
      setResult({
        ...response.data?.data,
        message: response.data?.message,
      });
    } catch (error) {
      setResult({
        ...(error.response?.data?.data || {}),
        message: error.response?.data?.message,
        denialReason:
          error.response?.data?.data?.denialReason ||
          error.response?.data?.message,
        accessGranted: false,
      });
    } finally {
      setSubmitting(false);
    }
  };

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
                    Zone Scanner
                  </p>
                </div>
                <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Zone access control
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Validate zone access and toggle entry or exit. Decisions stay
                  visible from a distance.
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
              </div>
            </div>
          </div>
        </Card>

        {/* No zones empty state */}
        {!loading && zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MapPinIcon className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No zones assigned
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              Ask the main organiser to assign at least one zone before you can
              scan.
            </p>
          </div>
        ) : (
          <ScannerComponent
            title="Zone scanner"
            description="Validate zone access and toggle entry or exit while keeping the decision visible from a distance."
            zones={zones}
            activeZone={activeZone}
            onZoneChange={setActiveZone}
            onSubmit={handleSubmit}
            submitting={submitting}
            result={result}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgZoneScannerPage;