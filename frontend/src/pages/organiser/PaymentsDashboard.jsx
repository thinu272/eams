import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  CreditCardIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserIcon,
  CalendarIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { getSocketUrl } from '../../utils/backend';
import {
  getAllPayments,
  getPaymentStatistics,
  getPaymentDetails,
  approvePayment,
  rejectPayment,
  requestPaymentInfo,
} from '../../api/organiser';

const statusColors = {
  pending_verification: 'amber',
  approved: 'green',
  rejected: 'red',
  needs_info: 'blue',
  paid: 'green',
  success: 'green',
  failed: 'red',
  awaiting_payment: 'amber',
  pending: 'amber',
};

const statusLabels = {
  pending_verification: 'Pending Verification',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_info: 'Needs Info',
  paid: 'Paid',
  success: 'Success',
  failed: 'Failed',
  awaiting_payment: 'Awaiting Payment',
  pending: 'Pending',
};

const getPaymentDisplayStatus = (payment) => {
  const rawStatus = payment?.verificationStatus || payment?.paymentStatus || payment?.orderStatus || 'pending';
  if (rawStatus === 'success') return 'approved';
  if (rawStatus === 'paid') return 'paid';
  return rawStatus;
};

const paymentMethodIcons = {
  card: CreditCardIcon,
  bank_transfer: BanknotesIcon,
  cash_on_entrance: BanknotesIcon,
  cash_at_entrance: BanknotesIcon,
};

const paymentMethodLabels = {
  card: 'Credit/Debit Card',
  bank_transfer: 'Bank Transfer',
  cash_on_entrance: 'Cash at Entrance',
  cash_at_entrance: 'Cash at Entrance',
};

const PaymentsDashboard = ({ eventId }) => {
  const [params, setParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionModal, setActionModal] = useState(null); // 'approve', 'reject', 'request-info'
  const [actionMessage, setActionMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState(params.get('status') || 'all');
  const [methodFilter, setMethodFilter] = useState(params.get('method') || 'all');
  const [searchQuery, setSearchQuery] = useState(params.get('search') || '');
  const [dateFrom, setDateFrom] = useState(params.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(params.get('dateTo') || '');

  // Pagination
  const [currentPage, setCurrentPage] = useState(parseInt(params.get('page') || '1', 10));
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const getResolvedEventId = () => {
    return eventId || localStorage.getItem('lastSelectedEventId') || undefined;
  };

  const fetchStatistics = async () => {
    try {
      const resolvedEventId = getResolvedEventId();
      const response = await getPaymentStatistics({ eventId: resolvedEventId });
      if (response.data?.success) {
        setStatistics(response.data.data?.overview || {});
      }
    } catch (error) {
      console.error('Error fetching payment statistics:', error);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const resolvedEventId = getResolvedEventId();
      const response = await getAllPayments({
        eventId: resolvedEventId,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
        search: searchQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: currentPage,
        limit: pageSize,
      });
      if (response.data?.success) {
        const data = response.data.data;
        setPayments(data.payments || []);
        setTotal(data.total || 0);
        setTotalPages(data.pages || 1);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentDetails = async (paymentId) => {
    setLoadingDetails(true);
    try {
      const response = await getPaymentDetails(paymentId);
      if (response.data?.success) {
        setPaymentDetails(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
      toast.error('Failed to load payment details');
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
    fetchPayments();
  }, [eventId, statusFilter, methodFilter, currentPage]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchPayments();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    const resolvedEventId = getResolvedEventId();
    if (!resolvedEventId) return undefined;

    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const joinDashboardRoom = () => {
      socket.emit('join_dashboard', { eventId: resolvedEventId });
    };

    socket.on('connect', joinDashboardRoom);
    socket.on('connect_error', (error) => {
      console.error('PaymentsDashboard socket connection error:', error);
    });

    joinDashboardRoom();

    const refreshPayments = () => {
      fetchStatistics();
      fetchPayments();
    };

    socket.on('payment_approved', refreshPayments);
    socket.on('payment_rejected', refreshPayments);
    socket.on('payment_info_request', refreshPayments);
    socket.on('cash_payment_confirmed', refreshPayments);
    socket.on('event_update', refreshPayments);
    socket.on('entry_update', refreshPayments);

    return () => {
      socket.off('payment_approved', refreshPayments);
      socket.off('payment_rejected', refreshPayments);
      socket.off('payment_info_request', refreshPayments);
      socket.off('cash_payment_confirmed', refreshPayments);
      socket.off('event_update', refreshPayments);
      socket.off('entry_update', refreshPayments);
      socket.disconnect();
    };
  }, [eventId, statusFilter, methodFilter, searchQuery, dateFrom, dateTo, currentPage]);

  const applyLocalPaymentUpdate = (paymentId, nextStatus, nextOrderStatus) => {
    setPayments((prev) => {
      const updated = prev.map((item) => {
        if (item._id !== paymentId && item.submissionId !== paymentId) return item;
        const nextItem = {
          ...item,
          verificationStatus: nextStatus,
          paymentStatus: nextOrderStatus,
          orderStatus: nextOrderStatus,
        };
        return nextItem;
      });
      return updated;
    });
  };

  const handleApprove = async () => {
    if (!selectedPayment) return;
    setProcessing(true);
    try {
      const paymentId = selectedPayment.submissionId || selectedPayment._id;
      if (!paymentId) {
        toast.error('Payment ID not found');
        return;
      }
      await approvePayment(paymentId, { notes: actionMessage });
      applyLocalPaymentUpdate(selectedPayment._id, 'approved', 'CONFIRMED');
      toast.success('Payment approved successfully');
      setActionModal(null);
      setSelectedPayment(null);
      setActionMessage('');
      await fetchPayments();
      await fetchStatistics();
    } catch (error) {
      console.error('Error approving payment:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to approve payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !actionMessage.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    try {
      const paymentId = selectedPayment.submissionId || selectedPayment._id;
      if (!paymentId) {
        toast.error('Payment ID not found');
        return;
      }
      await rejectPayment(paymentId, { rejectionReason: actionMessage });
      applyLocalPaymentUpdate(selectedPayment._id, 'rejected', 'CANCELLED');
      toast.success('Payment rejected successfully');
      setActionModal(null);
      setSelectedPayment(null);
      setActionMessage('');
      await fetchPayments();
      await fetchStatistics();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to reject payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!selectedPayment || !actionMessage.trim()) {
      toast.error('Please provide a message');
      return;
    }
    setProcessing(true);
    try {
      const paymentId = selectedPayment.submissionId || selectedPayment._id;
      if (!paymentId) {
        toast.error('Payment ID not found');
        return;
      }
      await requestPaymentInfo(paymentId, { message: actionMessage });
      applyLocalPaymentUpdate(selectedPayment._id, 'needs_info', 'PENDING_VERIFICATION');
      toast.success('Information request sent successfully');
      setActionModal(null);
      setSelectedPayment(null);
      setActionMessage('');
      await fetchPayments();
      await fetchStatistics();
    } catch (error) {
      console.error('Error requesting info:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to request information');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
          <p className={`text-4xl font-black text-${color}-600 leading-tight`}>{value}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-2">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-xl bg-${color}-50 ml-4`}>
          <Icon className={`h-8 w-8 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Transactions"
            value={statistics.totalPayments || 0}
            icon={BanknotesIcon}
            color="blue"
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(statistics.totalAmount || 0)}
            icon={BanknotesIcon}
            color="emerald"
          />
          <StatCard
            title="Pending Actions"
            value={(statistics.pendingPayments || 0) + (statistics.needsInfoPayments || 0)}
            icon={ClockIcon}
            color="amber"
            subtitle={`${statistics.pendingPayments || 0} pending · ${statistics.needsInfoPayments || 0} needs info`}
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-bold text-slate-900">Payment Management</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders, buyers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_info">Needs Info</option>
              <option value="awaiting_payment">Awaiting Payment</option>
            </select>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="card">Credit/Debit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash_at_entrance">Cash at Entrance</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="From date"
            />
          </div>
        </div>
      </Card>

      {/* Payments Table */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-medium">
            No payments found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Order Number</Th>
                  <Th>Buyer</Th>
                  <Th>Event</Th>
                  <Th>Payment Method</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const MethodIcon = paymentMethodIcons[payment.paymentMethod] || BanknotesIcon;
                  const displayStatus = getPaymentDisplayStatus(payment);
                  return (
                    <Tr key={payment._id}>
                      <Td>
                        <span className="font-bold text-slate-900">{payment.orderNumber}</span>
                      </Td>
                      <Td>
                        <div>
                          <p className="font-medium text-slate-900">{payment.buyer?.name}</p>
                          <p className="text-xs text-slate-500">{payment.buyer?.email}</p>
                        </div>
                      </Td>
                      <Td>
                        <p className="font-medium text-slate-900">{payment.event?.name}</p>
                        <p className="text-xs text-slate-500">
                          {payment.ticketSummary?.map((t) => t.categoryName).join(', ') || 'N/A'}
                        </p>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <MethodIcon className="h-4 w-4 text-slate-400" />
                          <span className="text-sm text-slate-600">
                            {paymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span className="font-bold text-slate-900">{formatCurrency(payment.totalAmount)}</span>
                      </Td>
                      <Td>
                        <Badge color={statusColors[displayStatus] || 'gray'}>
                          {statusLabels[displayStatus] || displayStatus}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="text-sm text-slate-600">
                          {new Date(payment.submittedAt).toLocaleDateString()}
                        </span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedPayment(payment);
                              fetchPaymentDetails(payment._id);
                            }}
                            className="px-2 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900 transition"
                          >
                            View Payment
                          </button>
                          {payment.paymentMethod === 'bank_transfer' && payment.receiptFile && (
                            <button
                              onClick={() => window.open(payment.receiptFile, '_blank')}
                              className="px-2 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded hover:bg-slate-50 hover:text-slate-900 transition"
                            >
                              View Receipt
                            </button>
                          )}
                          {(displayStatus === 'pending_verification' || displayStatus === 'pending') && payment.paymentMethod === 'bank_transfer' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionModal('approve');
                                }}
                                className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition"
                              >
                                Approve Payment
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionModal('reject');
                                }}
                                className="px-2 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition"
                              >
                                Reject Payment
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setActionModal('request-info');
                                }}
                                className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition"
                              >
                                Request More Information
                              </button>
                            </>
                          )}
                          {displayStatus === 'awaiting_payment' && payment.paymentMethod === 'cash_at_entrance' && (
                            <button
                              onClick={() => {
                                setSelectedPayment(payment);
                                setActionModal('approve');
                              }}
                              className="px-2 py-1 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition"
                            >
                              Approve Payment
                            </button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Page {currentPage} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, currentPage - 2) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                      pageNum === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Payment Details Modal */}
      <Modal
        open={!!selectedPayment}
        onClose={() => {
          setSelectedPayment(null);
          setPaymentDetails(null);
        }}
        title={`Payment Details - ${selectedPayment?.orderNumber}`}
        size="lg"
        footer={
          (selectedPayment?.verificationStatus === 'pending_verification' || selectedPayment?.verificationStatus === 'pending') && selectedPayment?.paymentMethod === 'bank_transfer' ? (
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedPayment(selectedPayment);
                  setActionModal('approve');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
              >
                Approve Payment
              </button>
              <button
                onClick={() => {
                  setSelectedPayment(selectedPayment);
                  setActionModal('reject');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
              >
                Reject Payment
              </button>
              <button
                onClick={() => {
                  setSelectedPayment(selectedPayment);
                  setActionModal('request-info');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
              >
                Request More Information
              </button>
            </div>
          ) : selectedPayment?.verificationStatus === 'awaiting_payment' && selectedPayment?.paymentMethod === 'cash_at_entrance' ? (
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedPayment(selectedPayment);
                  setActionModal('approve');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
              >
                Approve Payment
              </button>
            </div>
          ) : null
        }
      >
        {loadingDetails ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paymentDetails ? (
          <div className="space-y-6">
            {/* Buyer Information */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Buyer Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="font-medium text-slate-900">{paymentDetails.order?.buyerName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{paymentDetails.order?.buyerEmail}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">{paymentDetails.order?.buyerPhone}</p>
                </div>
              </div>
            </div>

            {/* Event Information */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BuildingOfficeIcon className="h-5 w-5" />
                Event Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Event Name</p>
                  <p className="font-medium text-slate-900">{paymentDetails.event?.name}</p>
                </div>
                <div>
                  <p className="text-slate-500">Event Date</p>
                  <p className="font-medium text-slate-900">
                    {paymentDetails.event?.startDate ? new Date(paymentDetails.event.startDate).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Venue</p>
                  <p className="font-medium text-slate-900">{paymentDetails.event?.venue?.name || 'TBD'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Amount</p>
                  <p className="font-bold text-slate-900">{formatCurrency(paymentDetails.order?.totalAmount)}</p>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BanknotesIcon className="h-5 w-5" />
                Payment Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Payment Method</p>
                  <p className="font-medium text-slate-900">
                    {paymentMethodLabels[paymentDetails.order?.paymentMethod] || paymentDetails.order?.paymentMethod}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Payment Status</p>
                  <Badge color={statusColors[paymentDetails.order?.paymentStatus] || 'gray'}>
                    {statusLabels[paymentDetails.order?.paymentStatus] || paymentDetails.order?.paymentStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500">Order Status</p>
                  <p className="font-medium text-slate-900">{paymentDetails.order?.status}</p>
                </div>
                <div>
                  <p className="text-slate-500">Order Date</p>
                  <p className="font-medium text-slate-900">
                    {paymentDetails.order?.createdAt ? new Date(paymentDetails.order.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Transfer Details */}
            {paymentDetails.paymentSubmission && paymentDetails.order?.paymentMethod === 'bank_transfer' && (
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <BanknotesIcon className="h-5 w-5" />
                  Bank Transfer Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Payer Name</p>
                    <p className="font-medium text-slate-900">{paymentDetails.paymentSubmission.payerName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Bank Used</p>
                    <p className="font-medium text-slate-900">{paymentDetails.paymentSubmission.bankUsed}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Transfer Date</p>
                    <p className="font-medium text-slate-900">{paymentDetails.paymentSubmission.transferDate}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Transfer Time</p>
                    <p className="font-medium text-slate-900">{paymentDetails.paymentSubmission.transferTime}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Reference Number</p>
                    <p className="font-medium text-slate-900">{paymentDetails.paymentSubmission.referenceNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Amount Paid</p>
                    <p className="font-bold text-slate-900">{formatCurrency(paymentDetails.paymentSubmission.amountPaid)}</p>
                  </div>
                </div>
                {(paymentDetails.paymentSubmission.receiptFile || selectedPayment?.receiptFile) && (
                  <div className="mt-4">
                    <p className="text-slate-500 mb-2">Payment Receipt</p>
                    <a
                      href={paymentDetails.paymentSubmission.receiptFile || selectedPayment?.receiptFile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      View Receipt
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Tickets */}
            {paymentDetails.tickets && paymentDetails.tickets.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-4">
                <h4 className="font-bold text-slate-900 mb-3">Tickets</h4>
                <div className="space-y-2">
                  {paymentDetails.tickets.map((ticket) => (
                    <div key={ticket._id} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{ticket.categoryName}</p>
                        <p className="text-slate-500">{ticket.ticketNumber}</p>
                      </div>
                      <Badge color={statusColors[ticket.status] || 'gray'}>
                        {ticket.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">No payment details available</div>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => {
          setActionModal(null);
          setSelectedPayment(null);
          setActionMessage('');
        }}
        title={
          actionModal === 'approve'
            ? 'Approve Payment'
            : actionModal === 'reject'
            ? 'Reject Payment'
            : 'Request Additional Information'
        }
      >
        <div className="space-y-6">
          {actionModal === 'approve' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-900 mb-1">Confirm Payment Approval</p>
                  <p className="text-sm text-green-700">
                    You are about to approve payment for order <span className="font-bold">{selectedPayment?.orderNumber}</span>.
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    This action will:
                  </p>
                  <ul className="text-sm text-green-700 mt-1 list-disc list-inside space-y-1">
                    <li>Confirm the payment as received</li>
                    <li>Update order status to CONFIRMED</li>
                    <li>Activate all tickets for this order</li>
                    <li>Send confirmation email to buyer</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {actionModal === 'reject' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircleIcon className="h-6 w-6 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 mb-1">Reject Payment</p>
                  <p className="text-sm text-red-700">
                    You are about to reject payment for order <span className="font-bold">{selectedPayment?.orderNumber}</span>.
                  </p>
                  <p className="text-sm text-red-700 mt-2">
                    This action will:
                  </p>
                  <ul className="text-sm text-red-700 mt-1 list-disc list-inside space-y-1">
                    <li>Cancel the payment submission</li>
                    <li>Update order status to CANCELLED</li>
                    <li>Deactivate all tickets</li>
                    <li>Send rejection notification to buyer</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {actionModal === 'request-info' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ExclamationCircleIcon className="h-6 w-6 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900 mb-1">Request Additional Information</p>
                  <p className="text-sm text-blue-700">
                    You are requesting more information for order <span className="font-bold">{selectedPayment?.orderNumber}</span>.
                  </p>
                  <p className="text-sm text-blue-700 mt-2">
                    This action will:
                  </p>
                  <ul className="text-sm text-blue-700 mt-1 list-disc list-inside space-y-1">
                    <li>Update payment status to "Needs Info"</li>
                    <li>Send your message to the buyer</li>
                    <li>Buyer will be able to provide additional details</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {actionModal !== 'approve' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {actionModal === 'reject' ? 'Rejection Reason' : 'Information Request'}
              </label>
              <textarea
                value={actionMessage}
                onChange={(e) => setActionMessage(e.target.value)}
                placeholder={
                  actionModal === 'reject'
                    ? 'Please explain why this payment is being rejected...'
                    : 'Please specify what additional information is needed...'
                }
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <p className="text-xs text-slate-500 mt-1">
                {actionModal === 'reject' 
                  ? 'This message will be sent to the buyer explaining the rejection.' 
                  : 'This message will be sent to the buyer requesting additional information.'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                setActionModal(null);
                setSelectedPayment(null);
                setActionMessage('');
              }}
              disabled={processing}
              className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={
                actionModal === 'approve'
                  ? handleApprove
                  : actionModal === 'reject'
                  ? handleReject
                  : handleRequestInfo
              }
              disabled={processing || (actionModal !== 'approve' && !actionMessage.trim())}
              className={`px-6 py-2.5 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                actionModal === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : actionModal === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : actionModal === 'approve' ? (
                'Approve Payment'
              ) : actionModal === 'reject' ? (
                'Reject Payment'
              ) : (
                'Send Request'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentsDashboard;
