import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ScannerComponent from '../../components/suborg/ScannerComponent';
import { getSubZones, scanSubEntry, assignSubRfid } from '../../api/sub';
import { getMyEvents } from '../../api/events';
import toast from 'react-hot-toast';

const SubOrgEntryScannerPage = () => {
  const [zones, setZones] = useState([]);
  const [activeZone, setActiveZone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [rfidEnabled, setRfidEnabled] = useState(false);
  const [currentAttendee, setCurrentAttendee] = useState(null);

  useEffect(() => {
    const loadZones = (eventId = currentEventId) => {
      getSubZones(eventId ? { eventId } : undefined)
      .then((response) => {
        const nextZones = response.data?.data?.zones || [];
        setZones(nextZones);
        // Default to main entry for entry scanner
        setActiveZone('main-entry');
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Unable to load assigned zones for entry scanning.';
        setZones([]);
        setActiveZone('main-entry');
        toast.error(message);
      });
    };

    loadZones(currentEventId);
    getMyEvents().then((response) => {
      const event = (response.data?.data?.events || []).find((item) => item._id === currentEventId);
      setRfidEnabled(event?.settings?.rfidEnabled === true);
    }).catch(() => setRfidEnabled(false));

    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setCurrentEventId(nextId);
      getMyEvents().then((response) => {
        const event = (response.data?.data?.events || []).find((item) => item._id === nextId);
        setRfidEnabled(event?.settings?.rfidEnabled === true);
      }).catch(() => setRfidEnabled(false));
      loadZones(nextId);
      setResult(null);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleSubmit = async ({ value, mode, zoneId, action }) => {
    if (action === 'CLEAR') {
      setResult(null);
      setCurrentAttendee(null);
      return;
    }

    setSubmitting(true);
    try {
      const payload = { zoneId, eventId: currentEventId, action };
      if (mode === 'rfid') payload.rfidId = value;
      else payload.qrToken = value;
      const response = await scanSubEntry(payload);
      const scanResult = { ...response.data?.data, message: response.data?.message };
      setResult(scanResult);
      if (scanResult.attendee) {
        setCurrentAttendee(scanResult.attendee);
      }
    } catch (error) {
      const errorResult = {
        ...(error.response?.data?.data || {}),
        message: error.response?.data?.message,
        denialReason: error.response?.data?.data?.denialReason || error.response?.data?.message,
        accessGranted: false,
        suggestCheckOut: error.response?.data?.data?.suggestCheckOut || false,
      };
      setResult(errorResult);
      setCurrentAttendee(errorResult.attendee || null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignRfid = async (rfidTag) => {
    if (!currentAttendee?._id) {
      throw new Error('No attendee selected');
    }
    const response = await assignSubRfid(currentAttendee._id, { rfidTag, eventId: currentEventId });
    // Update the current result with the new RFID
    if (result) {
      setResult({
        ...result,
        attendee: {
          ...result.attendee,
          rfidTag: rfidTag
        }
      });
    }
    // Also update currentAttendee
    setCurrentAttendee({
      ...currentAttendee,
      rfidTag: rfidTag
    });
    return response.data;
  };

  const handleSwitchToCheckOut = () => {
    setAction('CHECK_OUT');
    setResult(null);
  };

  return (
    <DashboardLayout>
      <ScannerComponent
        title="Entry Scanner"
        description="Check-in/out attendees at main gates. QR + RFID support with RFID assignment."
        zones={zones}
        activeZone={activeZone}
        onZoneChange={(zoneId) => {
          setActiveZone(zoneId);
          setResult(null);
        }}
        onSubmit={handleSubmit}
        onAssignRfid={rfidEnabled ? handleAssignRfid : undefined}
        onSwitchToCheckOut={() => setAction('CHECK_OUT')}
        submitting={submitting}
        result={result}
        rfidEnabled={rfidEnabled}
        scannerType="entry"
      />
    </DashboardLayout>
  );
};

export default SubOrgEntryScannerPage;
