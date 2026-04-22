import React from 'react';
import { Link } from 'react-router-dom';
import Badge from '../ui/Badge';

const OrderCard = ({ order }) => {
  const progressPercent = order.progress.total ? Math.round((order.progress.confirmed / order.progress.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Order {order.orderNumber}</p>
          <h3 className="text-lg font-bold text-slate-900">{order.event?.name || 'Event'}</h3>
          <p className="text-sm text-slate-500">{order.event?.venue?.name || 'Venue'} • {new Date(order.event?.startDate || order.createdAt).toLocaleDateString()}</p>
        </div>
        <Badge color={order.confirmationStatus === 'All Confirmed' ? 'green' : 'blue'}>
          {order.confirmationStatus}
        </Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Confirmed {order.progress.confirmed} / {order.progress.total}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
          <div className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-amber-400" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">LKR {Number(order.totalAmount || 0).toLocaleString()}</p>
        <Link to={`/buyer/orders/${order._id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
          Manage Confirmation →
        </Link>
      </div>
    </div>
  );
};

export default OrderCard;
