import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getConfirmInfo, confirmIdentity } from '../../api/attendees';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const AttendeeConfirmPage = () => {
  const { token } = useParams();
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', dateOfBirth: '', nationalId: '', passportNumber: '', nationality: '' });
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    getConfirmInfo(token)
      .then(r => {
        const a = r.data.data.attendee;
        setInfo(a);
        if (a.confirmationStatus === 'confirmed') {
          setDone(true);
        } else {
          // Pre-fill form with existing data
          setForm({
            fullName: a.fullName || '',
            email: a.email || '',
            phone: a.phone || '',
            dateOfBirth: a.dateOfBirth ? new Date(a.dateOfBirth).toISOString().split('T')[0] : '',
            nationalId: a.nationalId || '',
            passportNumber: a.passportNumber || '',
            nationality: a.nationality || '',
          });
        }
      })
      .catch(err => {
        console.error('Fetch info error:', err);
        toast.error('Failed to load attendee information');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email) return toast.error('Name and email are required');
    
    // Check if SMS is required based on event settings
    const smsEnabled = info?.event?.settings?.communicationChannels?.sms;
    if (smsEnabled && !form.phone) return toast.error('Phone number is required for SMS notifications');
    if (form.phone && !phoneRegex.test(form.phone.trim())) return toast.error('Enter a valid international phone number (e.g. +1234567890)');
    
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (photo) fd.append('photo', photo);
      await confirmIdentity(token, fd);
      setDone(true);
      toast.success('Identity confirmed successfully!');
    } catch (err) {
      console.error('CONFIRMATION_ERROR:', err);
      toast.error(err.response?.data?.message || 'Confirmation failed');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md w-full">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckBadgeIcon className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Identity Confirmed!</h2>
        <p className="text-gray-500 text-sm">Your ticket has been confirmed. You will receive a final confirmation notification with your QR code once all tickets in the order are confirmed.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-12">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">Confirm Your Identity</h1>
          <p className="text-blue-100">Complete the form below to verify your attendance details</p>
          {info?.event && <p className="text-blue-200 text-sm mt-3 font-medium">📍 {info.event.name}</p>}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 space-y-6">
          
          {/* Personal Information Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-blue-600">👤</span> Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input 
                  required 
                  value={form.fullName} 
                  onChange={e => setForm(f => ({...f, fullName: e.target.value}))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your full name as per ID document"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                <input 
                  type="email" 
                  required 
                  value={form.email} 
                  onChange={e => setForm(f => ({...f, email: e.target.value}))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number {info?.event?.settings?.communicationChannels?.sms ? '*' : '(Optional)'}
                </label>
                <input 
                  value={form.phone} 
                  onChange={e => setForm(f => ({...f, phone: e.target.value}))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 234 567 8900"
                  required={info?.event?.settings?.communicationChannels?.sms}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {info?.event?.settings?.communicationChannels?.sms 
                    ? 'Required for SMS notifications' 
                    : 'International format: +[country code][number]'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                <input 
                  value={form.nationality} 
                  onChange={e => setForm(f => ({...f, nationality: e.target.value}))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Sri Lankan"
                />
              </div>
            </div>
          </div>

          {/* Identification Section */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-blue-600">🆔</span> Identification (Optional)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">National ID / NIC (Optional)</label>
                <input 
                  value={form.nationalId} 
                  onChange={e => setForm(f => ({...f, nationalId: e.target.value}))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your National ID number"
                />
                <p className="text-xs text-gray-500 mt-1">Your National Identity Card number</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Passport Number (Optional)</label>
                <input 
                  value={form.passportNumber} 
                  onChange={e => setForm(f => ({...f, passportNumber: e.target.value}))} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your passport number"
                />
                <p className="text-xs text-gray-500 mt-1">Your passport number if applicable</p>
              </div>
            </div>
          </div>

          {/* Date of Birth Section */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-blue-600">📅</span> Date of Birth
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth (Optional)</label>
              <input 
                type="date" 
                value={form.dateOfBirth} 
                onChange={e => setForm(f => ({...f, dateOfBirth: e.target.value}))} 
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Select your date of birth from the calendar</p>
            </div>
          </div>

          {/* Photo Upload Section */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-blue-600">📸</span> Verification Photo
            </h2>
            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6">
              <input 
                type="file" 
                accept="image/*" 
                onChange={e => setPhoto(e.target.files[0])} 
                className="w-full"
              />
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-gray-700">📋 Photo Requirements:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>✓ Clear photo of your face</li>
                  <li>✓ Good lighting, face fully visible</li>
                  <li>✓ JPG or PNG format</li>
                  <li>✓ Will be verified by event staff</li>
                </ul>
              </div>
              {photo && <p className="text-sm text-green-600 mt-3">✓ {photo.name} selected</p>}
            </div>
          </div>

          {/* Submit Button */}
          <div className="border-t pt-6 flex gap-3">
            <Button type="submit" className="w-full" loading={submitting}>
              Confirm My Identity
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Your information is secure and will only be used for event verification purposes.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AttendeeConfirmPage;
