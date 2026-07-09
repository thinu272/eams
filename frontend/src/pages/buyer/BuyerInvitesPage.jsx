import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerInvites, resendInvite } from '../../api/buyer';
import toast from 'react-hot-toast';
import {
  BellIcon,
  ArrowPathIcon,
  CalendarIcon,
  MapPinIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  PhoneIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const badgeFor = (status) => {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-50 border border-emerald-100 text-emerald-800';
    case 'PENDING_VERIFICATION':
      return 'bg-amber-50 border border-amber-100 text-amber-800';
    case 'INVITED':
      return 'bg-blue-50 border border-blue-100 text-blue-800';
    default:
      return 'bg-slate-50 border border-slate-200 text-slate-700';
  }
};

const labelFor = (status) => {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PENDING_VERIFICATION':
      return 'Photo Submitted';
    case 'INVITED':
      return 'Invite Sent';
    default:
      return status;
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
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
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
      toast.success('Invite resent successfully');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setResending(null);
    }
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = invites.length;
    const confirmed = invites.filter(i => i.status === 'CONFIRMED').length;
    const submitted = invites.filter(i => i.status === 'PENDING_VERIFICATION').length;
    const pending = invites.filter(i => i.status === 'INVITED').length;

    return { total, confirmed, submitted, pending };
  }, [invites]);

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* Info Header Banner */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-xl font-extrabold text-slate-900">Invite Status Tracker</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Track invitation acceptance status, photo submissions, and gate verification approval for guests you have invited. You can also resend active invite links.
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh Tracker
          </button>
        </div>

        {/* Global Summary Cards */}
        {!loading && invites.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Invites</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500">Confirmed</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.confirmed}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500">Submitted Photos</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.submitted}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-500">Pending Actions</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.pending}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
          </div>
        )}

        {!loading && invites.length === 0 && (
          <div className="rounded-[32px] bg-white p-12 text-center shadow-sm border border-slate-200 max-w-xl mx-auto my-8">
            <BellIcon className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-6 text-xl font-extrabold text-slate-900">No active invites</h3>
            <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
              You haven't invited any guests yet. Assign an attendee to a ticket to send an invite.
            </p>
            <Link
              to="/buyer/tickets"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand-main px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-dark transition-all active:scale-95"
            >
              <span>Manage Purchases</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && invites.length > 0 && (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.event?._id || 'event'} className="rounded-[32px] bg-white border border-slate-200 p-6 shadow-sm">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h3 className="text-lg font-extrabold text-slate-900">{group.event?.name || 'Event'}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4 text-brand-main" />
                      {formatDate(group.event?.startDate)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="h-4 w-4 text-brand-main" />
                      {group.event?.venue?.name || 'Venue TBD'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.invites.map((invite) => (
                    <div key={invite.ticketId} className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex flex-col justify-between gap-4">
                      
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-extrabold text-slate-900">
                            {invite.attendee?.fullName || 'Anonymous Guest'}
                          </p>
                          <p className="truncate text-xs text-slate-500 font-medium flex items-center gap-1">
                            <EnvelopeIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>{invite.attendee?.email}</span>
                          </p>
                          {invite.attendee?.phone && (
                            <p className="truncate text-xs text-slate-500 font-medium flex items-center gap-1">
                              <PhoneIcon className="h-3.5 w-3.5 text-slate-400" />
                              <span>{invite.attendee.phone}</span>
                            </p>
                          )}
                        </div>
                        
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeFor(invite.status)}`}>
                          {labelFor(invite.status)}
                        </span>
                      </div>

                      {/* Photo verification details if rejected */}
                      {invite.attendee?.photoVerificationStatus === 'rejected' && (
                        <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-700">
                          <p className="font-bold">Identity Photo Rejected</p>
                          <p className="mt-1 text-slate-600 leading-normal">{invite.attendee.photoRejectionReason || 'Please resubmit details.'}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5" />
                          <span>Sent: {invite.inviteSentAt ? new Date(invite.inviteSentAt).toLocaleDateString() : '-'}</span>
                        </span>
                        
                        {invite.status === 'INVITED' && (
                          <button
                            onClick={() => handleResend(invite.ticketId)}
                            disabled={resending === invite.ticketId}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-main hover:bg-brand-dark px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                          >
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                            <span>{resending === invite.ticketId ? 'Resending…' : 'Resend Code'}</span>
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
