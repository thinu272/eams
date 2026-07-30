import React, { useState } from 'react';
import { ArrowDownTrayIcon, ArrowRightIcon, CalendarIcon, ShoppingBagIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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

  // Pagination logic
  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Order ID / Date</th>
                <th className="px-6 py-4">Event Details</th>
                <th className="px-6 py-4">Status & Progress</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedOrders.map((order) => {
                const total = order.stats?.total || 0;
                const assigned = order.stats?.assigned || 0;
                const progressPercent = total > 0 ? Math.round((assigned / total) * 100) : 0;
                const isComplete = progressPercent === 100;
                
                // Check if this is a cash at entrance reservation
                const isCashReservation = order.paymentMethod === 'cash_at_entrance' || order.paymentMethod === 'cash_on_entrance';
                const isReserved = order.status === 'RESERVED';
                const isAwaitingPayment = order.paymentStatus === 'awaiting_payment';
                const isBankPending = order.paymentMethod === 'bank_transfer' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'success';
                const shouldDisableActions = (isCashReservation && (isReserved || isAwaitingPayment)) || isBankPending;

                return (
                  <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Order ID / Date */}
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <ShoppingBagIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">#{order.orderNumber || order._id.slice(-6).toUpperCase()}</p>
                          <p className="text-xs text-slate-500 font-medium">{formatDate(order.createdAt)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Event Details */}
                    <td className="px-6 py-4">
                      <div className="max-w-xs sm:max-w-sm truncate">
                        <p className="font-extrabold text-slate-900 truncate">{order.event?.name || 'Event Details'}</p>
                        <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{formatDate(order.event?.startDate)}</span>
                        </p>
                      </div>
                    </td>

                    {/* Status & Progress */}
                    <td className="px-6 py-4">
                      <div className="w-48">
                         {shouldDisableActions ? (
                           <div className="space-y-1">
                             <div className="flex items-center justify-between text-xs font-semibold">
                               <span className="text-orange-600 font-bold">
                                 {isBankPending ? 'On Hold / Verification Pending' : 'Reservation Pending Payment'}
                               </span>
                             </div>
                             <div className="text-xs text-slate-500">
                               {isBankPending 
                                 ? 'Payment verification will normally be completed within 48 hours.'
                                 : 'Payment must be completed at the venue before tickets can be issued.'}
                             </div>
                           </div>
                         ) : (
                          <>
                            <div className="flex items-center justify-between text-xs font-semibold mb-1">
                              <span className={isComplete ? 'text-emerald-600' : 'text-slate-500'}>
                                {assigned} / {total} Assigned
                              </span>
                              <span className="text-slate-400">{progressPercent}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-brand-main transition-all duration-500`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => onDownloadOrder(order._id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                          title={shouldDisableActions ? "Download Reservation PDF" : "Download Receipt / Order Summary PDF"}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">{shouldDisableActions ? 'Reservation' : 'Receipt'}</span>
                        </button>
                        {shouldDisableActions ? (
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm cursor-not-allowed"
                            title="Payment must be completed at the venue before tickets can be issued"
                          >
                            <span>Manage</span>
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <Link
                            to={`/buyer/assign/${order._id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-main px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-dark active:scale-95 transition-all"
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-slate-500 font-medium">
            Showing {startIndex + 1} to {Math.min(endIndex, orders.length)} of {orders.length} orders
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    currentPage === page
                      ? 'bg-brand-main text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span>Next</span>
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderControls;
