import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import { Link } from 'react-router-dom';
import {
  TicketIcon,
  MapPinIcon,
  CalendarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const BuyerTicketsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBuyerTickets()
      .then((res) => setOrders(res.data?.data?.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const empty = !loading && orders.length === 0;

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.event?.startDate || b.createdAt) - new Date(a.event?.startDate || a.createdAt));
  }, [orders]);

  return (
    <BuyerLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Tickets</h2>
            <p className="mt-1 text-sm text-slate-600">Tap an order to assign attendees.</p>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
          </div>
        )}

        {empty && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
            <TicketIcon className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-4 text-lg font-bold text-slate-900">No tickets yet</h3>
            <p className="mt-1 text-sm text-slate-600">When you purchase tickets, they’ll show up here.</p>
            <Link
              to="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <span>Browse events</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && !empty && (
          <div className="space-y-4">
            {sortedOrders.map((order) => (
              <Link
                key={order._id}
                to={`/buyer/assign/${order._id}`}
                className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                      Order {order.orderNumber}
                    </p>
                    <h3 className="mt-2 truncate text-lg font-bold text-slate-900">{order.event?.name || 'Event'}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {formatDate(order.event?.startDate)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        {order.event?.venue?.name || 'Venue TBD'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.stats?.assigned || 0} assigned
                    </span>
                    <span className="rounded-2xl bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                      {order.stats?.pending || 0} pending
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {order.categories?.slice(0, 4)?.map((c) => (
                    <div key={c.categoryId || c.categoryName} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                      <p className="text-sm font-semibold text-slate-900">{c.categoryName}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        Qty {c.quantity} • Assigned {c.assigned} • Pending {c.pending}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span>Assign attendees</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerTicketsPage;

