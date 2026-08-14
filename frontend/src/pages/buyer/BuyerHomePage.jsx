import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import api from '../../api/client';
import TicketCard from '../../components/buyer/TicketCard';
import OrderControls from '../../components/buyer/OrderControls';
import EmptyState from '../../components/buyer/EmptyState';
import toast from 'react-hot-toast';
import {
  TicketIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowRightIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';

/* ───────────────────── Metric Card (matches SubOrg / Attendee) ───────────────────── */
const StatCard = ({ label, value, icon: Icon, tone = 'blue' }) => {
  const iconTones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-50 text-slate-500',
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
        </div>
        {Icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              iconTones[tone] || iconTones.blue
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
};

const BuyerHomePage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [resendingIds, setResendingIds] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [passesCurrentPage, setPassesCurrentPage] = useState(1);
  const passesPerPage = 9;

  const handleResend = async (ticketId) => {
    setResendingIds((prev) => ({ ...prev, [ticketId]: true }));
    try {
      await api.post(`/tickets/${ticketId}/resend-invite`);
      toast.success('Invite code resent successfully!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setResendingIds((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getBuyerTickets().catch(() => ({ data: { data: { orders: [] } } })),
      api.get('/user/tickets').catch(() => ({ data: { data: { tickets: [] } } })),
    ])
      .then(([buyerRes, userRes]) => {
        setOrders(buyerRes.data?.data?.orders || []);
        setPasses(userRes.data?.data?.tickets || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!user?._id) return;

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('join_buyer', { userId: user._id });
    });

    const handleUpdate = (data) => {
      if (data?.orderNumber) {
        toast.success(`Order #${data.orderNumber} updated!`);
      }
      fetchData();
    };

    socket.on('order_status_changed', handleUpdate);
    socket.on('ticket_update', handleUpdate);

    return () => {
      socket.emit('leave_buyer', { userId: user._id });
      socket.disconnect();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalTickets = orders.reduce((acc, o) => acc + (o.stats?.total || 0), 0);
    const assigned = orders.reduce((acc, o) => acc + (o.stats?.assigned || 0), 0);
    const pending = orders.reduce((acc, o) => acc + (o.stats?.pending || 0), 0);
    return { totalTickets, assigned, pending };
  }, [orders]);

  const nextOrder = useMemo(() => {
    const now = Date.now();
    return (
      [...orders]
        .filter((o) => o.event?.startDate)
        .sort(
          (a, b) =>
            new Date(a.event.startDate) - new Date(b.event.startDate)
        )
        .find((o) => new Date(o.event.startDate).getTime() >= now) ||
      orders[0] ||
      null
    );
  }, [orders]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDownload = async (token, ticketNumber, passId) => {
    if (!token) return;
    try {
      setDownloadingIds((prev) => ({ ...prev, [passId]: true }));
      const response = await api.get(`/tickets/download/${token}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ticket-${ticketNumber || token}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ticket downloaded successfully!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error('Failed to download ticket PDF');
    } finally {
      setDownloadingIds((prev) => ({ ...prev, [passId]: false }));
    }
  };

  const handleDownloadOrder = async (orderId) => {
    try {
      toast.loading('Generating order summary...', { id: 'order-pdf' });
      const response = await api.get(`/tickets/order-download/${orderId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OrderSummary-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Order summary downloaded!', { id: 'order-pdf' });
    } catch (error) {
      console.error('Error downloading order summary:', error);
      toast.error('Failed to download order summary PDF', { id: 'order-pdf' });
    }
  };

  const filteredPasses = useMemo(() => {
    return passes.filter((pass) => {
      const matchesSearch =
        (pass.event?.name || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (pass.ticketNumber || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const isPhotoVerified =
        String(pass.attendee?.photoVerificationStatus || '').toLowerCase() ===
        'verified';
      const isPhotoRejected =
        String(pass.attendee?.photoVerificationStatus || '').toLowerCase() ===
        'rejected';
      const isPendingVerification =
        !isPhotoVerified &&
        !isPhotoRejected &&
        (pass.status === 'PENDING_VERIFICATION' ||
          (pass.status === 'ASSIGNED' &&
            pass.attendee?.photo &&
            pass.event?.requirePhotoVerification));
      const isInvalidated =
        pass.status === 'CANCELLED' || pass.refundStatus === 'refunded';
      const isInvited = pass.status === 'INVITED';

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' &&
          (pass.status === 'CONFIRMED' || isPhotoVerified)) ||
        (statusFilter === 'verification' && isPendingVerification) ||
        (statusFilter === 'rejected' && isPhotoRejected) ||
        (statusFilter === 'invited' && isInvited) ||
        (statusFilter === 'cancelled' && isInvalidated) ||
        (statusFilter === 'pending' &&
          pass.status !== 'CONFIRMED' &&
          !isPhotoVerified &&
          !isPendingVerification &&
          !isPhotoRejected &&
          !isInvalidated &&
          !isInvited);

      return matchesSearch && matchesStatus;
    });
  }, [passes, searchQuery, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPassesCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const passesTotalPages = Math.max(
    1,
    Math.ceil(filteredPasses.length / passesPerPage)
  );
  const passesStartIndex = (passesCurrentPage - 1) * passesPerPage;
  const paginatedPasses = filteredPasses.slice(
    passesStartIndex,
    passesStartIndex + passesPerPage
  );

  const handlePassesPageChange = (page) => {
    if (page < 1 || page > passesTotalPages) return;
    setPassesCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <BuyerLayout>
      <div className="space-y-5 sm:space-y-6 pb-16 sm:pb-20">
        {/* ── Header ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/15" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Ticket Owner
                  </p>
                </div>
                <h1 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                  Manage your tickets
                </h1>
                <p className="mt-1.5 text-sm text-slate-500 max-w-lg">
                  Assign attendees, track invite status, and keep everything
                  ready for entry.
                </p>
              </div>
              <Link
                to="/buyer/tickets"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              >
                Manage Orders
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-0.5">
            Overview
          </p>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Total tickets"
                value={stats.totalTickets}
                icon={TicketIcon}
                tone="blue"
              />
              <StatCard
                label="Assigned"
                value={stats.assigned}
                icon={UserGroupIcon}
                tone="emerald"
              />
              <StatCard
                label="Pending"
                value={stats.pending}
                icon={ClockIcon}
                tone="amber"
              />
            </div>
          )}
        </section>

        {/* ── Widgets ── */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Next Event */}
          {!loading && nextOrder?.event ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[220px]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Next event
              </p>
              <h3 className="mt-2 text-base font-bold text-slate-900 leading-snug line-clamp-2">
                {nextOrder.event.name}
              </h3>
              <div className="mt-3 space-y-1.5 text-xs text-slate-500 flex-1">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>{formatDate(nextOrder.event.startDate)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPinIcon className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="truncate">
                    {nextOrder.event.venue?.name || 'Venue TBD'}
                  </span>
                </div>
              </div>
              <Link
                to={`/buyer/assign/${nextOrder._id}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              >
                Assign attendees
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 flex items-center justify-center min-h-[220px]">
              <p className="text-sm text-slate-500">No upcoming events</p>
            </div>
          )}

          {/* Owner Tools */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[220px]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Owner tools
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Jump into orders and invite tracking
            </p>
            <div className="mt-auto pt-5 grid grid-cols-2 gap-3">
              <Link
                to="/buyer/tickets"
                className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:border-slate-200 hover:bg-slate-100/80"
              >
                <span className="text-xs font-semibold text-slate-900">
                  Manage Orders
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                  View <ArrowRightIcon className="h-3 w-3" />
                </span>
              </Link>
              <Link
                to="/buyer/invites"
                className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:border-slate-200 hover:bg-slate-100/80"
              >
                <span className="text-xs font-semibold text-slate-900">
                  Track Invites
                </span>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                  Track <ArrowRightIcon className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </div>

          {/* Security note */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[220px]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldCheckIcon className="h-5 w-5" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Security & Invites
              </p>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed flex-1">
              Tickets must be assigned to guest emails before QR codes can be
              generated. Double-check guest details.
            </p>
            <Link
              to="/buyer/profile"
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <UserCircleIcon className="h-3.5 w-3.5" />
              Manage Profile
            </Link>
          </div>
        </section>

        {/* ── Purchased Orders ── */}
        {!loading && orders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-slate-900 px-0.5">
              Your Purchased Orders
            </h2>
            <OrderControls orders={orders} onDownloadOrder={handleDownloadOrder} />
          </section>
        )}

        {/* ── My Entry Passes ── */}
        {!loading && passes.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <QrCodeIcon className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  My Entry Passes
                </h2>
              </div>

              <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search event or ticket…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="relative">
                  <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value="all">All Passes</option>
                    <option value="active">Active</option>
                    <option value="verification">Awaiting Verification</option>
                    <option value="rejected">Photo Rejected</option>
                    <option value="invited">Invited</option>
                    <option value="cancelled">Cancelled / Invalidated</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredPasses.length > 0 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {paginatedPasses.map((pass) => (
                    <TicketCard
                      key={pass._id}
                      pass={pass}
                      onDownload={() =>
                        handleDownload(
                          pass.attendee?.qrToken,
                          pass.ticketNumber,
                          pass._id
                        )
                      }
                      downloading={!!downloadingIds[pass._id]}
                      onResend={() => handleResend(pass._id)}
                      resending={!!resendingIds[pass._id]}
                    />
                  ))}
                </div>

                {passesTotalPages > 1 && (
                  <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between pt-1">
                    <p className="text-center sm:text-left text-xs text-slate-500">
                      Showing {passesStartIndex + 1}–
                      {Math.min(
                        passesStartIndex + passesPerPage,
                        filteredPasses.length
                      )}{' '}
                      of {filteredPasses.length} passes
                    </p>

                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handlePassesPageChange(passesCurrentPage - 1)
                        }
                        disabled={passesCurrentPage === 1}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeftIcon className="h-3.5 w-3.5" />
                        <span className="hidden xs:inline">Previous</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: passesTotalPages },
                          (_, i) => i + 1
                        )
                          .filter((page) => {
                            if (passesTotalPages <= 5) return true;
                            return (
                              page === 1 ||
                              page === passesTotalPages ||
                              Math.abs(page - passesCurrentPage) <= 1
                            );
                          })
                          .map((page, idx, arr) => {
                            const prev = arr[idx - 1];
                            const showEllipsis = prev && page - prev > 1;
                            return (
                              <React.Fragment key={page}>
                                {showEllipsis && (
                                  <span className="px-1 text-xs text-slate-400">
                                    …
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handlePassesPageChange(page)}
                                  className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition ${
                                    passesCurrentPage === page
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handlePassesPageChange(passesCurrentPage + 1)
                        }
                        disabled={passesCurrentPage === passesTotalPages}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        <span className="hidden xs:inline">Next</span>
                        <ChevronRightIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  No entry passes match your filters.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Empty state */}
        {!loading && passes.length === 0 && orders.length === 0 && (
          <EmptyState />
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerHomePage;