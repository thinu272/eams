import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { Link } from 'react-router-dom';
import {
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const BankTransferThankYouPage = () => {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderData();
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/bank-transfer/instructions/${orderId}`);
      const data = await response.json();
      if (data.data) {
        setOrderData(data.data.order);
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currency = orderData?.currency || orderData?.eventId?.settings?.currency || orderData?.event?.settings?.currency || 'LKR';

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Submitted Successfully</h1>
            <p className="text-gray-600">Thank you for your payment submission</p>
          </div>

          {/* Success Message */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ClockIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900">Verification Timeline</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Your payment will be verified within 48 hours. You will receive an email and SMS once verification is completed.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <EnvelopeIcon className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-gray-900">Confirmation Details</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    A confirmation email has been sent with your payment submission details.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Reference */}
          {orderData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Your Reference Number</h3>
              <p className="text-2xl font-bold text-blue-900">{orderData.orderNumber}</p>
              <p className="text-sm text-blue-700 mt-2">
                Please keep this reference number for your records.
              </p>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">What Happens Next?</h3>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">1</span>
                <span>Our team will verify your payment against bank records</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">2</span>
                <span>Once verified, your tickets will be confirmed and activated</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">3</span>
                <span>You'll receive QR codes and attendee assignment links via email</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">4</span>
                <span>Complete attendee details and upload photos if required</span>
              </li>
            </ol>
          </div>

          {/* Support Contact */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-sm text-gray-600 mb-3">
              If you don't receive confirmation within 48 hours, please contact our support team.
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">Email:</span> support@entrynex.com
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Phone:</span> +94 11 123 4567
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              to="/events"
              className="block w-full text-center inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <span>Browse More Events</span>
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            
            <Link
              to="/buyer/tickets"
              className="block w-full text-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default BankTransferThankYouPage;
