import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerInvites, resendInvite } from '../../api/buyer';
import toast from 'react-hot-toast';
import {
  BellIcon,
  ArrowPathIcon,
  CalendarIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

const badgeFor = (status) => {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-100 text-emerald-900';
    case 'PENDING_VERIFICATION':
      return 'bg-amber-100 text-amber-900';
    case 'INVITED':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const BuyerInvitesPage = () => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(null);

  const load = () => {
    setLoading(true);
    return getBuyerInvites()
      .then((res) => setInvites(res.data?.data?.invites || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const grouped = useMemo(() => {
    const byEvent = new Map();
    invites.forEach((i) => {
      const key = i.event?._id || 'unknown';
      if (!byEvent.has(key)) byEvent.set(key, { event: i.event, invites: [] });
      byEvent.get(key).invites.push(i);
    });
    return Array.from(byEvent.values());
  }, [invites]);

  const handleResend = async (ticketId) => {
    setResending(ticketId);
    try {
      await resendInvite(ticketId, { notificationChannel: 'email' });
      toast.success('Invite resent');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setResending(null);
    }
  };

  return (
    <BuyerLayout>
      <div className="space-y-4 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Invite Status</h2>
          <p className="mt-1 text-sm text-slate-600">Track who accepted and resend when needed.</p>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
          </div>
        )}

        {!loading && invites.length === 0 && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <BellIcon className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">No invites yet</h3>
            <p className="mt-1 text-sm text-slate-600">Assign an attendee to a ticket to send the first invite.</p>
          </div>
        )}

        {!loading && invites.length > 0 && (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.event?._id || 'event'} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-slate-900">{group.event?.name || 'Event'}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDate(group.event?.startDate)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        {group.event?.venue?.name || 'Venue TBD'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {group.invites.map((invite) => (
                    <div key={invite.ticketId} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {invite.attendee?.fullName || invite.attendee?.email}
                          </p>
                          <p className="truncate text-xs text-slate-600">{invite.attendee?.email}</p>
                          {invite.attendee?.phone && (
                            <p className="truncate text-xs text-slate-600">{invite.attendee.phone}</p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-2xl px-3 py-1 text-xs font-semibold ${badgeFor(invite.status)}`}>
                          {invite.status === 'INVITED' ? 'Pending' : invite.status === 'PENDING_VERIFICATION' ? 'Submitted' : invite.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Sent {invite.inviteSentAt ? new Date(invite.inviteSentAt).toLocaleString() : '—'}
                        </p>
                        {invite.status === 'INVITED' && (
                          <button
                            onClick={() => handleResend(invite.ticketId)}
                            disabled={resending === invite.ticketId}
                            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                            <span>{resending === invite.ticketId ? 'Resending…' : 'Resend'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerInvitesPage;

