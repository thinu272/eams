import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { getBuyerTickets } from '../../api/buyer';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';
import {
  CalendarIcon,
  MapPinIcon,
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TicketIcon,
  CreditCardIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const PaymentMethodOptions = [
  { value: 'all', label: 'All Methods' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash_entrance', label: 'Cash' },
];

const StatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'cancelled', label: 'Cancelled' },
];

const BuyerDashboardPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEvent, setFilterEvent] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 8;

  const fetchOrders = () => {
    setLoading(true);
    getBuyerTickets()
      .then((res) => setOrders(res.data?.data?.orders || []))
      .catch(() => toast.error('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useAutoRefresh(fetchOrders, {
    enabled: true,
    interval: 15000,
    immediate: false,
    deps: [],
  });

  // Socket for real-time updates
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

    const handleStatusChange = (data) => {
      if (data.action === 'approved') {
        toast.success(`Order #${data.orderNumber} payment has been approved!`);
      } else if (data.action === 'rejected') {
        toast.error(
          `Order #${data.orderNumber} payment has been rejected. ${
            data.reason || 'Please contact support.'
          }`
        );
      } else if (data.action === 'needs_info') {
        toast(
          `Order #${data.orderNumber} requires additional information: ${
            data.message || 'Please check your order details.'
          }`
        );
      } else {
        toast.success(
          `Order #${data.orderNumber} status updated to ${
            data.paymentStatus || data.status
          }!`
        );
      }
      fetchOrders();
    };

    socket.on('order_status_changed', handleStatusChange);
    socket.on('payment_approved', (data) => {
      toast.success(`Payment for order #${data.orderNumber} has been approved!`);
      fetchOrders();
    });
    socket.on('payment_submitted', (data) => {
      toast(`Payment submitted for order #${data.orderNumber}`);
      fetchOrders();
    });

    return () => {
      socket.emit('leave_buyer', { userId: user._id });
      socket.disconnect();
    };
  }, [user]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (filterMethod !== 'all') {
      if (filterMethod === 'cash_entrance') {
        result = result.filter((o) =>
          ['cash_on_entrance', 'cash_at_entrance'].includes(o.paymentMethod)
        );
      } else {
        result = result.filter((o) => o.paymentMethod === filterMethod);
      }
    }

    if (filterStatus !== 'all') {
      const status = filterStatus.toLowerCase();
      result = result.filter((o) => {
        const orderStatus = (o.status || '').toLowerCase();
        const paymentStatus = (o.paymentStatus || '').toLowerCase();
        return orderStatus === status || paymentStatus === status;
      });
    }

    if (filterEvent !== 'all' && filterEvent) {
      result = result.filter((o) => {
        const eventName = o.eventName || o.event?.name || '';
        return eventName.toLowerCase().includes(filterEvent.toLowerCase());
      });
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter((o) => new Date(o.createdAt) >= fromDate);
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((o) => new Date(o.createdAt) <= toDate);
    }

    return result;
  }, [orders, filterMethod, filterStatus, filterEvent, filterDateFrom, filterDateTo]);

  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    [filteredOrders]
  );

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = sortedOrders.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      const response = await fetch(`/api/tickets/order-download/${orderId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OrderSummary-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Order summary downloaded!', { id: 'order-pdf' });
    } catch {
      toast.error('Failed to download order summary', { id: 'order-pdf' });
    }
  };

  const clearFilters = () => {
    setFilterMethod('all');
    setFilterStatus('all');
    setFilterEvent('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    filterMethod !== 'all' ||
    filterStatus !== 'all' ||
    filterEvent !== 'all' ||
    filterDateFrom ||
    filterDateTo;

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
                    Buyer Workspace
                  </p>
                </div>
                <h1 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                  Ticket Progress & Payments
                </h1>
                <p className="mt-1.5 text-sm text-slate-500 max-w-lg">
                  Track activation status and filter by the payment method you used.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition lg:hidden"
                >
                  <FunnelIcon className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  )}
                </button>

                <Link
                  to="/events"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                >
                  Browse Events
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filters ── */}
        <div
          className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden transition-all ${
            showFilters ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between mb-3 lg:hidden">
              <p className="text-sm font-semibold text-slate-800">Filters</p>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select
                value={filterMethod}
                onChange={(e) => {
                  setFilterMethod(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {PaymentMethodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {StatusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Search events…"
                value={filterEvent === 'all' ? '' : filterEvent}
                onChange={(e) => {
                  setFilterEvent(e.target.value || 'all');
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => {
                  setFilterDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => {
                  setFilterDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Clear filters
              </button>
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 sm:h-44 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
              />
            ))}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && paginatedOrders.length === 0 && (
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm px-6 py-14 sm:py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <TicketIcon className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              No orders found
            </h3>
            <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No orders match the selected filters. Try adjusting or clearing them.'
                : 'You haven’t purchased any tickets yet.'}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Browse Events
              </Link>
            </div>
          </div>
        )}

        {/* ── Orders ── */}
        {!loading && paginatedOrders.length > 0 && (
          <div className="space-y-4 sm:space-y-5">
            {paginatedOrders.map((order) => {
              const total = order.stats?.total || 0;
              const assigned = order.stats?.assigned || 0;
              const progressPercent =
                total > 0 ? Math.round((assigned / total) * 100) : 0;

              const isAwaitingPayment =
                (order.paymentMethod === 'bank_transfer' &&
                  order.paymentStatus !== 'success') ||
                (['cash_on_entrance', 'cash_at_entrance'].includes(
                  order.paymentMethod
                ) &&
                  order.status === 'RESERVED') ||
                order.paymentStatus === 'pending_verification' ||
                order.paymentStatus === 'awaiting_payment';

              const getAwaitingPaymentLabel = () => {
                if (order.paymentMethod === 'bank_transfer') {
                  return 'Payment Verification Pending';
                }
                if (
                  ['cash_on_entrance', 'cash_at_entrance'].includes(
                    order.paymentMethod
                  )
                ) {
                  return 'Reserved · Awaiting Payment';
                }
                return 'Awaiting Payment';
              };

              const paymentLabel = (order.paymentMethod || '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div
                  key={order._id}
                  className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-4 sm:p-5 lg:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      {/* Left – Event info */}
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                            Order #{order.orderNumber}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                          {order.paymentMethod && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                              <CreditCardIcon className="h-3.5 w-3.5" />
                              {paymentLabel}
                            </span>
                          )}
                          {isAwaitingPayment && (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              {getAwaitingPaymentLabel()}
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug truncate">
                          {order.event?.name || order.eventName || 'Event'}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarIcon className="h-4 w-4 text-blue-500 shrink-0" />
                            {formatDate(order.event?.startDate)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPinIcon className="h-4 w-4 text-blue-500 shrink-0" />
                            <span className="truncate max-w-[200px] sm:max-w-none">
                              {order.event?.venue?.name || 'Venue TBD'}
                            </span>
                          </span>
                        </div>

                        {isAwaitingPayment && (
                          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5">
                            <p className="text-xs font-medium text-amber-800">
                              Ticket features become available after payment is
                              verified.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right – Progress + Actions */}
                      <div className="w-full lg:w-64 shrink-0 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span>Assignee Activation</span>
                            <span className="tabular-nums">{progressPercent}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isAwaitingPayment
                                  ? 'bg-amber-400'
                                  : 'bg-blue-600'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {assigned} of {total} tickets activated
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadOrder(order._id)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition sm:flex-none"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Summary
                          </button>
                          <Link
                            to={`/buyer/orders/${order._id}`}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition sm:flex-none"
                          >
                            View Tickets
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                <p className="text-center sm:text-left text-xs text-slate-500">
                  Showing {startIndex + 1}–
                  {Math.min(startIndex + itemsPerPage, sortedOrders.length)} of{' '}
                  {sortedOrders.length} orders
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
                        // Show first, last, current ±1
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
                              <span className="px-1 text-slate-400 text-xs">
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

export default BuyerDashboardPage;