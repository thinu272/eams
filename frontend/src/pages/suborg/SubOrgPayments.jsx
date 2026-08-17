import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  getSubOrgPayments,
  getSubOrgPaymentStatistics,
  getSubOrgPaymentDetails,
  approveSubOrgPayment,
  rejectSubOrgPayment,
  requestSubOrgPaymentInfo,
} from '../../api/subPaymentManagement';
import { getSubDashboard } from '../../api/sub';
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowLeftIcon,
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

const resolveCurrency = (...sources) => {
  for (const source of sources) {
    const currency =
      source?.event?.settings?.currency ||
      source?.event?.currency ||
      source?.order?.event?.settings?.currency ||
      source?.order?.eventId?.settings?.currency ||
      source?.order?.currency ||
      source?.orderId?.event?.settings?.currency ||
      source?.orderId?.eventId?.settings?.currency ||
      source?.orderId?.currency ||
      source?.settings?.currency ||
      source?.currency;
    if (currency) return currency;
  }
  return null;
};

const getCurrency = (...sources) =>
  resolveCurrency(...sources) ||
  localStorage.getItem('lastEventCurrency') ||
  'LKR';

const formatCurrency = (amount, currency = 'LKR') =>
  `${currency} ${Number(amount || 0).toLocaleString()}`;

const formatDate = (dateString) => {
  if (!dateString) return '—';
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
  return m || '—';
};

const normalizeStatus = (status) => {
  if (status === 'success' || status === 'paid') return 'approved';
  if (status === 'failed') return 'rejected';
  return status;
};

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1.5 text-xs text-slate-500 truncate">{subtitle}</p>
        )}
      </div>
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const SubOrgPayments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    pages: 1,
    total: 0,
  });

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [showConfirmCashModal, setShowConfirmCashModal] = useState(false);
  const [showConfirmApproveModal, setShowConfirmApproveModal] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(false);

  const [currentEventId, setCurrentEventId] = useState(() => {
    const id = localStorage.getItem('lastSelectedEventId');
    return id && id !== 'undefined' && id !== 'null' ? id : '';
  });
  const [eventCurrency, setEventCurrency] = useState(
    localStorage.getItem('lastEventCurrency') || 'LKR'
  );

  // Use refs to store current filter values for stable fetch functions
  const filterRefs = useRef({
    statusFilter,
    methodFilter,
    searchQuery,
    pagination,
    currentEventId,
  });

  // Update refs when values change
  useEffect(() => {
    filterRefs.current = {
      statusFilter,
      methodFilter,
      searchQuery,
      pagination,
      currentEventId,
    };
  }, [statusFilter, methodFilter, searchQuery, pagination, currentEventId]);

  const currency = getCurrency(
    statistics,
    paymentDetails,
    selectedPayment,
    payments[0],
    { currency: eventCurrency }
  );

  const rememberCurrency = useCallback((nextCurrency) => {
    if (!nextCurrency) return;
    setEventCurrency(nextCurrency);
    localStorage.setItem('lastEventCurrency', nextCurrency);
  }, []);

  const fetchPayments = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const { statusFilter, methodFilter, searchQuery, pagination, currentEventId } = filterRefs.current;
      
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
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (methodFilter && methodFilter !== 'all')
        params.paymentMethod = methodFilter;
      if (searchQuery) params.search = searchQuery;

      const res = await getSubOrgPayments(params);
      const data = res.data?.data || {};
      setPayments(data.payments || []);
      rememberCurrency(resolveCurrency(data, data.payments?.[0]));

      const backendPagination = data.pagination || {};
      const total = Number(data.total ?? backendPagination.total ?? 0);
      const limit = Number(backendPagination.limit || pagination.limit || 10);
      const pages = Number(data.pages || backendPagination.pages || Math.ceil(total / limit) || 1);

      setPagination((prev) => ({
        ...prev,
        page: data.page || Number(backendPagination.page) || prev.page,
        limit,
        total,
        pages,
      }));
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load payments');
      toast.error('Failed to load payments');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (isInitial = false) => {
    if (isInitial) setStatsLoading(true);
    try {
      const { currentEventId } = filterRefs.current;
      
      const cleanId =
        currentEventId &&
        currentEventId !== 'undefined' &&
        currentEventId !== 'null'
          ? currentEventId
          : undefined;

      const res = await getSubOrgPaymentStatistics({ eventId: cleanId });
      const nextStats = res.data?.data?.overview || {};
      setStatistics(nextStats);
      rememberCurrency(resolveCurrency(res.data?.data, nextStats));
      setLastUpdated(new Date());
    } catch (err) {
      setStatistics({});
    } finally {
      if (isInitial) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch
    let mounted = true;
    
    const loadInitialData = async () => {
      if (!currentEventId) return;
      
      setLoading(true);
      setStatsLoading(true);
      
      try {
        const { statusFilter, methodFilter, searchQuery, pagination } = filterRefs.current;
        
        const cleanId = currentEventId && currentEventId !== 'undefined' && currentEventId !== 'null' 
          ? currentEventId 
          : undefined;

        // Fetch payments and stats in parallel
        const [paymentsRes, statsRes] = await Promise.all([
          getSubOrgPayments({
            page: pagination.page,
            limit: pagination.limit,
            eventId: cleanId,
            status: statusFilter !== 'all' ? statusFilter : undefined,
            paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
            search: searchQuery || undefined,
          }),
          getSubOrgPaymentStatistics({ eventId: cleanId }),
        ]);

        if (!mounted) return;

        // Handle payments
        const paymentsData = paymentsRes.data?.data || {};
        setPayments(paymentsData.payments || []);

        const backendPagination = paymentsData.pagination || {};
        const total = Number(paymentsData.total ?? backendPagination.total ?? 0);
        const limit = Number(backendPagination.limit || pagination.limit || 10);
        const pages = Number(paymentsData.pages || backendPagination.pages || Math.ceil(total / limit) || 1);

        setPagination((prev) => ({
          ...prev,
          page: paymentsData.page || Number(backendPagination.page) || prev.page,
          limit,
          total,
          pages,
        }));

        // Handle statistics
        const statsData = statsRes.data?.data || {};
        setStatistics(statsData.overview || {});
        rememberCurrency(resolveCurrency(statsData, statsData.overview));

        setLastUpdated(new Date());
      } catch (err) {
        if (mounted) {
          setError('Failed to load payments');
          setStatistics({});
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setStatsLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, [currentEventId]);

  // Trigger data refresh when filters change (use ref to avoid stale closures)
  useEffect(() => {
    if (!currentEventId) return;

    const fetchFilteredData = async () => {
      setLoading(true);
      try {
        const cleanId = currentEventId && currentEventId !== 'undefined' && currentEventId !== 'null'
          ? currentEventId
          : undefined;

        const res = await getSubOrgPayments({
          page: pagination.page,
          limit: pagination.limit,
          eventId: cleanId,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          paymentMethod: methodFilter !== 'all' ? methodFilter : undefined,
          search: searchQuery || undefined,
        });

        const data = res.data?.data || {};
        setPayments(data.payments || []);

        const backendPagination = data.pagination || {};
        const total = Number(data.total ?? backendPagination.total ?? 0);
        const limit = Number(backendPagination.limit || pagination.limit || 10);
        const pages = Number(data.pages || backendPagination.pages || Math.ceil(total / limit) || 1);

        setPagination((prev) => ({
          ...prev,
          page: data.page || Number(backendPagination.page) || prev.page,
          limit,
          total,
          pages,
        }));
      } catch (err) {
        setError('Failed to load payments');
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchFilteredData, 300);
    return () => clearTimeout(timeoutId);
  }, [statusFilter, methodFilter, searchQuery, pagination.page, pagination.limit, currentEventId]);

  // Set up periodic refresh and currency sync
  useEffect(() => {
    if (!currentEventId) return;

    // Initial load of currency from dashboard
    const loadCurrency = async () => {
      try {
        const cleanId = currentEventId && currentEventId !== 'undefined' && currentEventId !== 'null'
          ? currentEventId
          : undefined;
        const response = await getSubDashboard({ eventId: cleanId });
        rememberCurrency(resolveCurrency(response.data?.data));
      } catch (e) {
        // Silent fail for currency
      }
    };

    loadCurrency();

    // Periodic refresh every 60 seconds
    const intervalId = setInterval(() => {
      fetchStats(false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [currentEventId]);

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined' || newId === 'null') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
    };
    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  const handleViewDetails = async (payment) => {
    setSelectedPayment(payment);
    setDetailsLoading(true);
    try {
      const res = await getSubOrgPaymentDetails(payment._id);
      const nextDetails = res.data?.data || null;
      setPaymentDetails(nextDetails);
      rememberCurrency(resolveCurrency(nextDetails, payment));
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
    setShowConfirmApproveModal(false);
    setActionMessage('');
  };

  const handleViewReceipt = async (submissionId) => {
    if (!submissionId) {
      toast.error('Receipt is not available for this payment.');
      return;
    }

    setViewingReceipt(true);
    try {
      const response = await api.get(`/bank-transfer/receipt/${submissionId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: response.headers?.['content-type'] || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const opened = window.open(url, '_blank', 'noopener,noreferrer');

      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }

      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to open receipt');
    } finally {
      setViewingReceipt(false);
    }
  };

  const openApproveConfirm = (payment) => {
    setSelectedPayment(payment);
    setShowConfirmApproveModal(true);
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await approveSubOrgPayment(id);
      toast.success('Payment approved successfully!');
      closeDetails();
      await Promise.all([fetchPayments(false), fetchStats(false)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!actionMessage.trim())
      return toast.error('Please provide a reason for rejection');
    setActionLoading('reject');
    try {
      await rejectSubOrgPayment(selectedPayment._id, {
        rejectionReason: actionMessage,
      });
      toast.success('Payment rejected');
      closeDetails();
      await Promise.all([fetchPayments(false), fetchStats(false)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!actionMessage.trim()) return toast.error('Please provide a message');
    setActionLoading('request_info');
    try {
      await requestSubOrgPaymentInfo(selectedPayment._id, {
        message: actionMessage,
      });
      toast.success('Information request sent to buyer');
      closeDetails();
      await Promise.all([fetchPayments(false), fetchStats(false)]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    to="/suborg/dashboard"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-600 hover:text-blue-700"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5" />
                    Dashboard
                  </Link>
                  <span className="text-slate-300">·</span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Payment Management
                  </p>
                </div>
                <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  Payments
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Review, approve and manage payments for your assigned event
                  scope.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Auto-refresh indicator */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            Auto-updating payment data
          </span>
          {lastUpdated && <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>}
        </div>

        {/* Metrics — 4 then 4 */}
        {!statsLoading && Object.keys(statistics || {}).length === 0 ? (
          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <ExclamationTriangleIcon className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold text-slate-800">
                No payment statistics available
              </p>
              <p className="mt-1 text-sm text-slate-500">
                You may not have any ticket categories assigned to you. Please contact the event organizer to assign categories.
              </p>
            </div>
          </Card>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total Assigned"
                value={statsLoading ? '—' : statistics?.totalPayments || 0}
                subtitle="Transactions"
                icon={BanknotesIcon}
              />
              <MetricCard
                title="Total Paid"
                value={
                  statsLoading
                    ? '—'
                    : formatCurrency(statistics?.approvedAmount || 0, currency)
                }
                subtitle="Confirmed revenue"
                icon={CheckCircleIcon}
              />
              <MetricCard
                title="Pending Bank"
                value={statsLoading ? '—' : statistics?.pendingBankTransfers || 0}
                subtitle="Awaiting review"
                icon={ClockIcon}
              />
              <MetricCard
                title="Approved Bank"
                value={statsLoading ? '—' : statistics?.approvedBankTransfers || 0}
                subtitle="Verified transfers"
                icon={CheckCircleIcon}
              />
            </section>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Cash Reservations"
                value={statsLoading ? '—' : statistics?.cashReservations || 0}
                subtitle="At entrance"
                icon={ClockIcon}
              />
              <MetricCard
                title="Cash Collected"
                value={
                  statsLoading
                    ? '—'
                    : formatCurrency(statistics?.cashCollected || 0, currency)
                }
                subtitle="Confirmed cash"
                icon={BanknotesIcon}
              />
              <MetricCard
                title="Awaiting Info"
                value={statsLoading ? '—' : statistics?.needsInfoPayments || 0}
                subtitle="Buyer response needed"
                icon={ExclamationTriangleIcon}
              />
              <MetricCard
                title="Rejected"
                value={statsLoading ? '—' : statistics?.rejectedPayments || 0}
                subtitle="Declined payments"
                icon={XCircleIcon}
              />
            </section>
          </>
        )}

        {/* Filters */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
            {[
              { key: 'all', label: 'All Methods' },
              { key: 'bank_transfer', label: 'Bank Transfer' },
              { key: 'cash_at_entrance', label: 'Cash at Entrance' },
              { key: 'card', label: 'Card' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMethodFilter(key);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
                className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                  methodFilter === key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Search by order number, email…"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
        </Card>

        {/* Table */}
        <Card
          className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
          padding={false}
        >
          <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Payment Submissions
            </h2>
            <p className="text-sm text-slate-500">
              {pagination.total} payment
              {pagination.total !== 1 ? 's' : ''} found
            </p>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingSkeleton />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-rose-600">{error}</div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <BanknotesIcon className="h-7 w-7" />
              </div>
              <p className="text-base font-semibold text-slate-800">
                No payments found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <thead>
                  <Tr>
                    <Th>Order #</Th>
                    <Th>Method</Th>
                    <Th>Payer</Th>
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
                            {payment.orderNumber ||
                              payment.orderId?.orderNumber ||
                              '—'}
                          </span>
                        </Td>
                        <Td>
                          <p className="text-sm font-medium text-slate-900">
                            {formatMethod(payment.paymentMethod)}
                          </p>
                          {(payment.gatewayUsed || payment.bankUsed) && (
                            <p className="text-xs text-slate-500 uppercase">
                              {payment.gatewayUsed || payment.bankUsed}
                            </p>
                          )}
                        </Td>
                        <Td>
                          <p className="text-sm font-medium text-slate-900">
                            {payment.buyer?.name || payment.buyerName || '—'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {payment.buyer?.email || payment.buyerEmail || '—'}
                          </p>
                        </Td>
                        <Td>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(
                              payment.totalAmount || payment.amountPaid,
                              getCurrency(payment, statistics)
                            )}
                          </span>
                        </Td>
                        <Td>
                          <p className="text-sm text-slate-600">
                            {formatDate(
                              payment.submittedAt || payment.createdAt
                            )}
                          </p>
                        </Td>
                        <Td>
                          <Badge color={info.color}>{info.label}</Badge>
                        </Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(payment)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              title="View details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            {payment.paymentMethod === 'bank_transfer' &&
                              (displayStatus === 'pending' ||
                                displayStatus === 'pending_verification') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openApproveConfirm(payment)}
                                    disabled={
                                      actionLoading ===
                                      (payment.submissionId || payment._id)
                                    }
                                    className="rounded-lg p-1.5 text-emerald-500 hover:bg-emerald-50"
                                    title="Approve"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPayment(payment);
                                      setShowRejectModal(true);
                                    }}
                                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50"
                                    title="Reject"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            {(payment.paymentMethod === 'cash_at_entrance' ||
                              payment.paymentMethod === 'cash_on_entrance') &&
                              (displayStatus === 'pending' ||
                                displayStatus === 'awaiting_payment') && (
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
                                  onClick={() => {
                                    setSelectedPayment(payment);
                                    setShowConfirmCashModal(true);
                                  }}
                                  disabled={
                                    actionLoading ===
                                    (payment.submissionId || payment._id)
                                  }
                                >
                                  Confirm
                                </Button>
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

          {pagination.pages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.pages} ·{' '}
                {pagination.total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page - 1 }))
                  }
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() =>
                    setPagination((p) => ({ ...p, page: p.page + 1 }))
                  }
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Details modal */}
      {selectedPayment &&
        !showRejectModal &&
        !showRequestInfoModal &&
        !showConfirmCashModal &&
        !showConfirmApproveModal && (
          <Modal open onClose={closeDetails} title="Payment Details" size="xl">
            {detailsLoading ? (
              <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              </div>
            ) : paymentDetails ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: 'Order Number',
                      value: paymentDetails.order?.orderNumber || '—',
                    },
                    {
                      label: 'Amount',
                      value: formatCurrency(
                        paymentDetails.order?.totalAmount,
                        getCurrency(paymentDetails, selectedPayment, statistics)
                      ),
                    },
                    {
                      label: 'Payment Method',
                      value:
                        paymentDetails.order?.paymentMethod?.replace(/_/g, ' ') ||
                        '—',
                    },
                    {
                      label: 'Date Created',
                      value: formatDate(paymentDetails.order?.createdAt),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                        {item.value}
                      </p>
                    </div>
                  ))}
                  {paymentDetails.order?.paymentMethod === 'bank_transfer' &&
                    paymentDetails.paymentSubmission && (
                      <>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Bank Used
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {paymentDetails.paymentSubmission.bankUsed || '—'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Reference
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {paymentDetails.paymentSubmission.referenceNumber ||
                              '—'}
                          </p>
                        </div>
                      </>
                    )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Buyer
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-slate-500">Name:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {paymentDetails.order?.buyerName || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500">Email:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {paymentDetails.order?.buyerEmail || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500">Phone:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {paymentDetails.order?.buyerPhone || '—'}
                      </span>
                    </p>
                  </div>
                </div>

                {paymentDetails.paymentSubmission?.receiptFile && (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Receipt
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        handleViewReceipt(
                          selectedPayment?.submissionId ||
                            selectedPayment?._id ||
                            paymentDetails.paymentSubmission?._id
                        )
                      }
                      disabled={viewingReceipt}
                      className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                      View receipt →
                    </button>
                  </div>
                )}

                {(() => {
                  const s = normalizeStatus(
                    paymentDetails.paymentSubmission?.verificationStatus ||
                      paymentDetails.order?.paymentStatus
                  );
                  const isPending =
                    s === 'pending' ||
                    s === 'pending_verification' ||
                    s === 'awaiting_payment';
                  if (!isPending) return null;
                  return (
                    <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                      <Button
                        className="bg-blue-600 hover:bg-blue-500"
                        onClick={() => {
                          if (
                            paymentDetails.order?.paymentMethod ===
                              'cash_at_entrance' ||
                            paymentDetails.order?.paymentMethod ===
                              'cash_on_entrance'
                          ) {
                            setSelectedPayment(paymentDetails.order);
                            setShowConfirmCashModal(true);
                          } else {
                            openApproveConfirm({
                              ...selectedPayment,
                              ...paymentDetails.order,
                              submissionId:
                                paymentDetails.paymentSubmission?._id ||
                                selectedPayment.submissionId ||
                                selectedPayment._id,
                              totalAmount: paymentDetails.order?.totalAmount,
                              orderNumber: paymentDetails.order?.orderNumber,
                            });
                          }
                        }}
                      >
                        <CheckCircleIcon className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => setShowRequestInfoModal(true)}
                      >
                        Request info
                      </Button>
                      <Button
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => setShowRejectModal(true)}
                      >
                        <XCircleIcon className="mr-1.5 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                No details available.
              </p>
            )}
          </Modal>
        )}

      {/* Reject */}
      <Modal
        open={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          if (!paymentDetails) {
            closeDetails();
          }
        }}
        title="Reject Payment"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Provide a reason for rejecting this payment. The buyer will see
            this message.
          </p>
          <textarea
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder="Rejection reason…"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            rows={4}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-rose-600 hover:bg-rose-500"
              onClick={handleReject}
              disabled={actionLoading === 'reject'}
            >
              Reject payment
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowRejectModal(false);
                if (!paymentDetails) {
                  closeDetails();
                }
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request info */}
      <Modal
        open={showRequestInfoModal}
        onClose={() => {
          setShowRequestInfoModal(false);
          if (!paymentDetails) {
            closeDetails();
          }
        }}
        title="Request More Information"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Ask the buyer for additional information or documentation.
          </p>
          <textarea
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder="What information do you need?"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            rows={4}
          />
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-500"
              onClick={handleRequestInfo}
              disabled={actionLoading === 'request_info'}
            >
              Send request
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowRequestInfoModal(false);
                if (!paymentDetails) {
                  closeDetails();
                }
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm cash */}
      <Modal
        open={!!showConfirmCashModal && !!selectedPayment}
        onClose={() => {
          setShowConfirmCashModal(false);
          if (!paymentDetails) {
            closeDetails();
          }
        }}
        title="Confirm Cash Payment"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Confirm you received{' '}
              <span className="font-semibold text-slate-900">
                {formatCurrency(
                  selectedPayment.totalAmount || selectedPayment.amountPaid,
                  getCurrency(selectedPayment, statistics)
                )}
              </span>{' '}
              for order{' '}
              <span className="font-semibold text-slate-900">
                {selectedPayment.orderNumber ||
                  selectedPayment.orderId?.orderNumber ||
                  '—'}
              </span>
              ?
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500"
                onClick={() =>
                  handleApprove(
                    selectedPayment.submissionId || selectedPayment._id
                  )
                }
                disabled={
                  actionLoading ===
                  (selectedPayment.submissionId || selectedPayment._id)
                }
              >
                {actionLoading ===
                (selectedPayment.submissionId || selectedPayment._id)
                  ? 'Confirming…'
                  : 'Confirm received'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmCashModal(false);
                  if (!paymentDetails) {
                    closeDetails();
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Bank Transfer Approve */}
      <Modal
        open={!!showConfirmApproveModal && !!selectedPayment}
        onClose={() => {
          setShowConfirmApproveModal(false);
          if (!paymentDetails) {
            closeDetails();
          }
        }}
        title="Confirm Payment Approval"
        size="md"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Approve this payment? This will confirm the order and activate
              tickets.
            </p>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 text-sm">
              <p>
                <span className="text-slate-500">Order:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {selectedPayment.orderNumber ||
                    selectedPayment.orderId?.orderNumber ||
                    '—'}
                </span>
              </p>
              <p className="mt-1">
                <span className="text-slate-500">Amount:</span>{' '}
                <span className="font-semibold text-slate-900">
                  {formatCurrency(
                    selectedPayment.totalAmount || selectedPayment.amountPaid,
                    getCurrency(selectedPayment, statistics)
                  )}
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                onClick={() =>
                  handleApprove(
                    selectedPayment.submissionId || selectedPayment._id
                  )
                }
                disabled={
                  actionLoading ===
                  (selectedPayment.submissionId || selectedPayment._id)
                }
              >
                {actionLoading ===
                (selectedPayment.submissionId || selectedPayment._id)
                  ? 'Approving…'
                  : 'Confirm Approve'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowConfirmApproveModal(false);
                  if (!paymentDetails) {
                    closeDetails();
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgPayments;