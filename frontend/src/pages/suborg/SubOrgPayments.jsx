import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
  getSubOrgPayments,
  getSubOrgPaymentStatistics,
  getSubOrgPaymentDetails,
  approveSubOrgPayment,
  rejectSubOrgPayment,
  requestSubOrgPaymentInfo,
} from '../../api/subPaymentManagement';
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  pending: { label: 'Pending', color: 'amber' },
  pending_verification: { label: 'Pending Verification', color: 'amber' },
  awaiting_payment: { label: 'Awaiting Payment', color: 'blue' },
  paid: { label: 'Paid', color: 'green' },
  success: { label: 'Approved', color: 'green' },
  approved: { label: 'Approved', color: 'green' },
  verified: { label: 'Verified', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
  failed: { label: 'Failed', color: 'red' },
  needs_info: { label: 'Needs Info', color: 'blue' },
};

const formatCurrency = (amount, currency = 'LKR') =>
  `${currency} ${Number(amount || 0).toLocaleString()}`;

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatMethod = (m) => {
  if (m === 'card') return 'Card';
  if (m === 'bank_transfer') return 'Bank Transfer';
  if (m === 'cash_at_entrance' || m === 'cash_on_entrance') return 'Cash at Venue';
  return m || '-';
};

const normalizeStatus = (status) => {
  if (status === 'success' || status === 'paid') return 'approved';
  if (status === 'failed') return 'rejected';
  return status;
};

const SubOrgPayments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({page: 1,limit: 10,pages: 1,total: 0,});

  // Detail / Action state
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [showConfirmCashModal, setShowConfirmCashModal] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  // Current event (read from localStorage, same as SubOrgDashboard)
  const [currentEventId, setCurrentEventId] = useState(() => {
    const id = localStorage.getItem('lastSelectedEventId');
    return (id && id !== 'undefined' && id !== 'null') ? id : '';
  });

  // ─── Fetch payments ───────────────────────────────────────
  const fetchPayments = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const cleanId =
      currentEventId &&
      currentEventId !== 'undefined' &&
      currentEventId !== 'null'
        ? currentEventId
        : undefined;

    const params = {
      page: pagination.page,
      limit: pagination.limit,
      eventId: cleanId,
    };

    if (statusFilter && statusFilter !== 'all') {
      params.status = statusFilter;
    }

    if (methodFilter && methodFilter !== 'all') {
      params.paymentMethod = methodFilter;
    }

    if (searchQuery) {
      params.search = searchQuery;
    }

    const res = await getSubOrgPayments(params);

    console.log('PAYMENT API RESPONSE:', res.data);

    const data = res.data?.data || {};

    setPayments(data.payments || []);

    // Get pagination from backend
    const backendPagination = data.pagination || {};

    const total =
      Number(backendPagination.total) ||
      Number(data.total) ||
      0;

    const limit =
      Number(backendPagination.limit) ||
      pagination.limit ||
      10;

    const pages =
      Number(backendPagination.pages) ||
      Math.ceil(total / limit) ||
      1;

    setPagination((prev) => ({
      ...prev,
      page:
        Number(backendPagination.page) ||
        prev.page,
      limit,
      total,
      pages,
    }));

  } catch (err) {
    console.error('Failed to load payments:', err);
    console.error('Payment API error:', err.response?.data);

    setError('Failed to load payments');
    toast.error('Failed to load payments');

  } finally {
    setLoading(false);
  }
}, [
  statusFilter,
  methodFilter,
  searchQuery,
  pagination.page,
  pagination.limit,
  currentEventId,
]);

  // ─── Fetch statistics ─────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const cleanId = currentEventId && currentEventId !== 'undefined' && currentEventId !== 'null' ? currentEventId : undefined;
      const res = await getSubOrgPaymentStatistics({ eventId: cleanId });
      setStatistics(res.data?.data?.overview || null);
    } catch {
      console.error('Failed to load payment statistics');
    } finally {
      setStatsLoading(false);
    }
  }, [currentEventId]);

  useEffect(() => {
    fetchPayments();
    fetchStats();
  }, [fetchPayments, fetchStats]);

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined' || newId === 'null') return;
      setCurrentEventId(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => {
      window.removeEventListener('entrynex:event-select', handleEventSelect);
    };
  }, []);

  // ─── View details ─────────────────────────────────────────
  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailsLoading(true);
    try {
      const res = await getSubOrgPaymentDetails(payment._id);
      setPaymentDetails(res.data?.data || null);
    } catch {
      toast.error('Failed to load payment details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedPayment(null);
    setPaymentDetails(null);
    setShowRejectModal(false);
    setShowRequestInfoModal(false);
    setShowConfirmCashModal(false);
    setActionMessage('');
  };

  // ─── Approve ──────────────────────────────────────────────
  const handleApprove = async (id, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm('Approve this payment? This will confirm the order and activate tickets.'))
      return;
    setActionLoading(id);
    try {
      await approveSubOrgPayment(id);
      toast.success('Payment approved successfully!');
      closeDetails();
      fetchPayments();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Reject ───────────────────────────────────────────────
  const handleReject = async () => {
    if (!actionMessage.trim()) return toast.error('Please provide a reason for rejection');
    setActionLoading('reject');
    try {
      await rejectSubOrgPayment(selectedPayment._id, { rejectionReason: actionMessage });
      toast.success('Payment rejected');
      closeDetails();
      fetchPayments();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Request more info ────────────────────────────────────
  const handleRequestInfo = async () => {
    if (!actionMessage.trim()) return toast.error('Please provide a message');
    setActionLoading('request_info');
    try {
      await requestSubOrgPaymentInfo(selectedPayment._id, { message: actionMessage });
      toast.success('Information request sent to buyer');
      closeDetails();
      fetchPayments();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Metric Card ──────────────────────────────────────────
  const MetricCard = ({ title, value, subtitle, icon: Icon, colorClass = 'text-blue-600 bg-blue-50' }) => (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{statsLoading ? '-' : value}</p>
          {subtitle && <p className="mt-2 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className={`rounded-2xl p-3 ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Sub Organiser</p>
          <h1 className="mt-2 text-3xl font-bold">Payment Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-200">
            Review, approve and manage payments for your assigned event scope.
            Sub-organisers can only see payments related to their assigned events.
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Assigned"
            value={statistics?.totalPayments || 0}
            subtitle="Transactions"
            icon={BanknotesIcon}
            colorClass="text-blue-600 bg-blue-50"
          />
          <MetricCard
            title="Total Paid Amount"
            value={formatCurrency(statistics?.approvedAmount || 0)}
            subtitle="Confirmed Revenue"
            icon={CheckCircleIcon}
            colorClass="text-emerald-600 bg-emerald-50"
          />
          <MetricCard
            title="Pending Bank Transfers"
            value={statistics?.pendingBankTransfers || 0}
            icon={ClockIcon}
            colorClass="text-amber-600 bg-amber-50"
          />
          <MetricCard
            title="Approved Bank Transfers"
            value={statistics?.approvedBankTransfers || 0}
            icon={CheckCircleIcon}
            colorClass="text-emerald-600 bg-emerald-50"
          />
          <MetricCard
            title="Cash at Entrance"
            value={statistics?.cashReservations || 0}
            subtitle="Reservations"
            icon={ClockIcon}
            colorClass="text-amber-600 bg-amber-50"
          />
          <MetricCard
            title="Cash Collected"
            value={formatCurrency(statistics?.cashCollected || 0)}
            icon={BanknotesIcon}
            colorClass="text-emerald-600 bg-emerald-50"
          />
          <MetricCard
            title="Awaiting Info"
            value={statistics?.needsInfoPayments || 0}
            icon={ExclamationTriangleIcon}
            colorClass="text-blue-600 bg-blue-50"
          />
          <MetricCard
            title="Rejected Payments"
            value={statistics?.rejectedPayments || 0}
            icon={XCircleIcon}
            colorClass="text-rose-600 bg-rose-50"
          />
        </div>

        {/* Filters */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          {/* Method Tabs */}
          <div className="flex space-x-2 border-b border-slate-100 pb-4 overflow-x-auto">
            {[
              { key: 'all', label: 'All Methods' },
              { key: 'bank_transfer', label: 'Bank Transfer' },
              { key: 'cash_at_entrance', label: 'Cash at Entrance' },
              { key: 'card', label: 'Card' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setMethodFilter(key);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  methodFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status + Search */}
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Search by order number, email..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPagination((p) => ({ ...p, page: 1 }));
                }
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="needs_info">Needs Info</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 pt-6 pb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Payment Submissions</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pagination.total} payment{pagination.total !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingSkeleton />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-500">{error}</div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center">
              <BanknotesIcon className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-medium text-slate-900">No payments found</h3>
              <p className="mt-2 text-sm text-slate-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <thead>
                  <Tr>
                    <Th>Order #</Th>
                    <Th>Method</Th>
                    <Th>Payer Details</Th>
                    <Th>Amount</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const displayStatus = normalizeStatus(
                      payment.verificationStatus || payment.paymentStatus
                    );
                    const info = statusConfig[displayStatus] || {
                      label: displayStatus,
                      color: 'gray',
                    };

                    return (
                      <Tr key={payment._id}>
                        <Td>
                          <span className="font-mono text-sm font-medium text-slate-900">
                            {payment.orderNumber || payment.orderId?.orderNumber || '-'}
                          </span>
                        </Td>
                        <Td>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {formatMethod(payment.paymentMethod)}
                            </p>
                            {(payment.gatewayUsed || payment.bankUsed) && (
                              <p className="text-xs text-slate-500 uppercase">
                                {payment.gatewayUsed || payment.bankUsed}
                              </p>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {payment.buyer?.name || payment.buyerName || '-'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {payment.buyer?.email || payment.buyerEmail || '-'}
                            </p>
                          </div>
                        </Td>
                        <Td>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(payment.totalAmount || payment.amountPaid)}
                          </span>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-900">
                            {formatDate(payment.submittedAt || payment.createdAt)}
                          </p>
                        </Td>
                        <Td>
                          <Badge color={info.color}>{info.label}</Badge>
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleViewDetails(payment)}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              title="View Details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            {/* Inline approve/reject for bank_transfer pending */}
                            {payment.paymentMethod === 'bank_transfer' &&
                              (displayStatus === 'pending' ||
                                displayStatus === 'pending_verification') && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleApprove(payment.submissionId || payment._id)
                                    }
                                    disabled={actionLoading === (payment.submissionId || payment._id)}
                                    className="rounded-xl p-1.5 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                                    title="Approve"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                      setShowRejectModal(true);
                                    }}
                                    className="rounded-xl p-1.5 text-red-400 hover:bg-red-50 hover:text-red-500"
                                    title="Reject"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            {/* Inline confirm for cash at entrance */}
                            {(payment.paymentMethod === 'cash_at_entrance' ||
                              payment.paymentMethod === 'cash_on_entrance') &&
                              (displayStatus === 'pending' ||
                                displayStatus === 'awaiting_payment') && (
                                <button
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowConfirmCashModal(true);
                                  }}
                                  disabled={actionLoading === (payment.submissionId || payment._id)}
                                  className="rounded-xl px-2.5 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition"
                                  title="Confirm Payment"
                                >
                                  Confirm
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
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
              <div className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.pages} · {pagination.total} total
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      page: p.page - 1,
                    }))
                  }
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Previous
                </Button>

                {Array.from(
                  { length: Math.min(5, pagination.pages) },
                  (_, i) => {
                    const pageNum = Math.max(1, pagination.page - 2) + i;

                    if (pageNum > pagination.pages) return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() =>
                          setPagination((p) => ({
                            ...p,
                            page: pageNum,
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                          pageNum === pagination.page
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() =>
                    setPagination((p) => ({
                      ...p,
                      page: p.page + 1,
                    }))
                  }
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Payment Details Modal ──────────────────────────── */}
      {selectedPayment && !showRejectModal && !showRequestInfoModal && (
        <Modal
          open
          onClose={closeDetails}
          title="Payment Details"
          size="xl"
        >
          {detailsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : paymentDetails ? (
            <div className="space-y-6">
              {/* Order / Payment Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Order Number</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {paymentDetails.order?.orderNumber || '-'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Amount</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(paymentDetails.order?.totalAmount)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Payment Method</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 capitalize">
                    {paymentDetails.order?.paymentMethod?.replace(/_/g, ' ') || '-'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Date Created</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatDate(paymentDetails.order?.createdAt)}
                  </p>
                </div>

                {/* Bank transfer specifics */}
                {paymentDetails.order?.paymentMethod === 'bank_transfer' &&
                  paymentDetails.paymentSubmission && (
                    <>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Bank Used</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {paymentDetails.paymentSubmission.bankUsed || '-'}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">
                          Reference Number
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {paymentDetails.paymentSubmission.referenceNumber || '-'}
                        </p>
                      </div>
                    </>
                  )}

                {/* Status */}
                <div className="p-4 bg-slate-50 rounded-2xl col-span-2">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                  <div className="mt-2">
                    {(() => {
                      const s = normalizeStatus(
                        paymentDetails.paymentSubmission?.verificationStatus ||
                          paymentDetails.order?.paymentStatus
                      );
                      const info = statusConfig[s] || { label: s, color: 'gray' };
                      return <Badge color={info.color}>{info.label}</Badge>;
                    })()}
                  </div>
                </div>
              </div>

              {/* Buyer Info */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  Buyer Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Name:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {paymentDetails.order?.buyerName || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Email:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {paymentDetails.order?.buyerEmail || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {paymentDetails.order?.buyerPhone || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Receipt */}
              {paymentDetails.paymentSubmission?.receiptFile && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                    Receipt
                  </h4>
                  <a
                    href={`/api/upload/file?path=${encodeURIComponent(
                      paymentDetails.paymentSubmission.receiptFile
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    View Receipt File →
                  </a>
                </div>
              )}

              {/* Actions */}
              {(() => {
                const s = normalizeStatus(
                  paymentDetails.paymentSubmission?.verificationStatus ||
                    paymentDetails.order?.paymentStatus
                );
                const isPending = s === 'pending' || s === 'pending_verification' || s === 'awaiting_payment';
                if (!isPending) return null;

                return (
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
                    <Button
                      onClick={() => {
                        if (paymentDetails.order?.paymentMethod === 'cash_at_entrance' || paymentDetails.order?.paymentMethod === 'cash_on_entrance') {
                          setSelectedPayment(paymentDetails.order);
                          setShowConfirmCashModal(true);
                        } else {
                          handleApprove(paymentDetails.paymentSubmission?._id || paymentDetails.order?._id);
                        }
                      }}
                      loading={
                        actionLoading ===
                        (paymentDetails.paymentSubmission?._id || paymentDetails.order?._id)
                      }
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      Approve Payment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRequestInfoModal(true)}
                    >
                      Request More Info
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectModal(true)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-6">No details available.</div>
          )}
        </Modal>
      )}

      {/* ─── Reject Modal ───────────────────────────────────── */}
      {showRejectModal && (
        <Modal open onClose={() => setShowRejectModal(false)} title="Reject Payment" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Please provide a reason for rejecting this payment. This will be shown to the buyer.
            </p>
            <textarea
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                loading={actionLoading === 'reject'}
                className="bg-red-600 hover:bg-red-700"
              >
                Reject Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Request Info Modal ─────────────────────────────── */}
      {showRequestInfoModal && (
        <Modal
          open
          onClose={() => setShowRequestInfoModal(false)}
          title="Request More Information"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Send a request to the buyer for additional information or documentation.
            </p>
            <textarea
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
              placeholder="What information do you need?"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRequestInfoModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleRequestInfo} loading={actionLoading === 'request_info'}>
                Send Request
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Confirm Cash Modal ───────────────────────────── */}
      {showConfirmCashModal && selectedPayment && (
        <Modal open onClose={() => setShowConfirmCashModal(false)} title="Confirm Cash Payment" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you have received the full payment of <span className="font-bold text-slate-900">{formatCurrency(selectedPayment.totalAmount || selectedPayment.amountPaid)}</span> for Order <span className="font-bold text-slate-900">{selectedPayment.orderNumber || selectedPayment.orderId?.orderNumber || '-'}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmCashModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleApprove(selectedPayment.submissionId || selectedPayment._id, true)}
                loading={actionLoading === (selectedPayment.submissionId || selectedPayment._id)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirm Payment Received
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default SubOrgPayments;
