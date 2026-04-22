import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubAttendees, verifySubAttendee } from '../../api/sub';
import toast from 'react-hot-toast';

const SubOrgVerificationPage = () => {
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('Face mismatch or unclear image');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  const load = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const params = { verificationStatus: 'pending' };
      if (eventId) params.eventId = eventId;
      const response = await getSubAttendees(params);
      setItems((response.data?.data?.attendees || []).filter((attendee) => attendee.photo));
      setLoadError('');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to load pending verifications.';
      setLoadError(message);
      setItems([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(currentEventId);

    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setCurrentEventId(nextId);
      load(nextId);
    };

    window.addEventListener('eams:event-select', handleEventSelect);
    return () => window.removeEventListener('eams:event-select', handleEventSelect);
  }, []);

  const handleAction = async (attendeeId, status) => {
    try {
      await verifySubAttendee({ attendeeId, status, reason });
      toast.success(status === 'verified' ? 'Photo approved.' : 'Photo rejected and attendee notified.');
      await load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update verification.');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Verification</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Pending photo reviews</h1>
            <p className="mt-2 text-sm text-slate-500">Approve or reject only the attendees that belong to your assigned zones.</p>
          </div>
          <input value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 lg:w-96" placeholder="Reject reason used for SMS and email" />
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((attendee) => (
            <article key={attendee._id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                {attendee.photo ? <img src={attendee.photo} alt={attendee.fullName} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="mt-4">
                <h2 className="text-lg font-bold text-slate-900">{attendee.fullName || '-'}</h2>
                <p className="mt-1 text-sm text-slate-500">{attendee.categoryName || 'No category'}</p>
              </div>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={() => handleAction(attendee._id, 'verified')} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500">Approve</button>
                <button type="button" onClick={() => handleAction(attendee._id, 'rejected')} className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-500">Reject</button>
              </div>
            </article>
          ))}
          {!loading && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              No pending verifications in your zones right now.
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

export default SubOrgVerificationPage;
