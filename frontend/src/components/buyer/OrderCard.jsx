import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import Badge from '../ui/Badge';

const OrderCard = ({ order }) => {
  const progressPercent = order.progress.total ? Math.round((order.progress.confirmed / order.progress.total) * 100) : 0;
  
  // Check if this is a cash at entrance reservation
  const isCashReservation = order.paymentMethod === 'cash_at_entrance' || order.paymentMethod === 'cash_on_entrance';
  const isReserved = order.status === 'RESERVED';
  const isAwaitingPayment = order.paymentStatus === 'awaiting_payment';
  const shouldDisableActions = isCashReservation && (isReserved || isAwaitingPayment);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Order {order.orderNumber}</p>
          <h3 className="text-lg font-bold text-slate-900">{order.event?.name || 'Event'}</h3>
          <p className="text-sm text-slate-500">{order.event?.venue?.name || 'Venue'} • {new Date(order.event?.startDate || order.createdAt).toLocaleDateString()}</p>
        </div>
        <Badge color={shouldDisableActions ? 'orange' : (order.confirmationStatus === 'All Confirmed' ? 'green' : 'blue')}>
          {shouldDisableActions ? 'Reserved' : order.confirmationStatus}
        </Badge>
      </div>

      <div className="mt-4">
        {shouldDisableActions ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="text-orange-600 font-bold">Reservation Pending Payment</span>
            </div>
            <div className="text-xs text-slate-500">
              Payment must be completed at the venue before tickets can be issued.
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Confirmed {order.progress.confirmed} / {order.progress.total}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-amber-400" style={{ width: `${progressPercent}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">{order.currency || 'LKR'} {Number(order.totalAmount || 0).toLocaleString()}</p>
        {shouldDisableActions ? (
          <button
            disabled
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 cursor-not-allowed"
            title="Payment must be completed at the venue before tickets can be issued"
          >
            Manage Confirmation <ChevronRightIcon className="h-3 w-3" />
          </button>
        ) : (
          <Link to={`/buyer/orders/${order._id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Manage Confirmation <ChevronRightIcon className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
};

export default OrderCard;
