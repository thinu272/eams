import React from 'react';
import { ArrowDownTrayIcon, ArrowRightIcon, CalendarIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const OrderControls = ({ orders, onDownloadOrder }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
              {orders.map((order) => {
                const total = order.stats?.total || 0;
                const assigned = order.stats?.assigned || 0;
                const progressPercent = total > 0 ? Math.round((assigned / total) * 100) : 0;
                const isComplete = progressPercent === 100;

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
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => onDownloadOrder(order._id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                          title="Download Receipt / Order Summary PDF"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Receipt</span>
                        </button>
                        <Link
                          to={`/buyer/assign/${order._id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-main px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-dark active:scale-95 transition-all"
                        >
                          <span>Manage</span>
                          <ArrowRightIcon className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderControls;
