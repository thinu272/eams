import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import toast from 'react-hot-toast';
import {
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const BankTransferSubmitPage = () => {
  const themeColor = '#2563EB';
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [formData, setFormData] = useState({
    payerName: '',
    payerEmail: '',
    payerPhone: '',
    payerNicPassport: '',
    bankUsed: '',
    transferDate: '',
    transferTime: '',
    referenceNumber: '',
    amountPaid: '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [errors, setErrors] = useState({});

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
        setFormData(prev => ({
          ...prev,
          amountPaid: data.data.order.totalAmount,
        }));
      }
    } catch (error) {
      console.error('Error fetching order data:', error);
      toast.error('Failed to load order data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      // Check file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Only JPEG, PNG, and PDF files are allowed');
        return;
      }
      setReceiptFile(file);
      if (errors.receiptFile) {
        setErrors(prev => ({ ...prev, receiptFile: '' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.payerName.trim()) {
      newErrors.payerName = 'Payer name is required';
    }

    if (!formData.payerEmail.trim()) {
      newErrors.payerEmail = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.payerEmail)) {
      newErrors.payerEmail = 'Please enter a valid email address';
    }

    if (!formData.payerPhone.trim()) {
      newErrors.payerPhone = 'Phone number is required';
    }

    if (!formData.bankUsed.trim()) {
      newErrors.bankUsed = 'Bank name is required';
    }

    if (!formData.transferDate) {
      newErrors.transferDate = 'Transfer date is required';
    }

    if (!formData.transferTime.trim()) {
      newErrors.transferTime = 'Transfer time is required';
    }

    if (!formData.referenceNumber.trim()) {
      newErrors.referenceNumber = 'Reference number is required';
    }

    if (!formData.amountPaid || parseFloat(formData.amountPaid) <= 0) {
      newErrors.amountPaid = 'Amount paid is required';
    }

    if (!receiptFile) {
      newErrors.receiptFile = 'Receipt file is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('receipt', receiptFile);
      formDataToSend.append('payerName', formData.payerName);
      formDataToSend.append('payerEmail', formData.payerEmail);
      formDataToSend.append('payerPhone', formData.payerPhone);
      formDataToSend.append('payerNicPassport', formData.payerNicPassport);
      formDataToSend.append('bankUsed', formData.bankUsed);
      formDataToSend.append('transferDate', formData.transferDate);
      formDataToSend.append('transferTime', formData.transferTime);
      formDataToSend.append('referenceNumber', formData.referenceNumber);
      formDataToSend.append('amountPaid', formData.amountPaid);
      formDataToSend.append('notes', formData.notes);

      const response = await fetch(`/api/bank-transfer/submit/${orderId}`, {
        method: 'POST',
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Payment submitted successfully');
        navigate(`/bank-transfer/thank-you/${orderId}`);
      } else {
        toast.error(data.message || 'Failed to submit payment');
      }
    } catch (error) {
      console.error('Error submitting payment:', error);
      toast.error('Failed to submit payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  const currency = orderData?.currency || orderData?.eventId?.settings?.currency || orderData?.event?.settings?.currency || 'LKR';

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Submit Payment Details</h1>
            <p className="text-gray-600 mt-2">Provide your payment information and upload receipt</p>
          </div>

          {/* Order Summary */}
          {orderData && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-blue-900">Order Reference</p>
                  <p className="text-lg font-bold text-blue-900">{orderData.orderNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-900">Amount to Pay</p>
                  <p className="text-lg font-bold text-blue-900">{currency} {orderData.totalAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Payer Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payer Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="payerName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="payerName"
                    name="payerName"
                    value={formData.payerName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.payerName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter payer's full name"
                  />
                  {errors.payerName && (
                    <p className="mt-1 text-sm text-red-600">{errors.payerName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="payerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="payerEmail"
                    name="payerEmail"
                    value={formData.payerEmail}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.payerEmail ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter email address"
                  />
                  {errors.payerEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.payerEmail}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="payerPhone" className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    id="payerPhone"
                    name="payerPhone"
                    value={formData.payerPhone}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.payerPhone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter mobile number"
                  />
                  {errors.payerPhone && (
                    <p className="mt-1 text-sm text-red-600">{errors.payerPhone}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="payerNicPassport" className="block text-sm font-medium text-gray-700 mb-2">
                    NIC / Passport
                  </label>
                  <input
                    type="text"
                    id="payerNicPassport"
                    name="payerNicPassport"
                    value={formData.payerNicPassport}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter NIC or passport number (optional)"
                  />
                </div>
              </div>
            </div>

            {/* Transfer Details */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Transfer Details</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bankUsed" className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Used *
                  </label>
                  <input
                    type="text"
                    id="bankUsed"
                    name="bankUsed"
                    value={formData.bankUsed}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.bankUsed ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Commercial Bank"
                  />
                  {errors.bankUsed && (
                    <p className="mt-1 text-sm text-red-600">{errors.bankUsed}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="transferDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    id="transferDate"
                    name="transferDate"
                    value={formData.transferDate}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split('T')[0]}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.transferDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.transferDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.transferDate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="transferTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Transfer Time *
                  </label>
                  <input
                    type="time"
                    id="transferTime"
                    name="transferTime"
                    value={formData.transferTime}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.transferTime ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.transferTime && (
                    <p className="mt-1 text-sm text-red-600">{errors.transferTime}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="referenceNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Number *
                  </label>
                  <input
                    type="text"
                    id="referenceNumber"
                    name="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.referenceNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter bank reference number"
                  />
                  {errors.referenceNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.referenceNumber}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Paid *
                  </label>
                  <input
                    type="number"
                    id="amountPaid"
                    name="amountPaid"
                    value={formData.amountPaid}
                    onChange={handleInputChange}
                    step="0.01"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.amountPaid ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter amount paid"
                  />
                  {errors.amountPaid && (
                    <p className="mt-1 text-sm text-red-600">{errors.amountPaid}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Receipt Upload */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Receipt</h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  id="receipt"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="receipt" className="cursor-pointer">
                  <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    {receiptFile ? receiptFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    JPEG, PNG, or PDF (max 10MB)
                  </p>
                </label>
              </div>
              {errors.receiptFile && (
                <p className="mt-2 text-sm text-red-600">{errors.receiptFile}</p>
              )}
              {receiptFile && (
                <div className="mt-4 flex items-center gap-2 text-green-600">
                  <CheckCircleIcon className="h-5 w-5" />
                  <span className="text-sm font-medium">File selected: {receiptFile.name}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any additional information about your payment"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {submitting ? 'Submitting...' : 'Submit Payment Details'}
                {!submitting && <ArrowRightIcon className="h-5 w-5" />}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Instructions
              </button>
            </div>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
};

export default BankTransferSubmitPage;
