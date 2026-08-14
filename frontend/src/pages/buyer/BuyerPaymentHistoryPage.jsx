import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getBuyerPaymentHistory } from '../../api/buyerPaymentHistory';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { format } from 'date-fns';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  BanknotesIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';

const statusConfig = {
  paid: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  success: {
    label: 'Success',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  pending_verification: {
    label: 'Pending Verification',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  failed: {
    label: 'Failed',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  expired: {
    label: 'Expired',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  },
};

const gatewayLabels = {
  stripe: 'Stripe',
  payhere: 'PayHere',
  null: 'N/A',
};

const methodLabels = {
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cash_on_entrance: 'Cash (Entrance)',
  cash_at_entrance: 'Cash (Entrance)',
};

const methodIcon = (method) => {
  if (method === 'card') return CreditCardIcon;
  if (method === 'bank_transfer') return BanknotesIcon;
  if (['cash_on_entrance', 'cash_at_entrance'].includes(method)) return TicketIcon;
  return CreditCardIcon;
};

const BuyerPaymentHistoryPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const limit = 10;

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit };
      if (filterStatus) params.status = filterStatus;

      const response = await getBuyerPaymentHistory(params);
      if (response.success) {
        setPayments(response.data || []);
        setTotalPages(response.pagination?.pages || 1);
      }
    } catch {
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleFilterChange = (e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  };

  return (
    <BuyerLayout>
      <div className="space-y-5 sm:space-y-6 pb-16 sm:pb-20">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-500/15" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Buyer Workspace
                  </p>
                </div>
                <h1 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
                  Payment History
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Track your past payments and transactions
                </p>
              </div>

              <select
                value={filterStatus}
                onChange={handleFilterChange}
                className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="failed">Failed / Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Order / Date
                  </th>
                  <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Event
                  </th>
                  <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Method
                  </th>
                  <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Amount
                  </th>
                  <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-4 py-3.5 sm:px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                        <p className="text-sm text-slate-500">Loading payments…</p>
                      </div>
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-14 text-center">
                      <p className="text-sm font-medium text-slate-500">
                        No payments found matching your criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => {
                    const status =
                      statusConfig[payment.paymentStatus] || {
                        label: payment.paymentStatus,
                        className: 'bg-slate-50 text-slate-700 border-slate-200',
                      };
                    const MethodIcon = methodIcon(payment.paymentMethod);
                    const isExpanded = selectedPayment === payment._id;

                    return (
                      <React.Fragment key={payment._id}>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                            <p className="font-semibold text-slate-900">
                              {payment.orderNumber}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {format(new Date(payment.createdAt), 'MMM d, yyyy h:mm a')}
                            </p>
                          </td>

                          <td className="px-4 py-4 sm:px-5">
                            <p className="font-medium text-slate-900 truncate max-w-[180px]">
                              {payment.eventId?.name || 'Unknown Event'}
                            </p>
                          </td>

                          <td className="px-4 py-4 sm:px-5">
                            <div className="flex items-center gap-1.5">
                              <MethodIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              <div>
                                <p className="font-medium text-slate-900">
                                  {methodLabels[payment.paymentMethod] ||
                                    payment.paymentMethod}
                                </p>
                                {payment.paymentMethod === 'card' && (
                                  <p className="text-xs text-slate-500">
                                    {gatewayLabels[payment.gatewayUsed] ||
                                      payment.gatewayUsed ||
                                      'N/A'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 sm:px-5 font-semibold text-slate-900 tabular-nums">
                            {(payment.totalAmount || 0).toLocaleString()}
                          </td>

                          <td className="px-4 py-4 sm:px-5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-4 py-4 sm:px-5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPayment(isExpanded ? null : payment._id)
                              }
                              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition"
                            >
                              {isExpanded ? 'Hide' : 'Details'}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan="6" className="px-4 py-5 sm:px-5">
                              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                {/* Timeline */}
                                <div className="rounded-xl border border-slate-200 bg-white p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Transaction Timeline
                                  </p>
                                  <div className="mt-3 space-y-2.5">
                                    <div className="flex justify-between gap-3 text-sm">
                                      <span className="text-slate-500">Order Created</span>
                                      <span className="font-medium text-slate-900 text-right">
                                        {format(
                                          new Date(payment.createdAt),
                                          'MMM d, yyyy h:mm a'
                                        )}
                                      </span>
                                    </div>
                                    {payment.paidAt && (
                                      <div className="flex justify-between gap-3 text-sm">
                                        <span className="text-slate-500">
                                          Payment Completed
                                        </span>
                                        <span className="font-medium text-slate-900 text-right">
                                          {format(
                                            new Date(payment.paidAt),
                                            'MMM d, yyyy h:mm a'
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Bank transfer */}
                                {payment.paymentMethod === 'bank_transfer' &&
                                  payment.submissionDetails && (
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Bank Transfer Details
                                      </p>
                                      <div className="mt-3 space-y-2.5">
                                        <div className="flex justify-between gap-3 text-sm">
                                          <span className="text-slate-500">Submitted At</span>
                                          <span className="font-medium text-slate-900 text-right">
                                            {format(
                                              new Date(
                                                payment.submissionDetails.submittedAt
                                              ),
                                              'MMM d, yyyy h:mm a'
                                            )}
                                          </span>
                                        </div>
                                        <div className="flex justify-between gap-3 text-sm">
                                          <span className="text-slate-500">Reference</span>
                                          <span
                                            className="font-medium text-slate-900 truncate max-w-[180px] text-right"
                                            title={payment.submissionDetails.remarks}
                                          >
                                            {payment.submissionDetails.remarks || 'None'}
                                          </span>
                                        </div>
                                        {payment.submissionDetails.receiptUrl && (
                                          <a
                                            href={payment.submissionDetails.receiptUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700"
                                          >
                                            View Uploaded Receipt ↗
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {/* Card gateway */}
                                {payment.paymentMethod === 'card' &&
                                  payment.paymentDetails && (
                                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Gateway Details
                                      </p>
                                      <div className="mt-3 space-y-2.5">
                                        {payment.paymentDetails.transactionId && (
                                          <div className="flex justify-between gap-3 text-sm">
                                            <span className="text-slate-500">
                                              Transaction ID
                                            </span>
                                            <span className="font-mono text-xs font-medium text-slate-900">
                                              {payment.paymentDetails.transactionId}
                                            </span>
                                          </div>
                                        )}
                                        {payment.paymentDetails.stripeSessionId && (
                                          <div className="flex justify-between gap-3 text-sm">
                                            <span className="text-slate-500">
                                              Stripe Session
                                            </span>
                                            <span
                                              className="font-mono text-xs font-medium text-slate-900 truncate max-w-[180px]"
                                              title={
                                                payment.paymentDetails.stripeSessionId
                                              }
                                            >
                                              {payment.paymentDetails.stripeSessionId}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center sm:text-left text-xs text-slate-500">
                Page{' '}
                <span className="font-semibold text-slate-700">{currentPage}</span> of{' '}
                <span className="font-semibold text-slate-700">{totalPages}</span>
              </p>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeftIcon className="h-3.5 w-3.5" />
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </BuyerLayout>
  );
};

export default BuyerPaymentHistoryPage;