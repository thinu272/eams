import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

const BankTransferInstructionsPage = () => {
  const themeColor = '#2563EB';
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    fetchInstructions();
  }, [orderId]);

  useEffect(() => {
    if (instructions?.order?.reservationExpiry) {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const expiry = new Date(instructions.order.reservationExpiry).getTime();
        const distance = expiry - now;

        if (distance < 0) {
          clearInterval(timer);
          setTimeLeft('Expired');
        } else {
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [instructions]);

  const fetchInstructions = async () => {
    try {
      const apiBase = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${apiBase}/bank-transfer/instructions/${orderId}`);
      const data = await response.json();
      if (!response.ok) {
        console.error('API error fetching instructions:', data);
        toast.error(data.message || 'Failed to load instructions');
        return;
      }
      if (data.data) {
        setInstructions(data.data);
      } else {
        toast.error('Unexpected response format while loading instructions');
      }
    } catch (error) {
      console.error('Error fetching instructions:', error);
      toast.error('Failed to load instructions');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleProceed = () => {
    // Use the actual _id from order data, not the orderId from params
    const orderIdToUse = instructions.order._id || orderId;
    navigate(`/bank-transfer/submit/${orderIdToUse}`);
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (!instructions) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Failed to load instructions</p>
        </div>
      </PublicLayout>
    );
  }

  const { order, bankAccounts } = instructions;
  const currency = order?.currency || order?.eventId?.settings?.currency || order?.event?.settings?.currency || 'LKR';
  
  // Check if payment has already been submitted
  const isPaymentSubmitted = order.paymentStatus && 
    order.paymentStatus !== 'pending' && 
    order.paymentStatus !== 'awaiting_payment';
  
  const isExpired = timeLeft === 'Expired';

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Bank Transfer Instructions</h1>
            <p className="text-gray-600 mt-2">Complete your payment using direct bank transfer</p>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="mb-4">
              <h3 className="font-medium text-gray-900 text-lg">{order.eventName}</h3>
              <p className="text-sm text-gray-600">Order Reference: {order.orderNumber}</p>
            </div>

            <div className="space-y-3 mb-6">
              {order.tickets.map((ticket, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{ticket.categoryName}</p>
                    <p className="text-sm text-gray-600">
                      {ticket.quantity} Ã— {currency} {ticket.price.toLocaleString()}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {currency} {(ticket.quantity * ticket.price).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-gray-900">Total Amount</span>
                <span className="text-blue-600">{currency} {order.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Payment Deadline</span>
                <span className={`font-medium ${timeLeft === 'Expired' ? 'text-red-600' : 'text-green-600'}`}>
                  {timeLeft === 'Expired' ? 'Expired' : timeLeft}
                </span>
              </div>
            </div>
          </div>

          {/* Important Notice */}
          {isPaymentSubmitted ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <BanknotesIcon className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-2">Payment Already Submitted</h3>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Your payment details have been submitted and are under review</li>
                    <li>• You will receive an email once your payment is verified</li>
                    <li>• Current status: {order.paymentStatus === 'pending_verification' ? 'Awaiting Verification' : order.paymentStatus}</li>
                    <li>• Please allow up to 48 hours for verification</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-2">Important Notice</h3>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Please transfer the exact amount shown above</li>
                    <li>• Your tickets will only be confirmed after payment verification</li>
                    <li>• Verification is normally completed within 48 hours</li>
                    <li>• Keep your payment receipt for submission</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Bank Accounts */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Bank Accounts</h2>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {bankAccounts.map((bank, index) => (
                <div key={bank._id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{bank.bankName}</h3>
                      <p className="text-sm text-gray-600">Option {index + 1}</p>
                    </div>
                    {bank.qrCode && (
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                        <BanknotesIcon className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Account Name</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{bank.accountName}</span>
                        <button
                          onClick={() => handleCopy(bank.accountName, 'Account name')}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{bank.accountNumber}</span>
                        <button
                          onClick={() => handleCopy(bank.accountNumber, 'Account number')}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Branch</span>
                      <span className="font-semibold text-gray-900">{bank.branch}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">SWIFT Code</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{bank.swiftCode}</span>
                        <button
                          onClick={() => handleCopy(bank.swiftCode, 'SWIFT code')}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <button
              onClick={handleProceed}
              disabled={isExpired || isPaymentSubmitted}
              className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              <span>{isPaymentSubmitted ? 'Payment Already Submitted' : isExpired ? 'Reservation Expired' : "I Have Made the Payment"}</span>
              {!isExpired && !isPaymentSubmitted && <ArrowRightIcon className="h-5 w-5" />}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Checkout
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default BankTransferInstructionsPage;

