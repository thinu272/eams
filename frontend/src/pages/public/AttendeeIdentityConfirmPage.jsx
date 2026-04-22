import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckBadgeIcon, ShieldCheckIcon, UserPlusIcon, PhotoIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getConfirmInviteInfo, submitConfirmInviteDetails } from '../../api/confirm';

const AttendeeIdentityConfirmPage = () => {
  const { inviteToken } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    photo: null,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getConfirmInviteInfo(inviteToken);
        const data = response.data.data;
        setInviteInfo(data);
        setForm((prev) => ({
          ...prev,
          fullName: data?.attendee?.fullName || '',
          email: data?.attendee?.email || prev.email,
          phone: data?.attendee?.phone || prev.phone,
        }));
      } catch (err) {
        // toast.error(err?.response?.data?.message || 'Failed to load invite details.');
      } finally {
        setLoading(false);
      }
    };

    if (inviteToken) load();
  }, [inviteToken]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName || !form.idNumber || !form.dateOfBirth || !form.email || !form.phone) {
      toast.error('Please fill all required fields.');
      return;
    }

    if (!form.photo) {
      toast.error('Please upload an identity verification photo.');
      return;
    }

    const payload = new FormData();
    payload.append('fullName', form.fullName);
    payload.append('idNumber', form.idNumber);
    payload.append('dateOfBirth', form.dateOfBirth);
    payload.append('email', form.email);
    payload.append('phone', form.phone);
    payload.append('photo', form.photo);

    setSubmitting(true);
    try {
      await submitConfirmInviteDetails(inviteToken, payload);
      setSubmitted(true);
      toast.success('Identity details submitted for verification.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
           <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">Verifying Secure Link...</p>
           </div>
        </div>
      </PublicLayout>
    );
  }

  if (!inviteInfo) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 mb-8">
             <InformationCircleIcon className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black text-slate-950 uppercase tracking-tight">Access Link Invalid</h1>
          <p className="mt-6 text-lg text-slate-500 font-medium max-w-2xl mx-auto">This invitation link has expired, been revoked, or already successfully used.</p>
        </div>
      </PublicLayout>
    );
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-8">
             <CheckBadgeIcon className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black text-slate-950 uppercase tracking-tight">Submission Received</h1>
          <p className="mt-6 text-lg text-slate-500 font-medium max-w-2xl mx-auto">Your identity details are under verification. You'll receive your final entry QR code via Email and SMS once approved.</p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-24">
        {/* Profile Header */}
        <div className="h-80 bg-slate-950 px-4 pt-16 sm:px-6 lg:px-8">
           <div className="mx-auto max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-500 mb-4">Identity Verification</p>
              <h1 className="text-4xl font-black text-white uppercase tracking-tight sm:text-6xl">
                 Secure Attendance
              </h1>
              <p className="mt-6 text-lg text-slate-400 font-medium">
                 Confirming entry for <span className="text-white font-bold">{inviteInfo.event?.name}</span>
              </p>
           </div>
        </div>

        <div className="relative mx-auto -mt-16 max-w-4xl px-4 sm:px-6 lg:px-8">
           <form onSubmit={handleSubmit} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="bg-slate-900 px-8 py-6">
                 <h2 className="flex items-center gap-3 text-xl font-black uppercase tracking-wide text-white">
                    <ShieldCheckIcon className="h-6 w-6 text-blue-500" />
                    Attendee Profile Form
                 </h2>
              </div>
              
              <div className="p-8 lg:p-12 space-y-10">
                 <div className="grid gap-8 lg:grid-cols-2">
                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Identity Name *</label>
                          <input
                            type="text"
                            value={form.fullName}
                            onChange={(e) => handleChange('fullName', e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-50 focus:bg-white focus:outline-none focus:border-blue-500"
                            placeholder="Current full name"
                            required
                          />
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NIC / Passport Number *</label>
                          <input
                            type="text"
                            value={form.idNumber}
                            onChange={(e) => handleChange('idNumber', e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-50 focus:bg-white focus:outline-none focus:border-blue-500"
                            placeholder="For gate verification"
                            required
                          />
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Date of Birth *</label>
                          <input
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-50 focus:bg-white focus:outline-none focus:border-blue-500"
                            required
                          />
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Email *</label>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-50 focus:bg-white focus:outline-none focus:border-blue-500"
                            required
                          />
                       </div>

                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number *</label>
                          <input
                            type="tel"
                            value={form.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-5 py-4 font-bold text-slate-950 transition focus:border-blue-50 focus:bg-white focus:outline-none focus:border-blue-500"
                            placeholder="+947XXXXXXXX"
                            required
                          />
                       </div>

                       {/* Enhanced Photo Upload */}
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identity Photo (Selfie) *</label>
                          <label className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-500 hover:bg-blue-50 cursor-pointer group h-[132px]">
                              {form.photo ? (
                                  <div className="relative h-full w-full">
                                      <img 
                                          src={URL.createObjectURL(form.photo)} 
                                          alt="Preview" 
                                          className="h-full w-full rounded-xl object-cover shadow-md"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <PhotoIcon className="h-6 w-6 text-white" />
                                      </div>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center py-4">
                                      <UserPlusIcon className="h-8 w-8 text-slate-300 group-hover:text-blue-500 mb-2 transition-colors" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700 text-center">Tap to Upload Profile Photo</p>
                                  </div>
                              )}
                              <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleChange('photo', e.target.files?.[0] || null)}
                                  className="hidden"
                              />
                          </label>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 text-blue-600">
                        <CheckBadgeIcon className="h-5 w-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Secure Verification Link</span>
                    </div>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:w-auto rounded-full bg-slate-950 px-10 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-2xl transition hover:bg-blue-600 disabled:opacity-50 active:scale-95"
                    >
                        {submitting ? 'Authenticating...' : 'Confirm My Identity'}
                    </button>
                 </div>
              </div>
           </form>
        </div>
      </div>
    </PublicLayout>
  );
};

export default AttendeeIdentityConfirmPage;
