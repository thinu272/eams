import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ArrowLeftIcon,
  QrCodeIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import QRScannerComponent from '../../components/events/QRScannerComponent';
import { getMyEvents } from '../../api/events';
import { getAttendeeByQr, getEventRfidStatus, assignRfidToAttendee } from '../../api/entry';
import { validateRfidTag, unassignRfidTag } from '../../api/rfid';
import { useAuth } from '../../context/AuthContext';
import { playFeedbackTone, triggerHaptic } from './staffUtils';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const RfidAssignmentPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [eventRfidStatus, setEventRfidStatus] = useState(null);

  const [scanStep, setScanStep] = useState('qr'); // 'qr' | 'rfid' | 'complete'
  const [qrToken, setQrToken] = useState('');
  const [attendee, setAttendee] = useState(null);
  const [rfidTag, setRfidTag] = useState('');
  const [rfidValidation, setRfidValidation] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingRfid, setIsValidatingRfid] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState(null);

  const rfidInputRef = useRef(null);

  // Load events
  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);

      const isValidEvent = nextEvents.some((e) => e._id === selectedEventId);
      const fallbackEventId =
        (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';

      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, []);

  // Fetch RFID status when event changes
  useEffect(() => {
    if (selectedEventId) {
      getEventRfidStatus(selectedEventId)
        .then((response) => {
          setEventRfidStatus(response.data?.data || { rfidEnabled: false });
        })
        .catch(() => {
          setEventRfidStatus({ rfidEnabled: false });
        });
    }
  }, [selectedEventId]);

  // Focus RFID input when in RFID step
  useEffect(() => {
    if (scanStep === 'rfid' && rfidInputRef.current) {
      setTimeout(() => rfidInputRef.current?.focus(), 100);
    }
  }, [scanStep]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    resetAssignment();
  };

  const resetAssignment = () => {
    setScanStep('qr');
    setQrToken('');
    setAttendee(null);
    setRfidTag('');
    setRfidValidation(null);
    setIsProcessing(false);
    setIsValidatingRfid(false);
    setIsAssigning(false);
    setAssignmentResult(null);
  };

  const handleQrScan = async (rawToken) => {
    const token = rawToken.trim();
    if (!token || !selectedEventId) return;

    setQrToken(token);
    setIsProcessing(true);

    try {
      const response = await getAttendeeByQr(token, selectedEventId);
      const data = response.data?.data;

      if (data && data.attendee) {
        setAttendee(data.attendee);
        playFeedbackTone(true);
        triggerHaptic(true);
        setScanStep('rfid');
        toast.success('Attendee found');
      } else {
        playFeedbackTone(false);
        triggerHaptic(false);
        toast.error('Attendee not found for this QR token');
        setQrToken('');
      }
    } catch (error) {
      playFeedbackTone(false);
      triggerHaptic(false);
      toast.error(error.response?.data?.message || 'Failed to lookup attendee');
      setQrToken('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRfidInputChange = async (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setRfidTag(value);

    // Auto-validate when 10 digits entered
    if (value.length === 10 && attendee) {
      await validateRfid(value);
    }
  };

  const validateRfid = async (tagValue) => {
    const tag = tagValue || rfidTag;
    if (tag.length !== 10) return;

    setIsValidatingRfid(true);
    try {
      const response = await validateRfidTag(tag, {
        eventId: selectedEventId,
        categoryId: attendee?.categoryId,
      });
      const data = response.data?.data;
      setRfidValidation(data);
    } catch (error) {
      setRfidValidation({
        valid: false,
        available: false,
        message: error.response?.data?.message || 'Validation failed',
      });
    } finally {
      setIsValidatingRfid(false);
    }
  };

  const handleAssignRfid = async () => {
    if (!attendee || !qrToken || rfidTag.length !== 10) return;

    setIsAssigning(true);
    try {
      const response = await assignRfidToAttendee({
        qrToken,
        rfidTag,
        eventId: selectedEventId,
      });
      const data = response.data?.data;

      setAssignmentResult({
        success: true,
        attendee: data.attendee,
        rfidTag: data.rfidTag,
        message: 'RFID assigned successfully',
      });
      setScanStep('complete');
      playFeedbackTone(true);
      triggerHaptic(true);
      toast.success('RFID tag assigned to attendee');
    } catch (error) {
      setAssignmentResult({
        success: false,
        message: error.response?.data?.message || 'Assignment failed',
      });
      playFeedbackTone(false);
      triggerHaptic(false);
      toast.error(error.response?.data?.message || 'Failed to assign RFID');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignRfid = async () => {
    if (!attendee?.rfidTag) return;

    setIsProcessing(true);
    try {
      await unassignRfidTag(attendee.rfidTag, 'Staff initiated unassignment');
      setAttendee((prev) => ({ ...prev, rfidTag: null }));
      toast.success('RFID tag unassigned');
      playFeedbackTone(true);
      triggerHaptic(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to unassign RFID');
      playFeedbackTone(false);
      triggerHaptic(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartNewAssignment = () => {
    resetAssignment();
  };

  const currentEvent = events.find((e) => e._id === selectedEventId);
  const canProceedToRfid = scanStep === 'rfid' && rfidTag.length === 10 && rfidValidation?.valid && rfidValidation?.available;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit RFID Console
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              RFID Assignment
            </p>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            QR-to-RFID Assignment
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Scan attendee QR code, then assign an available RFID tag
          </p>
        </div>

        {/* Event selector */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Select Event
            </label>
            {eventRfidStatus && (
              <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                eventRfidStatus.rfidEnabled
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {eventRfidStatus.rfidEnabled ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    RFID Enabled
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    RFID Disabled
                  </>
                )}
              </span>
            )}
          </div>
          <select
            value={selectedEventId}
            onChange={(e) => handleEventChange(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">Select an event</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        {/* Progress steps */}
        {selectedEventId && (
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${scanStep === 'qr' ? 'text-blue-600' : 'text-slate-400'}`}>
              <QrCodeIcon className="h-5 w-5" />
              <span className="text-xs font-semibold">1. Scan QR</span>
            </div>
            <div className={`h-0.5 w-16 ${scanStep !== 'qr' ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <div className={`flex items-center gap-2 ${scanStep === 'rfid' ? 'text-blue-600' : scanStep === 'complete' ? 'text-emerald-600' : 'text-slate-400'}`}>
              <IdentificationIcon className="h-5 w-5" />
              <span className="text-xs font-semibold">2. Scan RFID</span>
            </div>
            <div className={`h-0.5 w-16 ${scanStep === 'complete' ? 'bg-emerald-600' : 'bg-slate-200'}`} />
            <div className={`flex items-center gap-2 ${scanStep === 'complete' ? 'text-emerald-600' : 'text-slate-400'}`}>
              <CheckCircleIcon className="h-5 w-5" />
              <span className="text-xs font-semibold">3. Complete</span>
            </div>
          </div>
        )}

        {/* Step 1: QR Scanner */}
        {selectedEventId && scanStep === 'qr' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Step 1: Scan Attendee QR Code</h2>
              <p className="mt-1 text-sm text-slate-500">
                Position the QR code within the scanner frame
              </p>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
                <div className="aspect-[4/3] w-full sm:aspect-video">
                  <QRScannerComponent
                    onScanSuccess={(value) => handleQrScan(value)}
                    onScanError={() => {}}
                    fps={12}
                    qrbox={260}
                  />
                </div>
              </div>

              {isProcessing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="text-sm font-medium">Looking up attendee...</span>
                </div>
              )}
            </div>

            {/* Manual QR entry */}
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">Manual QR Entry</h3>
              <input
                type="text"
                value={qrToken}
                onChange={(e) => setQrToken(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && qrToken) handleQrScan(qrToken);
                }}
                placeholder="Paste or type QR token..."
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => handleQrScan(qrToken)}
                disabled={!qrToken || isProcessing}
                className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                {isProcessing ? 'Looking up...' : 'Lookup Attendee'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: RFID Scanner */}
        {scanStep === 'rfid' && attendee && (
          <div className="space-y-5">
            {/* Attendee info */}
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserIcon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-900">{attendee.fullName}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {attendee.categoryName || 'General'}
                    </span>
                    {attendee.rfidTag ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        RFID: {attendee.rfidTag}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        No RFID assigned
                      </span>
                    )}
                  </div>
                  {attendee.checkedIn && (
                    <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <ClockIcon className="h-3.5 w-3.5" />
                      Currently inside venue
                    </p>
                  )}
                </div>
                {attendee.rfidTag && (
                  <button
                    type="button"
                    onClick={handleUnassignRfid}
                    disabled={isProcessing}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700"
                  >
                    Unassign RFID
                  </button>
                )}
              </div>
            </div>

            {/* RFID Disabled Message */}
            {!eventRfidStatus?.rfidEnabled ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <XCircleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800">RFID Access Disabled</h3>
                    <p className="mt-1 text-sm text-amber-700">
                      RFID access control is not enabled for this event. Please enable it in Event Settings first.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* RFID Scanner for enabled events */
              <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Step 2: Scan Available RFID Tag</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tap or scan an available RFID tag (10-digit)
                </p>

                <div className="mt-5 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 text-center">
                  <IdentificationIcon className="mx-auto h-12 w-12 text-blue-600" />
                  <p className="mt-3 font-semibold text-slate-900">RFID Reader Ready</p>
                  <p className="mt-1 text-sm text-slate-600">Tap a card or enter the 10-digit tag ID</p>

                  <input
                    ref={rfidInputRef}
                    type="text"
                    value={rfidTag}
                    onChange={handleRfidInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceedToRfid) handleAssignRfid();
                    }}
                    maxLength={10}
                    inputMode="numeric"
                    placeholder="Waiting for RFID..."
                    className="mt-5 w-full rounded-xl border border-blue-300 bg-white px-4 py-4 text-center font-mono text-xl tracking-[0.3em] outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Validation status */}
                  {isValidatingRfid && (
                    <p className="mt-3 text-sm text-blue-600">Validating tag...</p>
                  )}
                  {rfidValidation && !isValidatingRfid && (
                    <div className={`mt-3 flex items-center justify-center gap-2 ${rfidValidation.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {rfidValidation.valid ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5" />
                          <span className="text-sm font-medium">{rfidValidation.message || 'Tag available'}</span>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-5 w-5" />
                          <span className="text-sm font-medium">{rfidValidation.message || 'Tag not available'}</span>
                        </>
                      )}
                    </div>
                  )}
                  {!rfidValidation && rfidTag.length === 10 && (
                    <p className="mt-3 text-sm text-amber-600">Waiting for validation...</p>
                  )}
                  {rfidTag.length !== 10 && (
                    <p className="mt-3 text-sm text-slate-500">Enter 10-digit RFID tag to continue</p>
                  )}
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={resetAssignment}
                    className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignRfid}
                    disabled={rfidTag.length !== 10 || isAssigning}
                    className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-blue-700 disabled:opacity-40"
                  >
                    {isAssigning ? 'Assigning...' : 'Assign RFID'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Complete */}
        {scanStep === 'complete' && assignmentResult && (
          <div className="space-y-5">
            <div className={`rounded-2xl border p-5 shadow-sm ${assignmentResult.success ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
              <div className="flex items-center gap-3">
                {assignmentResult.success ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircleIcon className="h-7 w-7" />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    <XCircleIcon className="h-7 w-7" />
                  </div>
                )}
                <div>
                  <h2 className={`text-lg font-bold ${assignmentResult.success ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {assignmentResult.success ? 'RFID Assigned Successfully' : 'Assignment Failed'}
                  </h2>
                  <p className={`text-sm ${assignmentResult.success ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {assignmentResult.message}
                  </p>
                </div>
              </div>

              {assignmentResult.success && (
                <div className="mt-4 rounded-xl bg-white/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">RFID Tag</span>
                    <span className="font-mono text-lg font-bold text-emerald-700">{assignmentResult.rfidTag}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Attendee</span>
                    <span className="font-medium text-slate-900">{assignmentResult.attendee?.fullName}</span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleStartNewAssignment}
              className="w-full rounded-xl bg-blue-600 py-4 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-blue-700"
            >
              Assign Another RFID
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RfidAssignmentPage;