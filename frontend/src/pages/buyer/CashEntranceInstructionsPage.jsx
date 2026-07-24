import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import { getBuyerOrderByToken } from '../../api/orders';
import {
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

const CashEntranceInstructionsPage = () => {
  const navigate = useNavigate();
  const { confirmationToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Check if order is already confirmed
  const isOrderConfirmed = order?.status === 'CONFIRMED' || order?.paymentStatus === 'paid' || order?.paymentStatus === 'success';

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await getBuyerOrderByToken(confirmationToken);
        if (response.data && response.data.data && response.data.data.order) {
          setOrder(response.data.data.order);
        } else {
          toast.error('Failed to load order information');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        toast.error('Failed to load order information');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [confirmationToken]);

  const handleProceed = () => {
    if (!acceptedTerms) {
      toast.error('Please accept the venue payment terms to continue.');
      return;
    }
    // Navigate to buyer dashboard - ticket assignment is disabled until payment
    navigate('/buyer/dashboard');
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (!order) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <p className="text-slate-600 font-medium">Failed to load instructions. The order might not exist.</p>
        </div>
      </PublicLayout>
    );
  }

  const currency = order.event?.settings?.currency || order.eventId?.settings?.currency || 'LKR';

  return (
    <PublicLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8 text-center sm:text-left">
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">
              {isOrderConfirmed ? 'Order Confirmed' : 'Cash at Entrance Instructions'}
            </h1>
            <p className="text-slate-500 font-medium mt-2">
              {isOrderConfirmed ? 'Your payment has been confirmed and your tickets are ready.' : 'Your reservation has been placed successfully.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Instructions & Terms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Important Notice */}
              {isOrderConfirmed ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="bg-green-100 p-2 rounded-full shrink-0">
                      <BanknotesIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-black text-green-900 text-lg uppercase tracking-wide mb-2">Payment Confirmed</h3>
                      <ul className="text-sm text-green-800 space-y-3 font-medium">
                        <li className="flex gap-2">
                          <span>Your payment has been successfully processed and your tickets are now active.</span>
                        </li>
                        <li>• Your tickets are now confirmed and ready for use</li>
                        <li>• You can now complete attendee details and download tickets</li>
                        <li>• Present your QR code at the venue entrance for scanning</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-full shrink-0">
                      <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-black text-amber-900 text-lg uppercase tracking-wide mb-2">Venue Payment Rules</h3>
                      <ul className="text-sm text-amber-800 space-y-3 font-medium">
                        <li className="flex gap-2">
                          <ClockIcon className="h-5 w-5 shrink-0 text-amber-600" />
                          <span>You must arrive <strong>30-60 minutes before the event</strong> to complete payment and collect your tickets.</span>
                        </li>
                        <li className="flex gap-2">
                          <MapPinIcon className="h-5 w-5 shrink-0 text-amber-600" />
                          <span>Payment will be collected at the designated entrance desk at the venue.</span>
                        </li>
                        <li>• Your tickets will remain strictly <strong>Reserved</strong> and inactive until the payment is collected.</li>
                        <li>• Failure to arrive and pay on time may result in your reservation being automatically cancelled to free up inventory.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Accept Terms */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-4">Reservation Information</h3>
                <p className="text-sm text-slate-600 mb-6">
                  Before proceeding to assign attendee details to your tickets, please confirm that you understand the terms for cash payments at the venue.
                </p>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 transition-colors cursor-pointer"
                    />
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                    I agree to arrive 30-60 minutes before the event start time to complete my payment at the venue, and I understand my tickets will remain inactive until payment is received.
                  </span>
                </label>
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleProceed}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl ${
                    acceptedTerms 
                      ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-600/20' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>Go to Dashboard</span>
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
                <h2 className="text-lg font-black uppercase tracking-wide text-slate-900 mb-6 pb-4 border-b border-slate-100">
                  Order Summary
                </h2>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event</p>
                    <p className="font-medium text-slate-900 line-clamp-2">{order.event?.name || order.eventId?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Ref</p>
                    <p className="font-medium text-slate-900">{order.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                      isOrderConfirmed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isOrderConfirmed ? 'Confirmed (Paid)' : 'Reserved (Awaiting Payment)'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6 pb-6 border-b border-slate-100">
                  {order.tickets?.map((ticket, index) => (
                    <div key={index} className="flex justify-between items-start text-sm">
                      <div className="flex-1 pr-4">
                        <p className="font-medium text-slate-900">{ticket.categoryName}</p>
                        <p className="text-slate-500">{ticket.quantity} × {currency} {(ticket.price || 0).toLocaleString()}</p>
                      </div>
                      <p className="font-bold text-slate-900 whitespace-nowrap">
                        {currency} {((ticket.quantity || 0) * (ticket.price || 0)).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      {isOrderConfirmed ? 'Amount Paid' : 'Amount Due'}
                    </span>
                    <span className="text-2xl font-black text-blue-600">
                      {currency} {(order.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 text-right uppercase tracking-wider">
                    {isOrderConfirmed ? 'Payment completed at venue' : 'To be paid at venue'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default CashEntranceInstructionsPage;
