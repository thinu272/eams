import React, { useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  CalendarIcon,
  ShoppingBagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const OrderControls = ({ orders, onDownloadOrder }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const totalPages = Math.max(1, Math.ceil(orders.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="space-y-4">
      {/* ── Table card ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Order / Date
                </th>
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Event
                </th>
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Status & Progress
                </th>
                <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {paginatedOrders.map((order) => {
                const total = order.stats?.total || 0;
                const assigned = order.stats?.assigned || 0;
                const progressPercent =
                  total > 0 ? Math.round((assigned / total) * 100) : 0;
                const isComplete = progressPercent === 100;

                const isCashReservation =
                  order.paymentMethod === 'cash_at_entrance' ||
                  order.paymentMethod === 'cash_on_entrance';
                const isReserved = order.status === 'RESERVED';
                const isAwaitingPayment =
                  order.paymentStatus === 'awaiting_payment';
                const isBankPending =
                  order.paymentMethod === 'bank_transfer' &&
                  order.paymentStatus !== 'paid' &&
                  order.paymentStatus !== 'success';
                const shouldDisableActions =
                  (isCashReservation && (isReserved || isAwaitingPayment)) ||
                  isBankPending;

                return (
                  <tr
                    key={order._id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Order ID / Date */}
                    <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <ShoppingBagIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">
                            #
                            {order.orderNumber ||
                              order._id.slice(-6).toUpperCase()}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Event */}
                    <td className="px-4 py-4 sm:px-5">
                      <div className="max-w-[200px] sm:max-w-xs">
                        <p className="font-semibold text-slate-900 truncate">
                          {order.event?.name || 'Event Details'}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <span>{formatDate(order.event?.startDate)}</span>
                        </p>
                      </div>
                    </td>

                    {/* Status & Progress */}
                    <td className="px-4 py-4 sm:px-5">
                      <div className="w-44 sm:w-52">
                        {shouldDisableActions ? (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-amber-700">
                              {isBankPending
                                ? 'On Hold · Verification Pending'
                                : 'Reservation · Pending Payment'}
                            </p>
                            <p className="text-[11px] leading-snug text-slate-500">
                              {isBankPending
                                ? 'Payment verification usually completes within 48 hours.'
                                : 'Pay at the venue before tickets can be issued.'}
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                              <span
                                className={
                                  isComplete
                                    ? 'text-emerald-600'
                                    : 'text-slate-600'
                                }
                              >
                                {assigned} / {total} Assigned
                              </span>
                              <span className="tabular-nums text-slate-400">
                                {progressPercent}%
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isComplete ? 'bg-emerald-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-4 sm:px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onDownloadOrder(order._id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                          title={
                            shouldDisableActions
                              ? 'Download Reservation PDF'
                              : 'Download Receipt / Order Summary'
                          }
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">
                            {shouldDisableActions ? 'Reservation' : 'Receipt'}
                          </span>
                        </button>

                        {shouldDisableActions ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                            title="Payment must be completed before tickets can be managed"
                          >
                            <span>Manage</span>
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <Link
                            to={`/buyer/assign/${order._id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition"
                          >
                            <span>Manage</span>
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
          <p className="text-center sm:text-left text-xs text-slate-500">
            Showing {startIndex + 1}–
            {Math.min(endIndex, orders.length)} of {orders.length} orders
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
                        <span className="px-1 text-xs text-slate-400">…</span>
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
  );
};

export default OrderControls;