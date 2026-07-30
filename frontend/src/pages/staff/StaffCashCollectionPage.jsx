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
  CalendarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { getMyEvents } from '../../api/events';

const StaffCashCollectionPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' = RESERVED, 'approved' = CONFIRMED

  const [confirmingOrder, setConfirmingOrder] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const hasAccess = ['MainAdmin', 'MainOrganiser', 'SubOrganiser'].includes(user?.role) || user?.canCollectCash === true || user?.permissions?.canCollectCash === true;

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-12 text-center p-8 bg-white border border-slate-200 rounded-[32px] shadow-sm">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600 mb-4">
            <XMarkIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            You do not have the required permissions to access the Cash Collection console.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Load events
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
      .catch((err) => {
        console.error('Error fetching events:', err);
        toast.error('Failed to load events');
      });
  }, [selectedEventId]);

  // Load cash orders
  const fetchCashOrders = () => {
    if (!selectedEventId) return;
    setLoading(true);
    api.get(`/payment/cash-orders?eventId=${selectedEventId}&status=${statusFilter}`)
      .then((res) => {
        setOrders(res.data?.data || []);
      })
      .catch((err) => {
        console.error('Error loading cash orders:', err);
        toast.error('Failed to load cash orders');
      })
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
      toast.success('Cash payment confirmed successfully! Tickets generated.');
      setConfirmingOrder(null);
      fetchCashOrders();
    } catch (err) {
      console.error('Error confirming cash payment:', err);
      toast.error(err.response?.data?.message || 'Failed to confirm cash payment');
    } finally {
      setConfirmLoading(false);
    }
  };

  // Filter orders by search query locally
  const filteredOrders = orders.filter((order) => {
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber?.toLowerCase().includes(q) ||
      order.buyerName?.toLowerCase().includes(q) ||
      order.buyerEmail?.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto px-2">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Cash Collection Desk</h1>
            <p className="text-sm font-medium text-slate-500">Collect ticket payment at the door and issue confirmation codes.</p>
          </div>
          <div className="w-full md:w-64">
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                localStorage.setItem('lastSelectedEventId', e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800"
            >
              {events.map((evt) => (
                <option key={evt._id} value={evt._id}>
                  {evt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters and Search */}
        <Card className="rounded-[24px]">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="relative w-full sm:w-80">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Order #, Name, Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'pending'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Awaiting Payment
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'approved'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Paid / Confirmed
              </button>
            </div>
          </div>
        </Card>

        {/* Orders Table */}
        <Card className="rounded-[24px]">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-semibold">
              No orders found matching the filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Order Number</Th>
                    <Th>Buyer Name</Th>
                    <Th>Ticket Categories</Th>
                    <Th>Total Amount</Th>
                    <Th>Status</Th>
                    <Th>Created Date</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <Tr key={order._id}>
                      <Td className="font-bold text-slate-900">{order.orderNumber}</Td>
                      <Td>
                        <div>
                          <p className="font-semibold text-slate-900">{order.buyerName}</p>
                          <p className="text-xs text-slate-500">{order.buyerEmail}</p>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-sm font-medium text-slate-700">
                          {order.tickets?.map((t) => `${t.categoryName} x ${t.quantity}`).join(', ')}
                        </span>
                      </Td>
                      <Td className="font-extrabold text-slate-900">{formatCurrency(order.totalAmount)}</Td>
                      <Td>
                        <Badge color={order.status === 'CONFIRMED' ? 'green' : 'amber'}>
                          {order.status === 'CONFIRMED' ? 'PAID' : 'AWAITING CASH'}
                        </Badge>
                      </Td>
                      <Td className="text-slate-600 text-sm">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </Td>
                      <Td>
                        {order.status === 'RESERVED' && (
                          <button
                            onClick={() => setConfirmingOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                          >
                            <BanknotesIcon className="h-4 w-4" />
                            Collect Cash
                          </button>
                        )}
                        {order.status === 'CONFIRMED' && (
                          <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                            <CheckCircleIcon className="h-4 w-4" /> Paid
                          </span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation Modal */}
      {confirmingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[32px] max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-lg font-black text-slate-900">Confirm Cash Payment</h3>
              <button onClick={() => setConfirmingOrder(null)} className="text-slate-400 hover:text-slate-600 transition">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <UserIcon className="h-8 w-8 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-widest font-black">Purchaser</p>
                  <p className="font-bold text-slate-900">{confirmingOrder.buyerName}</p>
                  <p className="text-xs text-slate-500">{confirmingOrder.buyerEmail}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-black flex items-center gap-1.5">
                  <TicketIcon className="h-4 w-4" /> Tickets Summary
                </p>
                <div className="divide-y divide-slate-200">
                  {confirmingOrder.tickets?.map((t, idx) => (
                    <div key={idx} className="py-2 flex justify-between text-sm">
                      <span className="font-semibold text-slate-700">{t.categoryName}</span>
                      <span className="font-bold text-slate-900">x{t.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <div>
                  <p className="text-xs text-amber-700 uppercase tracking-widest font-black">Total Due Now</p>
                  <p className="text-2xl font-black text-amber-950 mt-1">{formatCurrency(confirmingOrder.totalAmount)}</p>
                </div>
                <div className="p-3 bg-amber-200 text-amber-800 rounded-xl">
                  <BanknotesIcon className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                disabled={confirmLoading}
                onClick={handleConfirmCash}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-2xl transition shadow-sm text-sm"
              >
                {confirmLoading ? 'Processing...' : 'Confirm Cash Received'}
              </button>
              <button
                disabled={confirmLoading}
                onClick={() => setConfirmingOrder(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-2xl transition text-sm"
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
