import React, { useEffect, useMemo, useState } from 'react';
import { getMyEvents } from '../../api/events';
import { getAttendees, verifyPhoto, rejectPhoto } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const photoColors = {
  verified: 'green',
  pending: 'yellow',
  rejected: 'red',
};

const buildAssetUrl = (photoPath) => {
  if (!photoPath) return '';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) return photoPath;
  const base = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
  return `${base}/${photoPath}`;
};

const PhotoVerifyPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) {
        setSelectedEvent(myEvents[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;

    setLoading(true);
    getAttendees({ eventId: selectedEvent, limit: 100 })
      .then((response) => {
        const withPhotos = (response.data?.data?.attendees || []).filter((attendee) => attendee.photo);
        setAttendees(withPhotos);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent]);

  const pending = useMemo(
    () => attendees.filter((attendee) => attendee.photoVerificationStatus === 'pending'),
    [attendees]
  );

  const reviewed = useMemo(
    () => attendees.filter((attendee) => attendee.photoVerificationStatus !== 'pending'),
    [attendees]
  );

  const updatePhotoStatus = async (status) => {
    if (!selectedAttendee) return;
    if (status === 'rejected' && !rejectionReason.trim()) {
      toast.error('Add a rejection reason before rejecting the photo');
      return;
    }

    setSubmitting(true);
    try {
      if (status === 'rejected') {
        await rejectPhoto({
          attendeeId: selectedAttendee._id,
          reason: rejectionReason.trim(),
        });
        toast.success('Photo rejected and resubmit notification sent');
      } else {
        await verifyPhoto(selectedAttendee._id, {
          status,
          rejectionReason: status === 'rejected' ? rejectionReason.trim() : undefined,
        });
        toast.success(`Photo ${status}`);
      }
      setAttendees((current) =>
        current.map((attendee) =>
          attendee._id === selectedAttendee._id
            ? {
                ...attendee,
                photoVerificationStatus: status,
                photoRejectionReason: status === 'rejected' ? rejectionReason.trim() : '',
              }
            : attendee
        )
      );
      setSelectedAttendee(null);
      setRejectionReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Photo update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Photo Verification</h1>
            <p className="text-sm text-gray-500">Inspect uploaded attendee photos, preview them at full size, and mark each one as verified or rejected.</p>
          </div>
          <select
            value={selectedEvent}
            onChange={(event) => setSelectedEvent(event.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Photos uploaded</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{attendees.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Pending review</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{pending.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Reviewed</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{reviewed.length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Pending Reviews</h2>
              <p className="text-sm text-gray-500">Open any card to inspect the uploaded image and complete verification.</p>
            </div>
            {loading && <p className="text-xs text-gray-400">Refreshing...</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pending.map((attendee) => (
              <button
                key={attendee._id}
                type="button"
                onClick={() => {
                  setSelectedAttendee(attendee);
                  setRejectionReason(attendee.photoRejectionReason || '');
                }}
                className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 text-left transition-colors hover:bg-amber-100"
              >
                <img
                  src={buildAssetUrl(attendee.photo)}
                  alt={attendee.fullName || 'Attendee'}
                  className="h-56 w-full object-cover"
                />
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{attendee.fullName || 'Unnamed attendee'}</p>
                      <p className="text-sm text-gray-500">{attendee.categoryName || 'No category'}</p>
                    </div>
                    <Badge color="yellow">pending</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{attendee.nationalId || attendee.phone || attendee.email || 'No identity detail yet'}</p>
                </div>
              </button>
            ))}
            {!loading && pending.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
                No photos are waiting for review right now.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Reviewed Photos</h2>
            <p className="text-sm text-gray-500">A quick history of recent verification decisions.</p>
          </div>

          <div className="space-y-3">
            {reviewed.slice(0, 8).map((attendee) => (
              <div key={attendee._id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={buildAssetUrl(attendee.photo)}
                    alt={attendee.fullName || 'Attendee'}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{attendee.fullName || 'Unnamed attendee'}</p>
                    <p className="text-sm text-gray-500">{attendee.categoryName || 'No category'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge color={photoColors[attendee.photoVerificationStatus] || 'gray'}>
                    {attendee.photoVerificationStatus}
                  </Badge>
                  {attendee.photoVerificationStatus === 'rejected' && attendee.photoRejectionReason && (
                    <span className="max-w-sm text-sm text-red-600">{attendee.photoRejectionReason}</span>
                  )}
                </div>
              </div>
            ))}
            {!loading && reviewed.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                Reviewed items will appear here after you process pending photos.
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={!!selectedAttendee}
        onClose={() => {
          setSelectedAttendee(null);
          setRejectionReason('');
        }}
        title="Photo Review"
        size="xl"
      >
        {selectedAttendee && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <img
                src={buildAssetUrl(selectedAttendee.photo)}
                alt={selectedAttendee.fullName || 'Attendee'}
                className="w-full rounded-2xl border border-gray-200 object-cover"
              />
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{selectedAttendee.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium text-gray-900">{selectedAttendee.categoryName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">NIC</p>
                <p className="font-medium text-gray-900">{selectedAttendee.nationalId || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact</p>
                <p className="font-medium text-gray-900">{selectedAttendee.phone || selectedAttendee.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Current status</p>
                <Badge color={photoColors[selectedAttendee.photoVerificationStatus] || 'gray'}>
                  {selectedAttendee.photoVerificationStatus}
                </Badge>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Rejection reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows={4}
                  placeholder="Explain why this photo should be resubmitted"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => updatePhotoStatus('verified')} loading={submitting}>
                  Mark Verified
                </Button>
                <Button variant="danger" onClick={() => updatePhotoStatus('rejected')} loading={submitting}>
                  Mark Rejected
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedAttendee(null);
                    setRejectionReason('');
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default PhotoVerifyPage;
