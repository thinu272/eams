import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBuyerOrderHistory, getOrderDetails, cancelOrder, requestRefund, downloadInvoice } from '../../api/buyerOrders';
import { CalendarIcon, MapPinIcon, ChevronLeftIcon, ChevronRightIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import BuyerLayout from '../../components/layout/BuyerLayout';

const statusConfig = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-green-100 text-green-800 border-green-200' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  REFUNDED: { label: 'Refunded', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  COMPLETED: { label: 'Completed', className: 'bg-blue-100 text-blue-800 border-blue-200' },
};

const BuyerOrderHistoryPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
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

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleViewOrder = async (order) => {
    setSelectedOrder(order);
    setDetailsLoading(true);
    setShowCancelModal(false);
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

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) { toast.error('Please provide a reason'); return; }
    setCancelLoading(true);
    try {
      await cancelOrder(selectedOrder._id, cancelReason);
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelReason('');
      fetchOrders();
      setOrderDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally { setCancelLoading(false); }
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

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(amount || 0);

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
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-slate-900">{formatCurrency(order.totalAmount)}</p>
                      <p className="text-xs text-slate-500">{order.itemCount || 0} tickets</p>
                    </div>
                    <button
                      onClick={() => handleViewOrder(order)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-brand-main px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition"
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
      {selectedOrder && orderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelectedOrder(null); setOrderDetails(null); }}>
          <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold text-slate-900">Order #{selectedOrder.orderNumber}</h3>
              <button onClick={() => { setSelectedOrder(null); setOrderDetails(null); }} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-brand-main border-t-transparent" /></div>
            ) : (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500">Total Amount</p>
                    <p className="text-lg font-extrabold text-slate-900">{formatCurrency(orderDetails.totalAmount)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500">Tickets</p>
                    <p className="text-lg font-extrabold text-slate-900">{orderDetails.tickets?.length || 0}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <p className="text-xs text-slate-500">Status</p>
                    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusConfig[orderDetails.status]?.className || 'bg-slate-100'}`}>
                      {statusConfig[orderDetails.status]?.label || orderDetails.status}
                    </span>
                  </div>
                </div>

                {/* Payer Info */}
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <h4 className="font-bold text-slate-900 mb-2">Purchaser Details</h4>
                  <p className="text-slate-700">{orderDetails.buyerName}</p>
                  <p className="text-xs text-slate-500">{orderDetails.buyerEmail}</p>
                  {orderDetails.buyerPhone && <p className="text-xs text-slate-500">{orderDetails.buyerPhone}</p>}
                </div>

                {/* Event Info */}
                {orderDetails.event && (
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <h4 className="font-bold text-slate-900 mb-2">Event Details</h4>
                    <p className="text-slate-700">{orderDetails.event.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(orderDetails.event.startDate)}</p>
                    {orderDetails.event.venue && <p className="text-xs text-slate-500">{orderDetails.event.venue.name}</p>}
                  </div>
                )}

                {/* Tickets */}
                {orderDetails.tickets?.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 mb-3">Tickets</h4>
                    <div className="space-y-2">
                      {orderDetails.tickets.map((ticket) => (
                        <div key={ticket._id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                          <div>
                            <p className="font-bold text-slate-900">{ticket.categoryName}</p>
                            <p className="text-xs text-slate-500">{ticket.ticketNumber}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ticket.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
                            {ticket.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
                  {selectedOrder.status === 'CONFIRMED' && (
                    <>
                      <button onClick={() => setShowCancelModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">
                        Cancel Order
                      </button>
                      <button onClick={() => setShowRefundModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        <ArrowPathIcon className="h-4 w-4" /> Request Refund
                      </button>
                    </>
                  )}
                  {selectedOrder.status === 'PENDING' && (
                    <button onClick={() => setShowCancelModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100">
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-[32px] max-w-md w-full p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-900 mb-4">Cancel Order</h3>
            <p className="text-sm text-slate-600 mb-4">Are you sure? This cannot be undone.</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation..." className="w-full p-3 border border-slate-300 rounded-xl mb-4 text-sm" rows={3} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl">Keep Order</button>
              <button onClick={handleCancelOrder} disabled={cancelLoading} className="px-4 py-2 text-xs font-bold bg-red-600 text-white rounded-xl hover:bg-red-700">
                {cancelLoading ? 'Processing...' : 'Cancel Order'}
              </button>
            </div>
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