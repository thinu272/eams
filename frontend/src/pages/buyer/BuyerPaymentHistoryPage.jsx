import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getBuyerPaymentHistory } from '../../api/buyerPaymentHistory';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { format } from 'date-fns';

const statusConfig = {
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800 border-green-200' },
  success: { label: 'Success', className: 'bg-green-100 text-green-800 border-green-200' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  pending_verification: { label: 'Pending Verification', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800 border-red-200' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200' },
  expired: { label: 'Expired', className: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const gatewayLabels = {
  stripe: 'Stripe',
  payhere: 'PayHere',
  null: 'N/A'
};

const methodLabels = {
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  cash_on_entrance: 'Cash (Entrance)',
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
    } catch (err) {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
            <p className="text-gray-600 mt-1">Track your past payments and transactions.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-500 pl-2">Filter:</span>
            <select
              value={filterStatus}
              onChange={handleFilterChange}
              className="text-sm border-0 bg-transparent focus:ring-0 text-gray-900 cursor-pointer outline-none"
            >
              <option value="">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="failed">Failed / Rejected</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Order No. / Date</th>
                  <th className="px-6 py-4 font-semibold">Event</th>
                  <th className="px-6 py-4 font-semibold">Method / Gateway</th>
                  <th className="px-6 py-4 font-semibold">Amount</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      <div className="flex justify-center mb-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                      Loading payments...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No payments found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => {
                    const status = statusConfig[payment.paymentStatus] || { label: payment.paymentStatus, className: 'bg-gray-100 text-gray-800' };
                    
                    return (
                      <React.Fragment key={payment._id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{payment.orderNumber}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {format(new Date(payment.createdAt), 'MMM d, yyyy h:mm a')}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{payment.eventId?.name || 'Unknown Event'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{methodLabels[payment.paymentMethod] || payment.paymentMethod}</div>
                            {payment.paymentMethod === 'card' && (
                              <div className="text-xs text-gray-500 mt-1">
                                {gatewayLabels[payment.gatewayUsed] || payment.gatewayUsed || 'N/A'}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {payment.totalAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedPayment(selectedPayment === payment._id ? null : payment._id)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                            >
                              {selectedPayment === payment._id ? 'Hide Details' : 'View Details'}
                            </button>
                          </td>
                        </tr>
                        {/* Expandable Details Row */}
                        {selectedPayment === payment._id && (
                          <tr className="bg-slate-50 border-b border-gray-200">
                            <td colSpan="6" className="px-6 py-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Transaction Timeline</h4>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-500">Order Created:</span>
                                      <span className="font-medium text-gray-900">{format(new Date(payment.createdAt), 'MMM d, yyyy h:mm a')}</span>
                                    </div>
                                    {payment.paidAt && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Payment Completed:</span>
                                        <span className="font-medium text-gray-900">{format(new Date(payment.paidAt), 'MMM d, yyyy h:mm a')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {payment.paymentMethod === 'bank_transfer' && payment.submissionDetails && (
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Bank Transfer Details</h4>
                                    <div className="space-y-3">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Submitted At:</span>
                                        <span className="font-medium text-gray-900">{format(new Date(payment.submissionDetails.submittedAt), 'MMM d, yyyy h:mm a')}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Reference / Remarks:</span>
                                        <span className="font-medium text-gray-900 truncate max-w-[200px]" title={payment.submissionDetails.remarks}>
                                          {payment.submissionDetails.remarks || 'None'}
                                        </span>
                                      </div>
                                      {payment.submissionDetails.receiptUrl && (
                                        <div className="mt-2">
                                          <a 
                                            href={payment.submissionDetails.receiptUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                                          >
                                            View Uploaded Receipt ↗
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {payment.paymentMethod === 'card' && payment.paymentDetails && (
                                  <div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Gateway Details</h4>
                                    <div className="space-y-3">
                                      {payment.paymentDetails.transactionId && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-500">Transaction ID:</span>
                                          <span className="font-medium text-gray-900 font-mono text-xs">{payment.paymentDetails.transactionId}</span>
                                        </div>
                                      )}
                                      {payment.paymentDetails.stripeSessionId && (
                                        <div className="flex justify-between text-sm">
                                          <span className="text-gray-500">Stripe Session:</span>
                                          <span className="font-medium text-gray-900 font-mono text-xs truncate max-w-[200px]" title={payment.paymentDetails.stripeSessionId}>
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
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </BuyerLayout>
  );
};

export default BuyerPaymentHistoryPage;
