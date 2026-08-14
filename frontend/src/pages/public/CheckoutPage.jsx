import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  WalletIcon,
} from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvent } from '../../api/events';
import { createOrder } from '../../api/orders';
import { getPaymentConfig } from '../../api/payment';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedTickets, eventId, event: initialEvent } = location.state || {};
  const [event, setEvent] = useState(initialEvent);
  const { user } = useAuth();

  const [buyerDetails, setBuyerDetails] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const fetchEvent = () => {
    if (!eventId) return;
    getEvent(eventId)
      .then((res) => setEvent(res.data?.data?.event))
      .catch((err) => console.error('Failed to sync event on checkout:', err));
  };

  useEffect(() => {
    if (!eventId) return undefined;
    const socket = io(getSocketUrl());
    socket.emit('join_event', { eventId });
    socket.on('event_update', () => fetchEvent());
    return () => {
      socket.emit('leave_event', { eventId });
      socket.disconnect();
    };
  }, [eventId]);

  const [paymentMethod, setPaymentMethod] = useState(() => {
    const methods = event?.settings?.paymentMethods;
    if (methods?.card ?? true) return 'card';
    if (methods?.bank_transfer ?? true) return 'bank_transfer';
    if (methods?.cash ?? true) return 'cash';
    return 'card';
  });
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    getPaymentConfig(eventId)
      .then((res) => {
        if (res.success) {
          setGatewayConfig(res.data);
          setSelectedGateway(res.data.defaultGateway || 'payhere');
        }
      })
      .catch(() => {
        setGatewayConfig({ gateways: ['payhere'], defaultGateway: 'payhere' });
        setSelectedGateway('payhere');
      });
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    setBuyerDetails((prev) => ({
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
      phone: prev.phone || user.phone || '',
    }));
  }, [user]);

  if (!selectedTickets || !event) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-600">
            Access Denied
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            No tickets selected
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Please select tickets from the event page before proceeding to checkout.
          </p>
          <div className="mt-8">
            <Link
              to="/events"
              className="inline-flex rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-all"
            >
              Back to events
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const isExpired = event.endDate && new Date(event.endDate) < new Date();

  if (isExpired) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-500">
            Booking Closed
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
            Event Has Ended
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            This event is overdue. Ticket bookings are no longer available.
          </p>
          <div className="mt-8">
            <Link
              to="/events"
              className="inline-flex rounded-2xl bg-blue-600 hover:bg-blue-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-all"
            >
              Back to fixtures
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const selectedCategories = event.categories.filter(
    (category) => selectedTickets[category.id] > 0
  );
  const totalTickets = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = event.categories.reduce((sum, category) => {
    return sum + category.price * (selectedTickets[category.id] || 0);
  }, 0);

  const formatCurrency = (value) =>
    value === 0
      ? 'Complimentary'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: event.settings?.currency || 'LKR',
          maximumFractionDigits: 0,
        }).format(value);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBuyerDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePayment = async () => {
    if (event.endDate && new Date(event.endDate) < new Date()) {
      toast.error('This event has already ended. Booking is closed.');
      return;
    }
    if (!buyerDetails.name || !buyerDetails.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (
      buyerDetails.phone &&
      !/^\+?[1-9]\d{1,14}$/.test(buyerDetails.phone.trim().replace(/\s+/g, ''))
    ) {
      toast.error('Please enter a valid international phone number');
      return;
    }

    setIsProcessing(true);
    try {
      const tickets = selectedCategories.map((category) => ({
        categoryName: category.name,
        quantity: selectedTickets[category.id],
        price: category.price,
      }));

      const orderData = {
        eventId,
        buyerName: buyerDetails.name,
        buyerEmail: buyerDetails.email,
        buyerPhone: buyerDetails.phone,
        tickets,
        paymentMethod,
        gateway: paymentMethod === 'card' ? selectedGateway : undefined,
      };

      const response = await createOrder(orderData);

      if (response.data.success) {
        if (paymentMethod === 'card') {
          const resData = response.data.data;
          if (resData.gatewayUsed === 'stripe' && resData.stripeSessionUrl) {
            toast.success('Redirecting to Stripe...');
            window.location.href = resData.stripeSessionUrl;
          } else if (resData.paymentData) {
            toast.success('Redirecting to secure payment gateway...');
            const form = document.createElement('form');
            form.method = 'POST';
            form.action =
              process.env.REACT_APP_PAYHERE_URL || 'https://sandbox.payhere.lk/pay/checkout';
            Object.entries(resData.paymentData).forEach(([key, value]) => {
              const input = document.createElement('input');
              input.type = 'hidden';
              input.name = key;
              input.value = value;
              form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
          } else {
            toast.success('Order placed successfully!');
            navigate(`/order/${resData.confirmationToken}/confirm`);
          }
        } else if (paymentMethod === 'bank_transfer') {
          toast.success('Order created! Redirecting to instructions...');
          navigate(`/bank-transfer/instructions/${response.data.data.orderId}`);
        } else {
          toast.success('Reservation placed successfully!');
          navigate(`/cash-entrance/instructions/${response.data.data.confirmationToken}`);
        }
      } else {
        toast.error(response.data.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error?.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const enabledMethods = {
    card: event.settings?.paymentMethods?.card ?? true,
    bank_transfer: event.settings?.paymentMethods?.bank_transfer ?? true,
    cash: event.settings?.paymentMethods?.cash ?? true,
  };

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-16">
        {/* Soft header background */}
        <div className="absolute inset-x-0 top-0 h-72 bg-slate-950">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-50" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors mb-8"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Return to tickets
          </button>

          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Complete Purchase
            </h1>
            <p className="mt-2 text-base text-slate-400">
              {event.name} • Final Step
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Left column */}
            <div className="space-y-6">
              {/* Buyer Information */}
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-5 sm:px-6 py-4 flex items-center gap-2.5">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
                  <h2 className="text-base font-semibold text-white">Buyer Information</h2>
                </div>
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="name"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        autoFocus
                        value={buyerDetails.name}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="email"
                        className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={buyerDetails.email}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="phone"
                      className="text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={buyerDetails.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      placeholder="+94 77 123 4567"
                    />
                    <p className="text-xs text-slate-400">
                      International format recommended (e.g. +94771234567)
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-5 sm:px-6 py-4 flex items-center gap-2.5">
                  <CreditCardIcon className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-white">Payment Method</h2>
                </div>
                <div className="p-5 sm:p-6 space-y-3">
                  {enabledMethods.card && (
                    <div className="space-y-3">
                      <div
                        onClick={() => setPaymentMethod('card')}
                        className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                          paymentMethod === 'card'
                            ? 'border-blue-500 bg-blue-50/40'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-100 ${
                                paymentMethod === 'card' ? 'text-blue-600' : 'text-slate-400'
                              }`}
                            >
                              <CreditCardIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Card Payment
                              </p>
                              <p className="text-xs text-slate-500">Debit / Credit Card</p>
                            </div>
                          </div>
                          <div
                            className={`h-5 w-5 rounded-full border-[3px] transition-all ${
                              paymentMethod === 'card'
                                ? 'bg-blue-600 border-blue-200'
                                : 'bg-white border-slate-300'
                            }`}
                          />
                        </div>
                      </div>

                      {paymentMethod === 'card' &&
                        gatewayConfig?.gateways?.length > 1 && (
                          <div className="ml-4 pl-4 border-l-2 border-blue-100 space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Choose Provider
                            </p>
                            {gatewayConfig.gateways.includes('payhere') && (
                              <label
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                  selectedGateway === 'payhere'
                                    ? 'border-blue-400 bg-white'
                                    : 'border-transparent hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="gateway"
                                  value="payhere"
                                  checked={selectedGateway === 'payhere'}
                                  onChange={(e) => setSelectedGateway(e.target.value)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="text-sm font-semibold text-slate-900">
                                    PayHere
                                  </span>
                                  <p className="text-xs text-slate-500">Local Sri Lankan gateway</p>
                                </div>
                              </label>
                            )}
                            {gatewayConfig.gateways.includes('stripe') && (
                              <label
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                  selectedGateway === 'stripe'
                                    ? 'border-blue-400 bg-white'
                                    : 'border-transparent hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="gateway"
                                  value="stripe"
                                  checked={selectedGateway === 'stripe'}
                                  onChange={(e) => setSelectedGateway(e.target.value)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="text-sm font-semibold text-slate-900">
                                    Stripe
                                  </span>
                                  <p className="text-xs text-slate-500">
                                    International card payments
                                  </p>
                                </div>
                              </label>
                            )}
                          </div>
                        )}
                    </div>
                  )}

                  {enabledMethods.bank_transfer && (
                    <div
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-blue-500 bg-blue-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-100 ${
                              paymentMethod === 'bank_transfer'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                          >
                            <WalletIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Bank Transfer
                            </p>
                            <p className="text-xs text-slate-500">Manual verification</p>
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-[3px] transition-all ${
                            paymentMethod === 'bank_transfer'
                              ? 'bg-blue-600 border-blue-200'
                              : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {enabledMethods.cash && (
                    <div
                      onClick={() => setPaymentMethod('cash')}
                      className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                        paymentMethod === 'cash'
                          ? 'border-blue-500 bg-blue-50/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-slate-100 ${
                              paymentMethod === 'cash' ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          >
                            <ShieldCheckIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Cash at Entrance
                            </p>
                            <p className="text-xs text-slate-500">Pay on event day</p>
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-full border-[3px] transition-all ${
                            paymentMethod === 'cash'
                              ? 'bg-blue-600 border-blue-200'
                              : 'bg-white border-slate-300'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 border border-amber-100 p-3.5">
                    <ShieldCheckIcon className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-800">
                      Transactions are secured with industry-standard encryption.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden lg:sticky lg:top-8">
                <div className="bg-slate-900 px-5 sm:px-6 py-4 flex items-center gap-2.5">
                  <WalletIcon className="h-5 w-5 text-amber-400" />
                  <h2 className="text-base font-semibold text-white">Order Summary</h2>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="space-y-4">
                    {selectedCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {category.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {selectedTickets[category.id]} × {formatCurrency(category.price)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {Math.max(0, category.capacity - (category.sold || 0))} seats left
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-blue-600">
                          {formatCurrency(selectedTickets[category.id] * category.price)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-medium text-slate-700">
                        {formatCurrency(totalPrice)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Taxes & Fees</span>
                      <span className="font-medium text-slate-700">Included</span>
                    </div>
                    <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                      <span className="text-base font-semibold text-slate-900">Total</span>
                      <span className="text-xl font-bold text-slate-900">
                        {formatCurrency(totalPrice)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-500 py-4 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2.5">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Processing...
                      </span>
                    ) : (
                      `Pay ${formatCurrency(totalPrice)}`
                    )}
                  </button>

                  <p className="mt-4 text-center text-xs text-slate-400">
                    By clicking Pay, you agree to our Terms of Service & Privacy Policy.
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

export default CheckoutPage;