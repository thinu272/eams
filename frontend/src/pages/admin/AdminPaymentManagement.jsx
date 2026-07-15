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
  exportPayments 
} from '../../api/adminPaymentManagement';
import { getAllEventsAdmin } from '../../api/events';
import DashboardLayout from '../../components/layout/DashboardLayout';
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
  FunnelIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const statusConfig = {
  pending: { label: 'Pending', variant: 'amber' },
  pending_verification: { label: 'Pending Verification', variant: 'amber' },
  verified: { label: 'Verified', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
  approved: { label: 'Approved', variant: 'green' },
  needs_info: { label: 'Needs Info', variant: 'blue' },
};

const formatCurrency = (amount, currency = 'LKR') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

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
      pendingAmount: 0
    }
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
  const [eventFilter, setEventFilter] = useState(searchParams.get('eventId') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: searchParams.get('page') || 1,
        limit: 20,
        status: statusFilter || undefined,
        eventId: eventFilter || undefined,
        search: searchParams.get('search') || undefined
      };
      const response = await getAllPayments(params);
      const data = response.data?.data || {};
      setPayments(data.payments || []);
      setPagination({
        page: data.pagination?.page || 1,
        pages: data.pagination?.pages || 1,
        total: data.pagination?.total || 0
      });
    } catch (err) {
      setError('Failed to load payments');
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [searchParams, eventFilter, statusFilter]);

  const fetchStatistics = async () => {
    try {
      const response = await getPaymentStatistics({ eventId: eventFilter || undefined });
      const data = response.data?.data || {};
      setStatistics({
        overview: {
          totalPayments: data.totalPayments || 0,
          pendingPayments: data.pendingPayments || 0,
          approvedPayments: data.approvedPayments || 0,
          rejectedPayments: data.rejectedPayments || 0,
          needsInfoPayments: data.needsInfoPayments || 0,
          totalAmount: data.totalAmount || 0,
          approvedAmount: data.approvedAmount || 0,
          pendingAmount: data.pendingAmount || 0
        }
      });
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await getAllEventsAdmin({ status: 'all', limit: 100 });
      const data = response.data?.data || {};
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchStatistics();
    fetchEvents();
  }, [fetchPayments]);

  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailsLoading(true);
    setShowRejectModal(false);
    setShowRequestInfoModal(false);
    try {
      const response = await getPaymentDetails(payment._id);
      const data = response.data?.data || {};
      setPaymentDetails(data.payment);
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
    setActionLoading('reject');
    try {
      await rejectPayment(selectedPayment._id, rejectReason);
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
    setActionLoading('request_info');
    try {
      await requestPaymentInfo(selectedPayment._id, infoMessage);
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

  const updateQuery = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const MetricCard = ({ title, value, subtitle, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      amber: 'bg-amber-50 text-amber-600',
      red: 'bg-red-50 text-red-600',
    };
    
    return (
      <Card className="rounded-[28px] border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{title}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
            <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
          </div>
          <div className={`rounded-2xl p-3 ${colorClasses[color]}`}>
            <BanknotesIcon className="h-6 w-6" />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Payments</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Bank Transfer Management</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review and manage bank transfer payments submitted by buyers. Verify receipts and approve or reject payments.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExport}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard 
            title="Total Payments" 
            value={statistics.overview.totalPayments} 
            subtitle={`${formatCurrency(statistics.overview.totalAmount)} total`}
            color="blue"
          />
          <MetricCard 
            title="Pending" 
            value={statistics.overview.pendingPayments} 
            subtitle={formatCurrency(statistics.overview.pendingAmount)}
            color="amber"
          />
          <MetricCard 
            title="Approved" 
            value={statistics.overview.approvedPayments} 
            subtitle={formatCurrency(statistics.overview.approvedAmount)}
            color="green"
          />
          <MetricCard 
            title="Needs Info" 
            value={statistics.overview.needsInfoPayments} 
            subtitle="Awaiting buyer response"
            color="red"
          />
        </div>

        {/* Filters */}
        <Card className="rounded-[28px] border-slate-200">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by order number, email..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                defaultValue={searchParams.get('search') || ''}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateQuery('search', e.target.value);
                }}
              />
            </div>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
            >
              <option value="">All Events</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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

        {/* Payments Table */}
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
                    <Th>Payer Details</Th>
                    <Th>Bank</Th>
                    <Th>Amount</Th>
                    <Th>Date</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const statusInfo = statusConfig[payment.verificationStatus] || { label: payment.verificationStatus, variant: 'gray' };
                    return (
                      <Tr key={payment._id}>
                        <Td>
                          <span className="font-mono text-sm font-medium text-slate-900">
                            {payment.orderNumber || payment.orderId?.orderNumber || '-'}
                          </span>
                        </Td>
                        <Td>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{payment.eventName || '-'}</p>
                            {payment.orderId?.eventId && (
                              <p className="text-xs text-slate-500">
                                {new Date(payment.orderId.eventId.startDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{payment.payerName || '-'}</p>
                            <p className="text-xs text-slate-500">{payment.payerEmail || payment.payerPhone || '-'}</p>
                          </div>
                        </Td>
                        <Td>
                          <div>
                            <p className="text-sm text-slate-900">{payment.bankUsed || '-'}</p>
                            <p className="text-xs text-slate-500">{payment.referenceNumber || '-'}</p>
                          </div>
                        </Td>
                        <Td>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(payment.amountPaid)}
                          </span>
                        </Td>
                        <Td>
                          <div>
                            <p className="text-sm text-slate-900">{formatDate(payment.transferDate)}</p>
                            <p className="text-xs text-slate-500">{formatDate(payment.submittedAt)}</p>
                          </div>
                        </Td>
                        <Td>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
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
                            {(payment.verificationStatus === 'pending' || payment.verificationStatus === 'pending_verification') && (
                              <>
                                <button
                                  onClick={() => handleApprove(payment._id)}
                                  disabled={actionLoading === payment._id}
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
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
              <div className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={pagination.page <= 1}
                  onClick={() => updateQuery('page', pagination.page - 1)}
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Previous
                </Button>
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
            </div>
          )}
        </Card>
      </div>

      {/* Payment Details Modal */}
      {selectedPayment && paymentDetails && (
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
          ) : (
            <div className="space-y-6">
              {/* Payment Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Order Number</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {paymentDetails.orderNumber || paymentDetails.orderId?.orderNumber || '-'}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Amount Paid</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(paymentDetails.amountPaid)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Bank Used</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{paymentDetails.bankUsed || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Reference Number</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{paymentDetails.referenceNumber || '-'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Transfer Date</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{formatDate(paymentDetails.transferDate)}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                  <p className="mt-1">
                    <Badge variant={statusConfig[paymentDetails.verificationStatus]?.variant || 'gray'}>
                      {statusConfig[paymentDetails.verificationStatus]?.label || paymentDetails.verificationStatus}
                    </Badge>
                  </p>
                </div>
              </div>

              {/* Payer Details */}
              <div className="p-4 bg-slate-50 rounded-2xl">
                <h4 className="font-semibold text-slate-900 mb-3">Payer Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Name:</span>
                    <span className="ml-2 font-medium text-slate-900">{paymentDetails.payerName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Email:</span>
                    <span className="ml-2 font-medium text-slate-900">{paymentDetails.payerEmail || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Phone:</span>
                    <span className="ml-2 font-medium text-slate-900">{paymentDetails.payerPhone || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Event Info */}
              {paymentDetails.orderId?.eventId && (
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <h4 className="font-semibold text-slate-900 mb-3">Event Details</h4>
                  <p className="text-sm text-slate-900">{paymentDetails.orderId.eventId.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(paymentDetails.orderId.eventId.startDate)}</p>
                </div>
              )}

              {/* Receipt Image */}
              {paymentDetails.receiptFile && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Payment Receipt</h4>
                  <img 
                    src={paymentDetails.receiptFile} 
                    alt="Payment Receipt" 
                    className="max-w-full rounded-xl border border-slate-200"
                  />
                </div>
              )}

              {/* Actions */}
              {(paymentDetails.verificationStatus === 'pending' || paymentDetails.verificationStatus === 'pending_verification') && (
                <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
                  <Button 
                    onClick={() => handleApprove(paymentDetails._id)}
                    loading={actionLoading === paymentDetails._id}
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
                    Reject Payment
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <Modal
          open
          onClose={() => setShowRejectModal(false)}
          title="Reject Payment"
          size="md"
        >
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
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancel</Button>
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

      {/* Request Info Modal */}
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
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
              placeholder="What information do you need?"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRequestInfoModal(false)}>Cancel</Button>
              <Button 
                onClick={handleRequestInfo}
                loading={actionLoading === 'request_info'}
              >
                Send Request
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default AdminPaymentManagement;