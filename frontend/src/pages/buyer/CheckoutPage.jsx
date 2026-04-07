import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../../api/orders';
import PublicLayout from '../../components/layout/PublicLayout';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const phoneRegex = /^\+947\d{8}$/;
  const [checkoutData, setCheckoutData] = useState(null);
  const [buyerInfo, setBuyerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    notificationChannel: 'email',
  });
  const [placing, setPlacing] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const data = localStorage.getItem('checkoutData');
    if (!data) {
      toast.error('No checkout data found');
      navigate('/events');
      return;
    }
    try {
      const parsed = JSON.parse(data);
      setCheckoutData(parsed);
    } catch (error) {
      console.error('Invalid checkout data:', error);
      toast.error('Invalid checkout data');
      navigate('/events');
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBuyerInfo(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!buyerInfo.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!buyerInfo.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(buyerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (buyerInfo.notificationChannel !== 'email') {
      if (!buyerInfo.phone.trim()) {
        newErrors.phone = 'Phone number is required for SMS notifications';
      } else if (!phoneRegex.test(buyerInfo.phone.trim())) {
        newErrors.phone = 'Use Sri Lanka format: +947XXXXXXXX';
      }
    } else if (buyerInfo.phone.trim() && !phoneRegex.test(buyerInfo.phone.trim())) {
      newErrors.phone = 'Use Sri Lanka format: +947XXXXXXXX';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!checkoutData) {
      toast.error('Checkout data not found');
      return;
    }

    setPlacing(true);
    setErrors({});

    try {
      // Prepare tickets data for backend
      const tickets = Object.keys(checkoutData.selectedTickets)
        .filter(categoryId => checkoutData.selectedTickets[categoryId] > 0)
        .map(categoryId => {
          const category = checkoutData.categories.find(cat => cat.id === categoryId);
          return {
            categoryName: category.name,
            quantity: checkoutData.selectedTickets[categoryId],
            price: category.price, // Frontend price (backend will validate)
          };
        });

      const orderData = {
        eventId: checkoutData.eventId,
        buyerName: buyerInfo.name.trim(),
        buyerEmail: buyerInfo.email.trim().toLowerCase(),
        buyerPhone: buyerInfo.phone.trim(),
        notificationChannel: buyerInfo.notificationChannel,
        tickets,
      };

      const response = await createOrder(orderData);

      toast.success('Order placed successfully!');

      // Clear checkout data
      localStorage.removeItem('checkoutData');

      // Redirect to confirmation page
      navigate(`/confirm/${response.data.data.confirmationToken}`);
    } catch (error) {
      console.error('Order placement failed:', error);
      const errorMessage = error.response?.data?.message || 'Failed to place order. Please try again.';
      toast.error(errorMessage);

      // Handle validation errors from backend
      if (error.response?.data?.errors) {
        const backendErrors = {};
        error.response.data.errors.forEach(err => {
          if (err.param) {
            backendErrors[err.param] = err.msg;
          }
        });
        setErrors(backendErrors);
      }
    } finally {
      setPlacing(false);
    }
  };

  if (!checkoutData) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  const totalTickets = Object.values(checkoutData.selectedTickets).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = checkoutData.categories.reduce((sum, cat) => {
    return sum + (cat.price * (checkoutData.selectedTickets[cat.id] || 0));
  }, 0);

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
            <p className="text-gray-600 mt-2">Complete your order for {checkoutData.eventName}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Buyer Information Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Buyer Information</h2>

              <form onSubmit={handlePlaceOrder} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={buyerInfo.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={buyerInfo.email}
                    onChange={handleInputChange}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email address"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={buyerInfo.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                  <p className="mt-1 text-xs text-gray-500">Format: +947XXXXXXXX</p>
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="notificationChannel" className="block text-sm font-medium text-gray-700 mb-2">
                    Send Notifications Via
                  </label>
                  <select
                    id="notificationChannel"
                    name="notificationChannel"
                    value={buyerInfo.notificationChannel}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="both">Email + SMS</option>
                  </select>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    loading={placing}
                    disabled={placing}
                  >
                    {placing ? 'Placing Order...' : 'Confirm & Continue'}
                  </Button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  By placing this order, you agree to our terms and conditions.
                  You will receive a confirmation notification based on your selected channel.
                </p>
              </form>
            </div>

            {/* Right Column - Order Summary */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="mb-4">
                <h3 className="font-medium text-gray-900 text-lg">{checkoutData.eventName}</h3>
                <p className="text-sm text-gray-600">Event ID: {checkoutData.eventId}</p>
              </div>

              <div className="space-y-3 mb-6">
                {checkoutData.categories
                  .filter(category => checkoutData.selectedTickets[category.id] > 0)
                  .map((category) => (
                  <div key={category.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-sm text-gray-600">
                        {checkoutData.selectedTickets[category.id]} × LKR {category.price.toLocaleString()}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      LKR {(checkoutData.selectedTickets[category.id] * category.price).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total Tickets</span>
                  <span className="font-medium">{totalTickets}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-gray-900">Total Amount</span>
                  <span className="text-gray-900">LKR {totalPrice.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 hover:text-blue-800 font-medium"
              disabled={placing}
            >
              ← Back to Event
            </button>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default CheckoutPage;
