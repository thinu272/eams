import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import api from '../../api/client';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XMarkIcon,
  TicketIcon,
  UserIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { getMyEvents } from '../../api/events';
import { useNavigate } from 'react-router-dom';

const StaffCashCollectionPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');

  const [confirmingOrder, setConfirmingOrder] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const hasAccess =
    ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(user?.role) ||
    user?.canCollectCash === true ||
    user?.permissions?.canCollectCash === true;

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <XMarkIcon className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-500">
            You do not have permission to access the Cash Collection console.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  useEffect(() => {
    getMyEvents()
      .then((res) => {
        const list = res.data?.data?.events || [];
        setEvents(list);
        if (list.length > 0 && !selectedEventId) {
          setSelectedEventId(list[0]._id);
          localStorage.setItem('lastSelectedEventId', list[0]._id);
        }
      })
      .catch(() => toast.error('Failed to load events'));
  }, [selectedEventId]);

  const fetchCashOrders = () => {
    if (!selectedEventId) return;
    setLoading(true);
    api
      .get(`/payment/cash-orders?eventId=${selectedEventId}&status=${statusFilter}`)
      .then((res) => setOrders(res.data?.data || []))
      .catch(() => toast.error('Failed to load cash orders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCashOrders();
  }, [selectedEventId, statusFilter]);

  const handleConfirmCash = async () => {
    if (!confirmingOrder) return;
    setConfirmLoading(true);
    try {
      await api.post(`/payment/cash-confirm/${confirmingOrder._id}`);
      toast.success('Cash payment confirmed. Tickets generated.');
      setConfirmingOrder(null);
      fetchCashOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm cash payment');
    } finally {
      setConfirmLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(q) ||
      order.buyerName?.toLowerCase().includes(q) ||
      order.buyerEmail?.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-24 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/staff/dashboard')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Exit Console
          </button>
        </div>

        {/* Header */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Cash Desk
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Cash Collection
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Collect payment at the door and issue confirmation.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  localStorage.setItem('lastSelectedEventId', e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white"
              >
                {events.map((evt) => (
                  <option key={evt._id} value={evt._id}>
                    {evt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search order #, name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  statusFilter === 'pending'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Awaiting Payment
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Paid / Confirmed
              </button>
            </div>
          </div>
        </div>

        {/* Orders table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-sm font-medium text-slate-500">
              No orders found matching the filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Order
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Buyer
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Tickets
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Amount
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Date
                    </th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {order.buyerName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {order.buyerEmail}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {order.tickets
                          ?.map((t) => `${t.categoryName} × ${t.quantity}`)
                          .join(', ')}
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            order.status === 'CONFIRMED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {order.status === 'CONFIRMED' ? 'Paid' : 'Awaiting Cash'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        {order.status === 'RESERVED' && (
                          <button
                            onClick={() => setConfirmingOrder(order)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            <BanknotesIcon className="h-4 w-4" />
                            Collect Cash
                          </button>
                        )}
                        {order.status === 'CONFIRMED' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircleIcon className="h-4 w-4" />
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                Confirm Cash Payment
              </h3>
              <button
                onClick={() => setConfirmingOrder(null)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Purchaser
                  </p>
                  <p className="font-semibold text-slate-900">
                    {confirmingOrder.buyerName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {confirmingOrder.buyerEmail}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <TicketIcon className="h-3.5 w-3.5" />
                  Tickets
                </p>
                <div className="divide-y divide-slate-200">
                  {confirmingOrder.tickets?.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between py-2 text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {t.categoryName}
                      </span>
                      <span className="font-semibold text-slate-900">
                        ×{t.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                    Total Due Now
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-900">
                    {formatCurrency(confirmingOrder.totalAmount)}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 p-5">
              <button
                disabled={confirmLoading}
                onClick={handleConfirmCash}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {confirmLoading ? 'Processing...' : 'Confirm Cash Received'}
              </button>
              <button
                disabled={confirmLoading}
                onClick={() => setConfirmingOrder(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default StaffCashCollectionPage;