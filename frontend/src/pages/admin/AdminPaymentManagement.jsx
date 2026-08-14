import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAllPayments,
  getPaymentStatistics,
  getPaymentDetails,
  approvePayment,
  rejectPayment,
  requestPaymentInfo,
  exportPayments,
} from '../../api/adminPaymentManagement';
import { getAllEventsAdmin } from '../../api/events';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  CreditCardIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  pending: { label: 'Pending', variant: 'amber' },
  pending_verification: { label: 'Pending Verification', variant: 'amber' },
  verified: { label: 'Verified', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
  approved: { label: 'Approved', variant: 'green' },
  needs_info: { label: 'Needs Info', variant: 'blue' },
  success: { label: 'Approved', variant: 'green' },
  paid: { label: 'Approved', variant: 'green' },
  failed: { label: 'Rejected', variant: 'red' },
};

const formatCurrency = (amount, currency = 'LKR') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);

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
  if (m === 'card') return 'Credit/Debit Card';
  if (m === 'bank_transfer') return 'Bank Transfer';
  if (m === 'cash_at_entrance') return 'Cash at Venue';
  if (m === 'cash_on_entrance') return 'Cash on Entrance';
  return m || '-';
};

// Matches the MetricCard style used in AdminDashboard overview / reports
const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border-slate-200 bg-gradient-to-br from-white to-slate-50/80 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

const AdminPaymentManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [statistics, setStatistics] = useState({
    overview: {
      totalPayments: 0,
      pendingPayments: 0,
      approvedPayments: 0,
      rejectedPayments: 0,
      needsInfoPayments: 0,
      totalAmount: 0,
      approvedAmount: 0,
      pendingAmount: 0,
    },
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Always read filters from URL so they stay in sync
  const eventFilter = searchParams.get('eventId') || '';
  const statusFilter = searchParams.get('status') || '';
  const paymentMethodFilter = searchParams.get('paymentMethod') || 'all';
  const searchQuery = searchParams.get('search') || '';
  const currentPage = searchParams.get('page') || '1';

  const updateQuery = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        status: statusFilter || undefined,
        eventId: eventFilter || undefined,
        search: searchQuery || undefined,
        paymentMethod: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
      };
      const response = await getAllPayments(params);
      const data = response.data?.data || {};
      setPayments(data.payments || []);
      setPagination({
        page: data.currentPage || 1,
        pages: data.pages || 1,
        total: data.total || 0,
      });
    } catch (err) {
      setError('Failed to load payments');
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [currentPage, eventFilter, statusFilter, paymentMethodFilter, searchQuery]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await getPaymentStatistics({
        eventId: eventFilter || undefined,
      });
      const data = response.data?.data || {};
      setStatistics({
        overview: {
          totalPayments: data.overview?.totalPayments || 0,
          pendingPayments: data.overview?.pendingPayments || 0,
          approvedPayments: data.overview?.approvedPayments || 0,
          rejectedPayments: data.overview?.rejectedPayments || 0,
          needsInfoPayments: data.overview?.needsInfoPayments || 0,
          totalAmount: data.overview?.totalAmount || 0,
          approvedAmount: data.overview?.approvedAmount || 0,
          pendingAmount: data.overview?.pendingAmount || 0,
        },
      });
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  }, [eventFilter]);

  const fetchEvents = async () => {
    try {
      const response = await getAllEventsAdmin({ limit: 200 });
      // Try every common shape used in this codebase
      const payload = response?.data?.data ?? response?.data ?? response ?? {};

      let list = [];
      if (Array.isArray(payload)) {
        list = payload;
      } else if (Array.isArray(payload.events)) {
        list = payload.events;
      } else if (Array.isArray(payload.rows)) {
        list = payload.rows;
      } else if (Array.isArray(payload.data)) {
        list = payload.data;
      }

      setEvents(list);
    } catch (err) {
      console.error('Failed to load events:', err);
      toast.error('Failed to load events for filter');
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchStatistics();
  }, [fetchPayments, fetchStatistics]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailsLoading(true);
    setShowRejectModal(false);
    setShowRequestInfoModal(false);
    try {
      const response = await getPaymentDetails(payment._id);
      setPaymentDetails(response.data?.data || {});
    } catch (err) {
      toast.error('Failed to load payment details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    setActionLoading(paymentId);
    try {
      await approvePayment(paymentId);
      toast.success('Payment approved successfully');
      fetchPayments();
      fetchStatistics();
      setSelectedPayment(null);
      setPaymentDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    const targetId = selectedPayment?.submissionId || paymentDetails?.paymentSubmission?._id;
    if (!targetId) {
      toast.error('Payment submission ID not found');
      return;
    }
    setActionLoading('reject');
    try {
      await rejectPayment(targetId, { rejectionReason: rejectReason });
      toast.success('Payment rejected');
      setShowRejectModal(false);
      setRejectReason('');
      fetchPayments();
      fetchStatistics();
      setSelectedPayment(null);
      setPaymentDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!infoMessage.trim()) {
      toast.error('Please provide a message requesting more information');
      return;
    }
    const targetId = selectedPayment?.submissionId || paymentDetails?.paymentSubmission?._id;
    if (!targetId) {
      toast.error('Payment submission ID not found');
      return;
    }
    setActionLoading('request_info');
    try {
      await requestPaymentInfo(targetId, { message: infoMessage });
      toast.success('Information request sent to buyer');
      setShowRequestInfoModal(false);
      setInfoMessage('');
      fetchPayments();
      fetchStatistics();
      setSelectedPayment(null);
      setPaymentDetails(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      const response = await exportPayments({ eventId: eventFilter || undefined });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Payments exported successfully');
    } catch (err) {
      toast.error('Failed to export payments');
    }
  };

  const getPageNumbers = () => {
    const nums = [];
    const maxVisible = 5;
    const { page, pages } = pagination;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(pages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  };

  const normalizeStatus = (status) => {
    if (status === 'success' || status === 'paid') return 'approved';
    if (status === 'failed') return 'rejected';
    return status;
  };

  return (
    <div className="space-y-6">
      {/* Top actions only – subtitle is already shown by AdminDashboard */}
      <div className="flex justify-end">
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white">
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Statistics – same MetricCard style as Overview / Reports */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Payments"
          value={statistics.overview.totalPayments}
          subtitle={`${formatCurrency(statistics.overview.totalAmount)} total`}
          icon={BanknotesIcon}
        />
        <MetricCard
          title="Pending"
          value={statistics.overview.pendingPayments}
          subtitle={formatCurrency(statistics.overview.pendingAmount)}
          icon={CreditCardIcon}
        />
        <MetricCard
          title="Approved"
          value={statistics.overview.approvedPayments}
          subtitle={formatCurrency(statistics.overview.approvedAmount)}
          icon={CheckCircleIcon}
        />
        <MetricCard
          title="Needs Info"
          value={statistics.overview.needsInfoPayments}
          subtitle="Awaiting buyer response"
          icon={ShieldCheckIcon}
        />
      </div>

      {/* Filters – same Card + grid style as SectionFilters */}
      <Card className="rounded-[28px] border-slate-200">
        {/* Method tabs */}
        <div className="flex space-x-2 border-b border-slate-100 pb-4 mb-4 overflow-x-auto">
          {[
            { key: 'all', label: 'All Payments' },
            { key: 'card', label: 'Credit/Debit Card' },
            { key: 'bank_transfer', label: 'Bank Transfer' },
            { key: 'cash_at_entrance', label: 'Cash at Venue' },
          ].map(({ key, label }) => {
            const active = paymentMethodFilter === key;
            return (
              <button
                key={key}
                onClick={() => updateQuery('paymentMethod', key === 'all' ? null : key)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search by order number, email..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            defaultValue={searchQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateQuery('search', e.target.value || null);
            }}
          />

          {/* Event selector – value comes from URL, change updates URL */}
          <select
            value={eventFilter}
            onChange={(e) => updateQuery('eventId', e.target.value || null)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event._id} value={event._id}>
                {event.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => updateQuery('status', e.target.value || null)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="needs_info">Needs Info</option>
            <option value="verified">Verified</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Payments table */}
      <Card className="rounded-[28px] border-slate-200" padding={false}>
        <CardHeader
          title="Payment Submissions"
          subtitle={`${pagination.total} payment${pagination.total !== 1 ? 's' : ''} found`}
          className="px-6 pt-6"
        />

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
            <Table className="min-w-[900px]">
              <thead>
                <Tr>
                  <Th>Order #</Th>
                  <Th>Event</Th>
                  <Th>Method / Gateway</Th>
                  <Th>Payer Details</Th>
                  <Th>Amount</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const displayStatus = normalizeStatus(payment.verificationStatus);
                  const statusInfo = statusConfig[displayStatus] || {
                    label: displayStatus || 'Unknown',
                    variant: 'gray',
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
                          <p className="text-sm font-medium text-slate-900">{payment.event?.name || '-'}</p>
                          {payment.event?.startDate && (
                            <p className="text-xs text-slate-500">
                              {new Date(payment.event.startDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
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
                          <p className="text-sm font-medium text-slate-900">{payment.buyer?.name || '-'}</p>
                          <p className="text-xs text-slate-500">{payment.buyer?.email || '-'}</p>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(payment.totalAmount || payment.amountPaid)}
                        </span>
                      </Td>
                      <Td>
                        <p className="text-sm text-slate-900">{formatDate(payment.submittedAt)}</p>
                      </Td>
                      <Td>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => handleViewDetails(payment)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {/* Pagination – same style as AdminDashboard */}
        {payments.length > 0 && (
          <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => updateQuery('page', pagination.page - 1)}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Prev
              </Button>
              <div className="flex items-center gap-1 mx-1">
                {getPageNumbers().map((n) => (
                  <button
                    key={n}
                    onClick={() => updateQuery('page', n)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                      pagination.page === n
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.pages}
                onClick={() => updateQuery('page', pagination.page + 1)}
                className="h-8 rounded-lg px-3 text-xs"
              >
                Next
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Page</span>
              <span className="text-sm font-bold text-slate-900">{pagination.page}</span>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">of</span>
              <span className="text-sm font-bold text-slate-900">{pagination.pages}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Payment Details Modal */}
      {selectedPayment && (
        <Modal
          open
          onClose={() => {
            setSelectedPayment(null);
            setPaymentDetails(null);
          }}
          title="Payment Details"
          size="xl"
        >
          {detailsLoading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : paymentDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Order Number</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {paymentDetails.order?.orderNumber || '-'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Amount Paid</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(paymentDetails.order?.totalAmount)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Payment Method</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatMethod(paymentDetails.order?.paymentMethod)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Date Created</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatDate(paymentDetails.order?.createdAt)}
                  </p>
                </div>

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
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Reference Number</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {paymentDetails.paymentSubmission.referenceNumber || '-'}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Transfer Date</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatDate(paymentDetails.paymentSubmission.transferDate)}
                        </p>
                      </div>
                    </>
                  )}

                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                  <div className="mt-2">
                    {(() => {
                      const raw =
                        paymentDetails.paymentSubmission?.verificationStatus ||
                        paymentDetails.order?.paymentStatus ||
                        'pending';
                      const status = normalizeStatus(raw);
                      const info = statusConfig[status] || { label: status, variant: 'gray' };
                      return <Badge variant={info.variant}>{info.label}</Badge>;
                    })()}
                  </div>
                </div>
              </div>

              {paymentDetails.order?.paymentMethod === 'bank_transfer' &&
                paymentDetails.paymentSubmission &&
                ['pending', 'pending_verification', 'needs_info'].includes(
                  paymentDetails.paymentSubmission.verificationStatus
                ) && (
                  <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
                    <Button
                      onClick={() => handleApprove(paymentDetails.paymentSubmission._id)}
                      loading={actionLoading === paymentDetails.paymentSubmission._id}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      Approve Payment
                    </Button>
                    <Button variant="outline" onClick={() => setShowRequestInfoModal(true)}>
                      Request More Info
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectModal(true)}
                      className="text-rose-600 border-rose-100 hover:bg-rose-50"
                    >
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Reject Payment
                    </Button>
                  </div>
                )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">Failed to load details</div>
          )}
        </Modal>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <Modal open onClose={() => setShowRejectModal(false)} title="Reject Payment" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Please provide a reason for rejecting this payment. This will be shown to the buyer.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
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
                className="bg-rose-600 hover:bg-rose-500"
              >
                Reject Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Request Info Modal */}
      {showRequestInfoModal && (
        <Modal open onClose={() => setShowRequestInfoModal(false)} title="Request More Information" size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Send a request to the buyer for additional information or documentation.
            </p>
            <textarea
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
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
    </div>
  );
};

export default AdminPaymentManagement;