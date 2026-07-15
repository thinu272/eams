// src/pages/buyer/BuyerDashboardPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CalendarIcon,
  MapPinIcon,
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const PaymentMethodOptions = [
  { value: 'all', label: 'All Methods' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
];

const BuyerDashboardPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMethod, setFilterMethod] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
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

  // Filter by payment method
  const filteredOrders = useMemo(() => {
    if (filterMethod === 'all') return orders;
    return orders.filter((o) => o.paymentMethod === filterMethod);
  }, [orders, filterMethod]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [filteredOrders]);

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

  const handlePageChange = (page) => setCurrentPage(page);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
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
    } catch (e) {
      toast.error('Failed to download order summary', { id: 'order-pdf' });
    }
  };

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-xl font-extrabold text-slate-900">Ticket Progress & Payments</h2>
            <p className="text-xs text-slate-500 font-medium">Track activation status and filter by the payment method you used.</p>
          </div>
          <div className="flex gap-4 shrink-0 w-full md:w-auto items-center">
            <select
              value={filterMethod}
              onChange={(e) => { setFilterMethod(e.target.value); setCurrentPage(1); }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {PaymentMethodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-main px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition"
            >
              Browse Events
            </Link>
          </div>
        </div>

        {/* Orders List */}
        {loading && (
          <div className="space-y-4">
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
          </div>
        )}

        {!loading && paginatedOrders.length === 0 && (
          <div className="rounded-[32px] bg-white p-12 text-center shadow-sm border border-slate-200 max-w-xl mx-auto my-8">
            <p className="mt-6 text-sm text-slate-500">No orders match the selected filter.</p>
          </div>
        )}

        {!loading && paginatedOrders.length > 0 && (
          <div className="space-y-6">
            {paginatedOrders.map((order) => {
              const total = order.stats?.total || 0;
              const assigned = order.stats?.assigned || 0;
              const progressPercent = total > 0 ? Math.round((assigned / total) * 100) : 0;
              return (
                <div
                  key={order._id}
                  className="rounded-[32px] bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-between gap-6 hover:shadow-md transition"
                >
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
                    {/* Event & Order info */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase rounded-md border border-slate-200">
                          Order #{order.orderNumber}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          Purchased on {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                        {order.paymentMethod && (
                          <span className="ml-2 text-xs capitalize text-brand-main">
                            {order.paymentMethod.replace('_', ' ')}
                          </span>
                        )}
                        {order.paymentMethod === 'bank_transfer' && order.paymentStatus !== 'paid' && (
                          <span className="ml-2 text-xs font-bold text-yellow-700 bg-yellow-100 border border-yellow-200 px-2.5 py-0.5 rounded-full">
                            Waiting for Payment Approval
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 leading-snug">
                        {order.event?.name || 'Event'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarIcon className="h-4 w-4 text-brand-main" />
                          {formatDate(order.event?.startDate)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPinIcon className="h-4 w-4 text-brand-main" />
                          {order.event?.venue?.name || 'Venue TBD'}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="w-full lg:w-60 shrink-0 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Assignee Activation</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-main" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-bold transition-all ${currentPage === page ? 'bg-brand-main text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerDashboardPage;
