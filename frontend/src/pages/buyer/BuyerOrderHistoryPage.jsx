import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBuyerOrderHistory, getOrderDetails, requestRefund, downloadInvoice } from '../../api/buyerOrders';
import { CalendarIcon, MapPinIcon, ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';

const statusConfig = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  REFUNDED: { label: 'Refunded', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  COMPLETED: { label: 'Completed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  RESERVED: { label: 'Reserved – Awaiting Payment', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  PENDING_PAYMENT: { label: 'On Hold – Payment Verification', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  PENDING_VERIFICATION: { label: 'Pending Verification', className: 'bg-sky-100 text-sky-800 border-sky-200' },
};

const BuyerOrderHistoryPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('all');
  const itemsPerPage = 8;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: itemsPerPage };
      if (filterStatus !== 'all') params.status = filterStatus;
      const response = await getBuyerOrderHistory(params);
      const data = response.data?.data || {};
      setOrders(data.orders || []);
    } catch (err) {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus]);

  const fetchOrderDetails = useCallback(async (orderId) => {
    setDetailsLoading(true);
    try {
      const response = await getOrderDetails(orderId);
      setOrderDetails(response.data?.data);
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!user || !user._id) return;

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      socket.emit('join_buyer', { userId: user._id });
    });

    socket.on('order_status_changed', (data) => {
      toast.success(`Order #${data.orderNumber} status updated to ${data.paymentStatus || data.status}!`);
      fetchOrders();
      if (selectedOrder && selectedOrder._id === data.orderId) {
        fetchOrderDetails(data.orderId);
      }
    });

    return () => {
      socket.emit('leave_buyer', { userId: user._id });
      socket.disconnect();
    };
  }, [user, selectedOrder, fetchOrders, fetchOrderDetails]);

  const handleViewOrder = async (order) => {
    setSelectedOrder(order);
    setOrderDetails(null);
    setDetailsLoading(true);
    setShowRefundModal(false);
    try {
      const response = await getOrderDetails(order._id);
      setOrderDetails(response.data?.data);
    } catch (err) {
      toast.error('Failed to load order details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!refundReason.trim() || refundReason.length < 10) { toast.error('Reason must be at least 10 characters'); return; }
    setRefundLoading(true);
    try {
      await requestRefund(selectedOrder._id, refundReason);
      toast.success('Refund request submitted');
      setShowRefundModal(false);
      setRefundReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit refund');
    } finally { setRefundLoading(false); }
  };

  const handleDownloadInvoice = async (orderId) => {
    try {
      toast.loading('Downloading invoice...', { id: 'invoice' });
      const response = await downloadInvoice(orderId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded', { id: 'invoice' });
    } catch (err) {
      toast.error('Failed to download invoice', { id: 'invoice' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount, currency = 'LKR') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [orders]);

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <h2 className="text-xl font-extrabold text-slate-900">Order History</h2>
            <p className="text-xs text-slate-500 font-medium">View and manage your ticket orders</p>
          </div>
          <div className="flex gap-4 shrink-0 w-full md:w-auto items-center">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="RESERVED">Reserved</option>
              <option value="PENDING_PAYMENT">On Hold</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
            <div className="h-44 rounded-[32px] bg-slate-200 animate-pulse" />
          </div>
        )}

        {/* Empty State */}
        {!loading && sortedOrders.length === 0 && (
          <div className="rounded-[32px] bg-white p-12 text-center shadow-sm border border-slate-200 max-w-xl mx-auto my-8">
            <p className="mt-6 text-sm text-slate-500">No orders found</p>
          </div>
        )}

        {/* Orders List */}
        {!loading && sortedOrders.length > 0 && (
          <div className="space-y-6">
            {sortedOrders.map((order) => {
              const status = statusConfig[order.status] || { label: order.status, className: 'bg-slate-100 text-slate-800' };
              return (
                <div
                  key={order._id}
                  className="rounded-[32px] bg-white border border-slate-200 p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:shadow-md transition"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase rounded-md border border-slate-200">
                        Order #{order.orderNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{formatDate(order.createdAt)}</span>
                      <span className={`ml-2 text-xs font-bold px-2.5 py-0.5 rounded-full border ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900">{order.event?.name || 'Event'}</h3>
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
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <div className="text-right mr-1">
                      <p className="text-lg font-extrabold text-slate-900">{formatCurrency(order.totalAmount, order.currency || order.event?.currency || 'LKR')}</p>
                      <p className="text-xs text-slate-500">{order.progress?.total || 0} tickets</p>
                    </div>
                    {['CONFIRMED', 'COMPLETED', 'PAID'].includes(order.status) || order.paymentStatus === 'paid' || order.paymentStatus === 'success' ? (
                      <Link
                        to={`/buyer/orders/${order._id}`}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                      >
                        Manage Tickets
                      </Link>
                    ) : null}
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-200 transition"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="px-3 text-xs font-bold text-slate-700">Page {currentPage}</span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={sortedOrders.length < itemsPerPage}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Next <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelectedOrder(null); setOrderDetails(null); }}>
          <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Order #{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Placed on {formatDate(selectedOrder.createdAt)}</p>
              </div>
              <button onClick={() => { setSelectedOrder(null); setOrderDetails(null); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
            </div>

            {detailsLoading && !orderDetails ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-main border-t-transparent" />
                <p className="text-xs text-slate-500 mt-2">Loading order details...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Total Amount</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">
                      {formatCurrency(
                        orderDetails?.order?.totalAmount ?? selectedOrder.totalAmount, 
                        orderDetails?.order?.currency || selectedOrder.currency || 'LKR'
                      )}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Tickets</p>
                    <p className="text-lg font-extrabold text-slate-900 mt-1">
                      {orderDetails?.tickets?.length ?? selectedOrder.progress?.total ?? 1}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium">Status</p>
                    <div className="mt-1">
                      {(() => {
                        const stKey = orderDetails?.order?.status || selectedOrder.status;
                        const st = statusConfig[stKey] || { label: stKey || 'Confirmed', className: 'bg-green-100 text-green-800 border-green-200' };
                        return (
                          <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border ${st.className}`}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Payer Info */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <h4 className="font-bold text-slate-900 text-sm mb-2">Purchaser Details</h4>
                  <p className="text-sm font-semibold text-slate-800">
                    {orderDetails?.order?.buyerName || selectedOrder.buyerName || user?.fullName || user?.name || 'Guest Purchaser'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {orderDetails?.order?.buyerEmail || selectedOrder.buyerEmail || user?.email || 'N/A'}
                  </p>
                  {(orderDetails?.order?.buyerPhone || selectedOrder.buyerPhone) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {orderDetails?.order?.buyerPhone || selectedOrder.buyerPhone}
                    </p>
                  )}
                </div>

                {/* Event Info */}
                {(orderDetails?.order?.event || selectedOrder.event) && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="font-bold text-slate-900 text-sm mb-2">Event Details</h4>
                    <p className="text-sm font-semibold text-slate-800">
                      {orderDetails?.order?.event?.name || selectedOrder.event?.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(orderDetails?.order?.event?.startDate || selectedOrder.event?.startDate)}
                    </p>
                    {(orderDetails?.order?.event?.venue?.name || selectedOrder.event?.venue?.name) && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {orderDetails?.order?.event?.venue?.name || selectedOrder.event?.venue?.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Tickets */}
                {orderDetails?.tickets?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Tickets</h4>
                    <div className="space-y-2">
                      {orderDetails.tickets.map((ticket) => {
                        const isConfirmed = ['CONFIRMED', 'SOLD', 'PAID', 'COMPLETED'].includes(ticket.status);
                        return (
                          <div key={ticket._id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{ticket.categoryName}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{ticket.ticketNumber}</p>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isConfirmed ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                              {isConfirmed ? 'Confirmed' : ticket.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions & Ticket Options */}
                <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
                  {(() => {
                    const st = orderDetails?.order?.status || selectedOrder.status;
                    const paySt = orderDetails?.order?.paymentStatus;
                    const isPaidOrConfirmed = ['CONFIRMED', 'COMPLETED', 'PAID', 'RESERVED', 'PENDING_PAYMENT'].includes(st) || paySt === 'paid' || paySt === 'success';
                    
                    const orgList = orderDetails?.order?.event?.mainOrganisers || selectedOrder.event?.mainOrganisers || [];
                    const orgObj = orgList[0];
                    const organiserContact = typeof orgObj === 'string' ? orgObj : orgObj?.email;

                    if (!isPaidOrConfirmed) return null;

                    return (
                      <div className="space-y-4">
                        {/* Ticket Management Option */}
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-extrabold text-emerald-900 text-sm">Payment Confirmed & Active</p>
                              <p className="text-emerald-700 mt-0.5">Assign attendee names, guest emails, and upload photos to activate your passes.</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/buyer/orders/${selectedOrder._id}`}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm"
                              >
                                Manage / Confirm Tickets
                              </Link>
                              <button
                                onClick={() => handleDownloadInvoice(selectedOrder._id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-xs"
                              >
                                Download Invoice
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Organizer Contact Info */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-3">
                          <p className="font-extrabold text-slate-800">
                            Need to cancel your ticket or order? Please contact the Event Organizer for assistance.
                          </p>
                          <p className="text-slate-500 font-medium">
                            Contact: {organiserContact ? organiserContact : 'the Event Organizer or the Sub Organizer responsible for your ticket category.'}
                          </p>
                          <button
                            onClick={() => {
                              if (organiserContact) {
                                window.location.href = `mailto:${organiserContact}?subject=Order Cancellation Request - ${selectedOrder.orderNumber}`;
                              } else {
                                toast.error('Organizer contact information not available');
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-main px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark w-fit transition shadow-sm"
                          >
                            Contact Event Organizer
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRefundModal(false)}>
          <div className="bg-white rounded-[32px] max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-900 mb-4">Request Refund</h3>
            <p className="text-sm text-slate-600 mb-4">Refund requests are reviewed within 3-5 business days.</p>
            <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund (min 10 characters)..." className="w-full p-3 border border-slate-300 rounded-xl mb-4 text-sm" rows={3} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRefundModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={handleRequestRefund} disabled={refundLoading} className="px-4 py-2 text-xs font-bold bg-brand-main text-white rounded-xl hover:bg-brand-dark">
                {refundLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BuyerLayout>
  );
};

export default BuyerOrderHistoryPage;