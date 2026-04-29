import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ScannerComponent from '../../components/suborg/ScannerComponent';
import { getSubZones, scanSubZone } from '../../api/sub';
import toast from 'react-hot-toast';

const SubOrgZoneScannerPage = () => {
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  useEffect(() => {
    const loadZones = (eventId = currentEventId) => {
      getSubZones(eventId ? { eventId } : undefined)
      .then((response) => {
        const nextZones = response.data?.data?.zones || [];
        setZones(nextZones);
        setActiveZone(nextZones[0]?.id || nextZones[0]?.name || '');
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Unable to load assigned zones for zone scanning.';
        setZones([]);
        setActiveZone('');
        toast.error(message);
      });
    };

    loadZones(currentEventId);

    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setCurrentEventId(nextId);
      loadZones(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleSubmit = async ({ value, mode, zoneId, action }) => {
    setSubmitting(true);
    try {
      const payload = { zoneId, eventId: currentEventId, action };
      if (mode === 'rfid') payload.rfidId = value;
      else payload.qrToken = value;
      const response = await scanSubZone(payload);
      setResult({ ...response.data?.data, message: response.data?.message });
    } catch (error) {
      setResult({ ...(error.response?.data?.data || {}), message: error.response?.data?.message, denialReason: error.response?.data?.data?.denialReason || error.response?.data?.message, accessGranted: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
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
    </DashboardLayout>
  );
};

export default SubOrgZoneScannerPage;
