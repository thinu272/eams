import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CreditCardIcon, ShieldCheckIcon, WalletIcon } from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvent } from '../../api/events';
import { createOrder } from '../../api/orders';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';

const CheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedTickets, eventId, event: initialEvent } = location.state || {};
  const [event, setEvent] = useState(initialEvent);
  const themeColor = '#2563EB'; // Reverted to default brand blue
  const { user } = useAuth();

  const [buyerDetails, setBuyerDetails] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const fetchEvent = () => {
    if (!eventId) return;
    getEvent(eventId)
      .then((res) => {
        setEvent(res.data?.data?.event);
      })
      .catch((err) => console.error('Failed to sync event on checkout:', err));
  };

  useEffect(() => {
    if (!eventId) return undefined;
    const socket = io(getSocketUrl());
    
    socket.emit('join_event', { eventId });

    socket.on('event_update', (data) => {
      console.log('Real-time update on checkout:', data);
      fetchEvent();
    });

    return () => {
      socket.emit('leave_event', { eventId });
      socket.disconnect();
    };
  }, [eventId]);
  const [paymentMethod, setPaymentMethod] = useState(() => {
    const methods = event.settings?.paymentMethods;
    if (methods?.card ?? true) return 'card';
    if (methods?.bank_transfer ?? true) return 'bank_transfer';
    if (methods?.cash ?? true) return 'cash';
    return 'card';
  });
  const [isProcessing, setIsProcessing] = useState(false);

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
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-black uppercase tracking-[0.3em]" style={{ color: themeColor }}>
            Access Denied
          </p>
          <h1 className="mt-6 text-5xl font-black text-slate-950 uppercase tracking-tight">No tickets selected</h1>
          <p className="mt-6 text-lg text-slate-500 font-medium">
            Please select tickets from the event page before proceeding to checkout.
          </p>
          <div className="mt-10">
            <Link
              to="/events"
              className="inline-flex rounded-full bg-slate-950 px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition shadow-xl brightness-110"
              style={{ backgroundColor: themeColor }}
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
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-red-500">
            Booking Closed
          </p>
          <h1 className="mt-6 text-5xl font-black text-slate-950 uppercase tracking-tight">Event Has Ended</h1>
          <p className="mt-6 text-lg text-slate-500 font-medium">
            This event is overdue. Ticket bookings are no longer available.
          </p>
          <div className="mt-10">
            <Link
              to="/events"
              className="inline-flex rounded-full bg-slate-950 px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition shadow-xl brightness-110"
              style={{ backgroundColor: themeColor }}
            >
              Back to fixtures
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const selectedCategories = event.categories.filter((category) => selectedTickets[category.id] > 0);
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
    setBuyerDetails((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    if (buyerDetails.phone && !/^\+?[1-9]\d{1,14}$/.test(buyerDetails.phone.trim().replace(/\s+/g, ''))) {
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
      };

      const response = await createOrder(orderData);

      if (response.data.success) {
        // If it's a card payment, use PayHere integration
        if (paymentMethod === 'card' && response.data.data.paymentData) {
          toast.success('Redirecting to secure payment gateway...');
          
          // Create and submit a hidden form to PayHere
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = process.env.REACT_APP_PAYHERE_URL || 'https://sandbox.payhere.lk/pay/checkout'; // Use sandbox by default
          
          Object.entries(response.data.data.paymentData).forEach(([key, value]) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = value;
            form.appendChild(input);
          });
          
          document.body.appendChild(form);
          form.submit();
        } else {
          // For Cash or Bank Transfer, just go to confirmation
          toast.success('Order created successfully!');
          const confirmationToken = response.data.data.confirmationToken;
          navigate(`/order/${confirmationToken}/confirm`);
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
      <div className="relative min-h-screen bg-slate-50 pb-20">
        {/* Dynamic Background Header */}
        <div className="absolute inset-x-0 top-0 h-96 bg-slate-950">
           <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-50" />
           <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition hover:text-white"
              style={{ color: themeColor }}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Return to tickets
            </button>
          </div>

          <div className="mb-12">
            <h1 className="text-4xl font-black uppercase tracking-tight text-white sm:text-5xl">
               Complete Purchase
            </h1>
            <p className="mt-4 text-lg font-medium text-slate-400">
               {event.name} • Final Step
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            <div className="space-y-8">
              {/* Buyer Information */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="bg-slate-900 px-4 xs:px-6 sm:px-8 py-5 sm:py-6">
                   <h2 className="flex items-center gap-3 text-lg sm:text-xl font-black uppercase tracking-wide text-white">
                      <ShieldCheckIcon className="h-6 w-6 text-amber-500" />
                      Buyer Information
                   </h2>
                </div>
                <div className="p-4 xs:p-6 sm:p-8 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        autoFocus
                        value={buyerDetails.name}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 placeholder:text-slate-400 transition focus:bg-white focus:outline-none"
                        style={{ '--focus-border': themeColor }}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={buyerDetails.email}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 placeholder:text-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Phone Number (for SMS confirmation)
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={buyerDetails.phone}
                      onChange={handleInputChange}
                      className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 placeholder:text-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
                      placeholder="+1234567890"
                    />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Must be in international format (e.g., +1234567890)
                    </p>
                  </div>
                </div>
              </div>
              {/* Payment Methods */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
                <div className="bg-slate-900 px-4 xs:px-6 sm:px-8 py-5 sm:py-6">
                   <h2 className="flex items-center gap-3 text-lg sm:text-xl font-black uppercase tracking-wide text-white">
                      <CreditCardIcon className="h-6 w-6 text-emerald-500" />
                      Payment Method
                   </h2>
                </div>
                <div className="p-4 xs:p-6 sm:p-8 space-y-4">
                   {/* Option 1: Card */}
                   {enabledMethods.card && (
                     <div 
                        onClick={() => setPaymentMethod('card')}
                        className={`cursor-pointer rounded-2xl border-2 p-4 xs:p-6 transition-all ${
                          paymentMethod === 'card' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                     >
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-3 xs:gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm font-black transition-colors ${paymentMethod === 'card' ? 'text-blue-600' : 'text-slate-400'}`}>
                                 <CreditCardIcon className="h-6 w-6" />
                              </div>
                              <div>
                                 <p className="font-black text-slate-900 text-sm xs:text-base">Standard Checkout</p>
                                 <p className="text-[10px] xs:text-sm font-bold text-slate-400 uppercase tracking-widest">Debit / Credit Card</p>
                              </div>
                           </div>
                           <div className={`h-6 w-6 rounded-full border-4 transition-all shrink-0 ${
                             paymentMethod === 'card' ? 'bg-blue-500 border-blue-200 ring-4 ring-blue-500/10' : 'bg-white border-slate-200'
                           }`} />
                        </div>
                     </div>
                   )}

                   {/* Option 2: Bank Transfer */}
                   {enabledMethods.bank_transfer && (
                     <div 
                        onClick={() => setPaymentMethod('bank_transfer')}
                        className={`cursor-pointer rounded-2xl border-2 p-4 xs:p-6 transition-all ${
                          paymentMethod === 'bank_transfer' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                     >
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-3 xs:gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm font-black transition-colors ${paymentMethod === 'bank_transfer' ? 'text-blue-600' : 'text-slate-400'}`}>
                                 <WalletIcon className="h-6 w-6" />
                              </div>
                              <div>
                                 <p className="font-black text-slate-900 text-sm xs:text-base">Direct Bank Transfer</p>
                                 <p className="text-[10px] xs:text-sm font-bold text-slate-400 uppercase tracking-widest">Manual Verification</p>
                              </div>
                           </div>
                           <div className={`h-6 w-6 rounded-full border-4 transition-all shrink-0 ${
                             paymentMethod === 'bank_transfer' ? 'bg-blue-500 border-blue-200 ring-4 ring-blue-500/10' : 'bg-white border-slate-200'
                           }`} />
                        </div>
                     </div>
                   )}

                   {/* Option 3: Cash */}
                   {enabledMethods.cash && (
                     <div 
                        onClick={() => setPaymentMethod('cash')}
                        className={`cursor-pointer rounded-2xl border-2 p-4 xs:p-6 transition-all ${
                          paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                        }`}
                     >
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center gap-3 xs:gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm font-black transition-colors ${paymentMethod === 'cash' ? 'text-blue-600' : 'text-slate-400'}`}>
                                 <ShieldCheckIcon className="h-6 w-6" />
                              </div>
                              <div>
                                 <p className="font-black text-slate-900 text-sm xs:text-base">Cash at Entrance</p>
                                 <p className="text-[10px] xs:text-sm font-bold text-slate-400 uppercase tracking-widest">Pay on Event Day</p>
                              </div>
                           </div>
                           <div className={`h-6 w-6 rounded-full border-4 transition-all shrink-0 ${
                             paymentMethod === 'cash' ? 'bg-blue-500 border-blue-200 ring-4 ring-blue-500/10' : 'bg-white border-slate-200'
                           }`} />
                        </div>
                     </div>
                   )}

                   <div className="mt-8 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-200">
                      < ShieldCheckIcon className="h-5 w-5 text-amber-600 shrink-0" />
                      <p className="text-[10px] xs:text-xs font-bold text-amber-800 uppercase tracking-wide">
                          Transactions are secured with industry-standard 256-bit encryption.
                      </p>
                   </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Order Summary Summary */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:sticky lg:top-8">
                <div className="bg-slate-900 px-4 xs:px-6 sm:px-8 py-5 sm:py-6">
                   <h2 className="flex items-center gap-3 text-lg sm:text-xl font-black uppercase tracking-wide text-white">
                      <WalletIcon className="h-6 w-6 text-amber-500" />
                      Order Summary
                   </h2>
                </div>
                <div className="p-4 xs:p-6 sm:p-8">
                  <div className="space-y-4">
                    {selectedCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-start justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight">{category.name}</p>
                          <p className="mt-1 text-sm font-bold text-slate-400 uppercase tracking-widest">
                            {selectedTickets[category.id]} Units × {formatCurrency(category.price)}
                            <span className="ml-2 block text-[10px] text-slate-500">
                               Remaining: {Math.max(0, category.capacity - (category.sold || 0))} seats
                            </span>
                          </p>
                        </div>
                        <p className="font-black" style={{ color: themeColor }}>
                          {formatCurrency(selectedTickets[category.id] * category.price)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 space-y-4 rounded-2xl bg-slate-50 p-6 border border-slate-200">
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-widest text-xs">
                       <span>Subtotal</span>
                       <span>{formatCurrency(totalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-widest text-xs">
                       <span>Taxes & Fees</span>
                       <span>Included</span>
                    </div>
                    <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
                      <span className="text-lg font-black uppercase tracking-widest text-slate-950">Total</span>
                      <span className="text-2xl font-black text-slate-950">{formatCurrency(totalPrice)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="mt-8 flex w-full items-center justify-center rounded-2xl py-5 text-lg font-black uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: themeColor }}
                  >
                    {isProcessing ? (
                       <span className="flex items-center gap-3">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing...
                       </span>
                    ) : (
                       `Pay ${formatCurrency(totalPrice)}`
                    )}
                  </button>
                  
                  <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                     By clicking Pay, you agree to our <br/> Terms of Service & Privacy Policy.
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
