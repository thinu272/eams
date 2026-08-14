import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import api from '../../api/client';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  TicketIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  BanknotesIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';

const BuyerTicketsPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');

  const fetchOrders = () => {
    setLoading(true);
    getBuyerTickets()
      .then((res) => setOrders(res.data?.data?.orders || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
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

    socket.on('order_status_changed', (data) => {
      toast.success(
        `Order #${data.orderNumber} status updated to ${
          data.paymentStatus || data.status
        }!`
      );
      fetchOrders();
    });

    return () => {
      socket.emit('leave_buyer', { userId: user._id });
      socket.disconnect();
    };
  }, [user]);

  const empty = !loading && orders.length === 0;

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (paymentMethodFilter === 'all') return sortedOrders;
    if (paymentMethodFilter === 'cash_entrance') {
      return sortedOrders.filter((o) =>
        ['cash_on_entrance', 'cash_at_entrance'].includes(o.paymentMethod)
      );
    }
    return sortedOrders.filter(
      (o) => o.paymentMethod === paymentMethodFilter
    );
  }, [sortedOrders, paymentMethodFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [paymentMethodFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / itemsPerPage)
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = filteredOrders.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const overallStats = useMemo(() => {
    const totalsByCurrency = {};
    let totalTickets = 0;
    let totalAssigned = 0;

    orders.forEach((o) => {
      const cur = o.currency || o.event?.currency || 'LKR';
      totalsByCurrency[cur] =
        (totalsByCurrency[cur] || 0) + (o.totalAmount || 0);
      totalTickets += o.stats?.total || 0;
      totalAssigned += o.stats?.assigned || 0;
    });

    return { totalsByCurrency, totalTickets, totalAssigned };
  }, [orders]);

  const filterOptions = [
    { value: 'all', label: 'All', icon: null },
    { value: 'card', label: 'Card', icon: CreditCardIcon },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: BanknotesIcon },
    { value: 'cash_entrance', label: 'Cash at Entrance', icon: TicketIcon },
  ];

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
                  Purchased Tickets & Orders
                </h1>
                <p className="mt-1.5 text-sm text-slate-500 max-w-xl">
                  View active orders, assign attendees, and download receipts.
                </p>
              </div>
              <Link
                to="/events"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
              >
                Browse Events
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Payment filter ── */}
        {!loading && orders.length > 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 sm:px-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 shrink-0">
                <FunnelIcon className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">
                  Payment method
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((opt) => {
                  const active = paymentMethodFilter === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethodFilter(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        {!loading && orders.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Spent
              </p>
              <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {Object.entries(overallStats.totalsByCurrency).length > 0
                  ? Object.entries(overallStats.totalsByCurrency)
                      .map(
                        ([cur, amt]) => `${cur} ${amt.toLocaleString()}`
                      )
                      .join(', ')
                  : 'LKR 0'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Purchased Tickets
              </p>
              <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {overallStats.totalTickets}{' '}
                <span className="text-base font-semibold text-slate-500">
                  Passes
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Assignments
              </p>
              <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {overallStats.totalAssigned}{' '}
                <span className="text-base font-semibold text-slate-500">
                  / {overallStats.totalTickets}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {empty && (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm max-w-lg mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <TicketIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-5 text-base font-bold text-slate-900">
              No purchased orders
            </h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              You haven’t bought any tickets yet. Explore upcoming events to
              purchase your passes.
            </p>
            <Link
              to="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
            >
              Browse Events
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Orders grid */}
        {!loading && !empty && (
          <div className="space-y-5">
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  No orders match this payment method filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {paginatedOrders.map((order) => {
                  const total = order.stats?.total || 0;
                  const assigned = order.stats?.assigned || 0;
                  const progressPercent =
                    total > 0 ? Math.round((assigned / total) * 100) : 0;

                  const isPaid =
                    ['paid', 'success', 'approved', 'verified'].includes(
                      order.paymentStatus?.toLowerCase()
                    ) || order.status === 'CONFIRMED';
                  const isCashReserved =
                    (order.paymentMethod === 'cash_at_entrance' ||
                      order.paymentMethod === 'cash_on_entrance') &&
                    order.status === 'RESERVED' &&
                    !isPaid;
                  const isBankPending =
                    order.paymentMethod === 'bank_transfer' && !isPaid;
                  const isLocked = (isCashReserved || isBankPending) && !isPaid;

                  const paymentLabel =
                    order.paymentMethod === 'card'
                      ? 'Card'
                      : order.paymentMethod === 'bank_transfer'
                      ? 'Bank Transfer'
                      : ['cash_on_entrance', 'cash_at_entrance'].includes(
                          order.paymentMethod
                        )
                      ? 'Cash at Entrance'
                      : null;

                  return (
                    <div
                      key={order._id}
                      className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Top */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                              Order #{order.orderNumber}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                            {paymentLabel && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                                {order.paymentMethod === 'card' ? (
                                  <CreditCardIcon className="h-3 w-3" />
                                ) : order.paymentMethod === 'bank_transfer' ? (
                                  <BanknotesIcon className="h-3 w-3" />
                                ) : (
                                  <TicketIcon className="h-3 w-3" />
                                )}
                                {paymentLabel}
                              </span>
                            )}
                            {isBankPending && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                On Hold · Verification Pending
                              </span>
                            )}
                            {isCashReserved && (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                Reserved · Payment Pending
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-slate-900 leading-snug">
                            {order.event?.name || 'Event'}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarIcon className="h-4 w-4 text-blue-500 shrink-0" />
                              {formatDate(order.event?.startDate)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPinIcon className="h-4 w-4 text-blue-500 shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {order.event?.venue?.name || 'Venue TBD'}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="w-full sm:w-48 shrink-0 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>Activation</span>
                            <span className="tabular-nums">
                              {progressPercent}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isLocked ? 'bg-amber-400' : 'bg-blue-600'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            <span>{assigned} Assigned</span>
                            <span>{total - assigned} Pending</span>
                          </div>
                        </div>
                      </div>

                      {/* Locked notices */}
                      {isCashReserved && (
                        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3">
                          <p className="text-xs font-semibold text-amber-800">
                            Ticket reserved — pay at the entrance to activate.
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            QR codes, invites, and downloads stay locked until
                            cash payment is processed at the venue.
                          </p>
                        </div>
                      )}
                      {isBankPending && (
                        <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3">
                          <p className="text-xs font-semibold text-amber-800">
                            Bank transfer on hold for verification.
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            Features unlock after approval (usually within 48
                            hours).
                          </p>
                        </div>
                      )}

                      {/* Categories */}
                      {order.categories?.length > 0 && (
                        <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-4 sm:grid-cols-2">
                          {order.categories.map((c) => (
                            <div
                              key={c.categoryId || c.categoryName}
                              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3"
                            >
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {c.categoryName}
                              </p>
                              <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                                <span>Qty: {c.quantity}</span>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  {c.assigned} / {c.quantity} Assigned
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Footer actions */}
                      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-bold text-slate-900 tabular-nums">
                          {order.status === 'RESERVED'
                            ? 'Total to Pay: '
                            : 'Total Paid: '}
                          {order.currency || order.event?.currency || 'LKR'}{' '}
                          {Number(order.totalAmount || 0).toLocaleString()}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              !isLocked && handleDownloadOrder(order._id)
                            }
                            disabled={isLocked}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition sm:flex-none"
                            title={
                              isLocked
                                ? 'Payment must be verified to download'
                                : ''
                            }
                          >
                            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                            Receipt
                          </button>

                          <Link
                            to={isLocked ? '#' : `/buyer/assign/${order._id}`}
                            onClick={(e) => isLocked && e.preventDefault()}
                            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition sm:flex-none ${
                              isLocked
                                ? 'bg-slate-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500'
                            }`}
                            title={
                              isLocked
                                ? 'Awaiting payment confirmation'
                                : ''
                            }
                          >
                            Manage Attendees
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && filteredOrders.length > 0 && (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                <p className="text-center sm:text-left text-xs text-slate-500">
                  Showing {startIndex + 1}–
                  {Math.min(startIndex + itemsPerPage, filteredOrders.length)}{' '}
                  of {filteredOrders.length} orders
                </p>

                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline">Previous</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 5) return true;
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
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
                              onClick={() => handlePageChange(page)}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition ${
                                currentPage === page
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
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <span className="hidden xs:inline">Next</span>
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerTicketsPage;