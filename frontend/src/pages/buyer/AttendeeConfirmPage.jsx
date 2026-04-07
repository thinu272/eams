import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getConfirmInfo, confirmIdentity } from '../../api/attendees';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const AttendeeConfirmPage = () => {
  const { token } = useParams();
  const phoneRegex = /^\+947\d{8}$/;
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
    if (form.phone && !phoneRegex.test(form.phone.trim())) return toast.error('Use Sri Lanka format: +947XXXXXXXX');
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-900 text-white py-10">
        <div className="max-w-xl mx-auto px-4">
          <h1 className="text-2xl font-bold">Confirm Your Identity</h1>
          {info?.event && <p className="text-blue-200 text-sm mt-1">{info.event.name}</p>}
        </div>
      </div>
      <div className="max-w-xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input required value={form.fullName} onChange={e => setForm(f => ({...f, fullName: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="As per NIC / Passport"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input type="email" required value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">National ID</label>
              <input value={form.nationalId} onChange={e => setForm(f => ({...f, nationalId: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passport Number</label>
              <input value={form.passportNumber} onChange={e => setForm(f => ({...f, passportNumber: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({...f, dateOfBirth: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
              <input value={form.nationality} onChange={e => setForm(f => ({...f, nationality: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo (for verification)</label>
              <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/>
              <p className="text-xs text-gray-400 mt-1">Clear photo of your face. Will be verified by event staff.</p>
            </div>
          </div>
          <Button type="submit" className="w-full" loading={submitting}>Confirm My Identity</Button>
        </form>
      </div>
    </div>
  );
};

export default AttendeeConfirmPage;
