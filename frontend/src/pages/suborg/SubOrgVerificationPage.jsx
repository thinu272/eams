import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getSubAttendees, verifySubAttendee } from '../../api/sub';
import { getAssetUrl } from '../../utils/backend';
import toast from 'react-hot-toast';
import {
  PhotoIcon,
  CheckBadgeIcon,
  XCircleIcon,
  ArrowLeftIcon,
  ClockIcon,
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

const SubOrgVerificationPage = () => {
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('Face mismatch or unclear image');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const load = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const params = { verificationStatus: 'pending' };
      if (eventId) params.eventId = eventId;
      const response = await getSubAttendees(params);
      setItems(
        (response.data?.data?.attendees || []).filter((a) => a.photo)
      );
      setLoadError('');
    } catch (error) {
      const message =
        error.response?.data?.message ||
        'Unable to load pending verifications.';
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
      const nextId = event.detail ? String(event.detail) : '';
      if (!nextId || nextId === 'undefined') return;
      setCurrentEventId(nextId);
      localStorage.setItem('lastSelectedEventId', nextId);
      load(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleAction = async (attendeeId, status) => {
    setActionLoading(`${attendeeId}-${status}`);
    try {
      await verifySubAttendee({ attendeeId, status, reason });
      toast.success(
        status === 'verified'
          ? 'Photo approved.'
          : 'Photo rejected and attendee notified.'
      );
      await load(currentEventId);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Unable to update verification.'
      );
    } finally {
      setActionLoading(null);
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
                    Verification
                  </p>
                </div>
                <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Pending photo reviews
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Approve or reject only the attendees that belong to your
                  assigned zones.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Metrics */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            title="Pending Reviews"
            value={loading ? '—' : items.length}
            subtitle="Photos awaiting decision"
            icon={ClockIcon}
          />
          <MetricCard
            title="With Photo"
            value={loading ? '—' : items.length}
            subtitle="Ready to review"
            icon={PhotoIcon}
          />
        </section>

        {/* Reject reason */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Default reject reason
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="Reason used for SMS and email on reject"
            />
            <p className="text-[11px] text-slate-400">
              Applied when you reject a photo. Attendee is notified.
            </p>
          </label>
        </Card>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {/* Cards grid */}
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <CheckBadgeIcon className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              No pending verifications
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500">
              New photo uploads in your zones will appear here for review.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((attendee) => {
              const photoSrc = attendee.photo
                ? String(attendee.photo).startsWith('http')
                  ? attendee.photo
                  : getAssetUrl?.(attendee.photo) || attendee.photo
                : null;
              const approving =
                actionLoading === `${attendee._id}-verified`;
              const rejecting =
                actionLoading === `${attendee._id}-rejected`;

              return (
                <Card
                  key={attendee._id}
                  className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:border-blue-200 hover:shadow-md transition-all overflow-hidden"
                  padding={false}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={attendee.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="text-base font-bold text-slate-900 truncate">
                      {attendee.fullName || '—'}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500 truncate">
                      {attendee.categoryName || 'No category'}
                    </p>
                    {(attendee.email || attendee.phone) && (
                      <p className="mt-1 text-xs text-slate-400 truncate">
                        {attendee.email || attendee.phone}
                      </p>
                    )}
                    <div className="mt-4 flex gap-2">
                      <Button
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                        onClick={() =>
                          handleAction(attendee._id, 'verified')
                        }
                        disabled={!!actionLoading}
                      >
                        <CheckBadgeIcon className="mr-1.5 h-4 w-4" />
                        {approving ? '…' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50"
                        onClick={() =>
                          handleAction(attendee._id, 'rejected')
                        }
                        disabled={!!actionLoading}
                      >
                        <XCircleIcon className="mr-1.5 h-4 w-4" />
                        {rejecting ? '…' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgVerificationPage;