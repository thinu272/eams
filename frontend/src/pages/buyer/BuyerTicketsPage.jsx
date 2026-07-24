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
  ShoppingBagIcon,
  CircleStackIcon,
  UserPlusIcon,
  QuestionMarkCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  BanknotesIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

const BuyerTicketsPage = () => {
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

  const empty = !loading && orders.length === 0;

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
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

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders]);

  // Filter orders by payment method
  const filteredOrders = useMemo(() => {
    if (paymentMethodFilter === 'all') {
      return sortedOrders;
    }
    if (paymentMethodFilter === 'cash_entrance') {
      return sortedOrders.filter(order => ['cash_on_entrance', 'cash_at_entrance'].includes(order.paymentMethod));
    }
    return sortedOrders.filter(order => order.paymentMethod === paymentMethodFilter);
  }, [sortedOrders, paymentMethodFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [paymentMethodFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Overall Stats
  const overallStats = useMemo(() => {
    let totalsByCurrency = {};
    let totalTickets = 0;
    let totalAssigned = 0;
    
    orders.forEach(o => {
      const cur = o.currency || o.event?.currency || 'LKR';
      totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + (o.totalAmount || 0);
      totalTickets += o.stats?.total || 0;
      totalAssigned += o.stats?.assigned || 0;
    });

    return { totalsByCurrency, totalTickets, totalAssigned };
  }, [orders]);

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* Info Header Banner */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-xl font-extrabold text-slate-900">Your Purchased Tickets & Orders</h2>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              As a ticket buyer, you can view your active orders, assign individual attendee details to activate passes, or download official summary receipts.
            </p>
          </div>
          
          <div className="flex gap-4 shrink-0 w-full md:w-auto">
            <Link
              to="/events"
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-main px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition-all active:scale-95"
            >
              <span>Browse Events</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Payment Method Filter */}
        {!loading && orders.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-[32px] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <FunnelIcon className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-bold text-slate-700">Filter by Payment Method:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaymentMethodFilter('all')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    paymentMethodFilter === 'all'
                      ? 'bg-brand-main text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>All</span>
                </button>
                <button
                  onClick={() => setPaymentMethodFilter('card')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    paymentMethodFilter === 'card'
                      ? 'bg-brand-main text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CreditCardIcon className="h-4 w-4" />
                  <span>Card</span>
                </button>
                <button
                  onClick={() => setPaymentMethodFilter('bank_transfer')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    paymentMethodFilter === 'bank_transfer'
                      ? 'bg-brand-main text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <BanknotesIcon className="h-4 w-4" />
                  <span>Bank Transfer</span>
                </button>
                <button
                  onClick={() => setPaymentMethodFilter('cash_entrance')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    paymentMethodFilter === 'cash_entrance'
                      ? 'bg-brand-main text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <TicketIcon className="h-4 w-4" />
                  <span>Cash at Entrance</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Summary Cards */}
        {!loading && orders.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Spent</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {Object.entries(overallStats.totalsByCurrency).length > 0 
                  ? Object.entries(overallStats.totalsByCurrency).map(([cur, amt]) => `${cur} ${amt.toLocaleString()}`).join(', ') 
                  : 'LKR 0'}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Purchased Tickets</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{overallStats.totalTickets} Passes</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Status Assignments</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {overallStats.totalAssigned} / {overallStats.totalTickets} Assigned
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
          </div>
        )}

        {empty && (
          <div className="rounded-[32px] bg-white p-12 text-center shadow-sm border border-slate-200 max-w-xl mx-auto my-8">
            <TicketIcon className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-6 text-xl font-extrabold text-slate-900">No purchased orders</h3>
            <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
              You haven't bought any tickets yet. Explore upcoming events to purchase your passes!
            </p>
            <Link
              to="/events"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand-main px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-dark transition-all active:scale-95"
            >
              <span>Browse Events</span>
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && !empty && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {paginatedOrders.map((order) => {
              const total = order.stats?.total || 0;
              const assigned = order.stats?.assigned || 0;
              const progressPercent = total > 0 ? Math.round((assigned / total) * 100) : 0;

              return (
                <div
                  key={order._id}
                  className="rounded-[32px] bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-between gap-6 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
                    {/* Event & Order info */}
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-slate-200">
                          Order #{order.orderNumber}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          Purchased on {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                        {order.paymentMethod && (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                            order.paymentMethod === 'card'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            {order.paymentMethod === 'card' ? (
                              <>
                                <CreditCardIcon className="h-3 w-3" />
                                <span>Card</span>
                              </>
                            ) : order.paymentMethod === 'bank_transfer' ? (
                              <>
                                <BanknotesIcon className="h-3 w-3" />
                                <span>Bank Transfer</span>
                              </>
                            ) : ['cash_on_entrance', 'cash_at_entrance'].includes(order.paymentMethod) ? (
                              <>
                                <TicketIcon className="h-3 w-3" />
                                <span>Cash at Entrance</span>
                              </>
                            ) : null}
                          </span>
                        )}
                        {order.status === 'RESERVED' && (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-amber-200">
                            🟡 Awaiting Payment at Entrance
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

                    {/* Progress tracking */}
                    <div className="w-full lg:w-60 shrink-0 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Assignee Activation</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-main transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        <span>{assigned} Assigned</span>
                        <span>{total - assigned} Pending</span>
                      </div>
                    </div>
                  </div>

                  {/* Reserved warning notice */}
                  {order.status === 'RESERVED' && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-xs">
                      <p className="font-semibold">
                        Your ticket has been reserved. Please pay at the event entrance to activate your entry pass.
                      </p>
                      <p className="mt-1 font-medium text-amber-600">
                        All entry passes, QR codes, guest invites, and download functions will remain locked until cash payment is processed at the venue entrance.
                      </p>
                    </div>
                  )}

                  {/* Categories detail */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
                    {order.categories?.map((c) => (
                      <div key={c.categoryId || c.categoryName} className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-sm font-bold text-slate-900 truncate">{c.categoryName}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>Qty: {c.quantity}</span>
                          <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold">
                            {c.assigned} / {c.quantity} Assigned
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5">
                    <p className="text-base font-extrabold text-slate-900">
                      {order.status === 'RESERVED' ? 'Total to Pay:' : 'Total Paid:'} {order.currency || order.event?.currency || 'LKR'} {Number(order.totalAmount || 0).toLocaleString()}
                    </p>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => order.status !== 'RESERVED' && handleDownloadOrder(order._id)}
                        disabled={order.status === 'RESERVED'}
                        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all ${
                          order.status === 'RESERVED' 
                            ? 'opacity-40 cursor-not-allowed bg-slate-100' 
                            : 'hover:bg-slate-50 active:scale-95'
                        }`}
                        title={order.status === 'RESERVED' ? 'Pay at venue entrance to activate ticket download.' : ''}
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        <span>Order Receipt</span>
                      </button>

                      <Link
                        to={order.status === 'RESERVED' ? '#' : `/buyer/assign/${order._id}`}
                        onClick={(e) => order.status === 'RESERVED' && e.preventDefault()}
                        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all ${
                          order.status === 'RESERVED' 
                            ? 'opacity-40 cursor-not-allowed bg-slate-400' 
                            : 'bg-brand-main hover:bg-brand-dark active:scale-95'
                        }`}
                        title={order.status === 'RESERVED' ? 'Awaiting payment confirmation at entrance.' : ''}
                      >
                        <span>Manage Attendees</span>
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2">
                <p className="text-xs text-slate-500 font-medium">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
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
        )}

      </div>
    </BuyerLayout>
  );
};

export default BuyerTicketsPage;
