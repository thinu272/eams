import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getBuyerTickets } from '../../api/buyer';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  TicketIcon,
  CalendarDaysIcon,
  KeyIcon,
  CameraIcon,
  TrashIcon,
  ArrowRightIcon,
  QrCodeIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

const BuyerProfilePage = () => {
  const { user, loadUser } = useAuth();
  
  // State variables
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [extraInfo, setExtraInfo] = useState({
    isVerified: false,
    createdAt: null,
    lastLogin: null,
    mfaEnabled: false,
    profilePhoto: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // Dashboard metrics
  const [ordersCount, setOrdersCount] = useState(0);
  const [passesCount, setPassesCount] = useState(0);

  // Photo uploading states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Password update form states
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [updatingPwd, setUpdatingPwd] = useState(false);

  // MFA modals state
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null); // qrImage, secret
  const [mfaTokenInput, setMfaTokenInput] = useState('');
  const [submittingMfa, setSubmittingMfa] = useState(false);

  const [mfaDeactivateOpen, setMfaDeactivateOpen] = useState(false);
  const [deactivateTokenInput, setDeactivateTokenInput] = useState('');

  const initialValues = useMemo(() => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  }), [user]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [profileRes, buyerRes, userRes] = await Promise.all([
        api.get('/user/profile').catch(() => ({ data: { data: { user: initialValues } } })),
        getBuyerTickets().catch(() => ({ data: { data: { orders: [] } } })),
        api.get('/user/tickets').catch(() => ({ data: { data: { tickets: [] } } }))
      ]);

      const profile = profileRes.data?.data?.user || initialValues;
      setForm({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      });

      setExtraInfo({
        isVerified: !!profile.isVerified,
        createdAt: profile.createdAt || null,
        lastLogin: profile.lastLogin || null,
        mfaEnabled: !!profile.mfaEnabled,
        profilePhoto: profile.profilePhoto || null,
      });

      setOrdersCount(buyerRes.data?.data?.orders?.length || 0);
      setPassesCount(userRes.data?.data?.tickets?.length || 0);
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
      setForm(initialValues);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [initialValues]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.name.trim()) return 'Name is required.';
    if (!form.email.trim()) return 'Email is required.';
    if (!form.phone.trim()) return 'Phone is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) return 'Please enter a valid email address.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      await api.put('/user/profile', { name: form.name, email: form.email, phone: form.phone });
      await loadUser?.();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      toast.success('Profile updated successfully!');
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  // Profile Picture Upload Handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setUploadingPhoto(true);
      toast.loading('Uploading profile picture...', { id: 'photo-upload' });
      const res = await api.post('/upload/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setExtraInfo(prev => ({ ...prev, profilePhoto: res.data.data?.url }));
        toast.success('Profile picture updated!', { id: 'photo-upload' });
        await loadUser?.();
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to upload photo', { id: 'photo-upload' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Change Password Handler
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!pwdForm.currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long.');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error('Confirm password does not match.');
      return;
    }

    try {
      setUpdatingPwd(true);
      await api.patch('/auth/update-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success('Password updated successfully!');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdatingPwd(false);
    }
  };

  // Setup MFA - fetch setup key
  const handleSetupMfa = async () => {
    try {
      setSubmittingMfa(true);
      const res = await api.post('/auth/mfa/setup');
      if (res.data?.success) {
        setMfaSetupData({
          qrImage: res.data.qrImage,
          secret: res.data.secret,
        });
        setMfaTokenInput('');
        setMfaModalOpen(true);
      }
    } catch (err) {
      toast.error('Failed to retrieve MFA configurations');
    } finally {
      setSubmittingMfa(false);
    }
  };

  // Activate MFA - confirm code
  const handleActivateMfa = async (e) => {
    e.preventDefault();
    if (!mfaTokenInput.trim()) {
      toast.error('Please input your 6-digit authenticator code.');
      return;
    }
    try {
      setSubmittingMfa(true);
      const res = await api.post('/auth/mfa/activate', { token: mfaTokenInput });
      if (res.data?.success) {
        toast.success('MFA enabled on your account!');
        setMfaModalOpen(false);
        setMfaSetupData(null);
        await load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Verification failed. Try again.');
    } finally {
      setSubmittingMfa(false);
    }
  };

  // Disable MFA
  const handleDeactivateMfa = async (e) => {
    e.preventDefault();
    if (!deactivateTokenInput.trim()) {
      toast.error('Code is required.');
      return;
    }
    try {
      setSubmittingMfa(true);
      const res = await api.post('/auth/mfa/deactivate', { token: deactivateTokenInput });
      if (res.data?.success) {
        toast.success('MFA disabled successfully.');
        setMfaDeactivateOpen(false);
        setDeactivateTokenInput('');
        await load();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to deactivate MFA.');
    } finally {
      setSubmittingMfa(false);
    }
  };

  const initials = form.name
    ? form.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'B';

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* Profile Heading Card with Avatar Upload */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group">
              {extraInfo.profilePhoto ? (
                <img
                  src={extraInfo.profilePhoto}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border border-slate-200 shadow"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-main/10 border border-brand-main/20 flex items-center justify-center text-brand-main font-extrabold text-2xl shadow-inner">
                  {initials}
                </div>
              )}
              <label className="absolute bottom-0 right-0 p-1.5 bg-slate-950/70 hover:bg-slate-900 text-white rounded-full cursor-pointer transition-colors shadow">
                <CameraIcon className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
              </label>
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">{form.name}</h2>
                {extraInfo.isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                    <CheckCircleSolid className="h-3 w-3" /> Verified Account
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                    Pending Verification
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Registered Buyer • ID: {user?._id?.substring(0, 8)}...
              </p>
            </div>
          </div>
          
          <div className="flex flex-col text-center md:text-right gap-0.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
            <span>Member since</span>
            <span className="text-slate-700 font-extrabold text-sm lowercase mt-0.5">
              {extraInfo.createdAt ? new Date(extraInfo.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {success && (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-3">
              <CheckCircleSolid className="h-5 w-5 text-emerald-700" />
              <p className="text-sm font-semibold text-emerald-900">Profile settings saved successfully.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-700" />
              <p className="text-sm font-semibold text-red-900">{error}</p>
            </div>
          </div>
        )}

        {/* 2-Column Desktop Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form Details (Takes 2/3 space) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Edit details form */}
            <form onSubmit={handleSubmit} className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-base font-extrabold text-slate-900">Personal Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                  <div className="relative mt-2">
                    <UserIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-brand-main focus:ring-2 focus:ring-brand-main/20 outline-none"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                    <div className="relative mt-2">
                      <EnvelopeIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-brand-main focus:ring-2 focus:ring-brand-main/20 outline-none"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Phone Number</label>
                    <div className="relative mt-2">
                      <PhoneIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-brand-main focus:ring-2 focus:ring-brand-main/20 outline-none"
                        placeholder="+947XXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-main hover:bg-brand-dark px-6 py-3 text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  <span>{saving ? 'Saving Changes…' : 'Save Details'}</span>
                </button>
              </div>
            </form>

            {/* Change Password Form */}
            <form onSubmit={handlePasswordUpdate} className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-base font-extrabold text-slate-900">Change Account Password</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</label>
                  <div className="relative mt-2">
                    <KeyIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={pwdForm.currentPassword}
                      onChange={(e) => setPwdForm(p => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-brand-main focus:ring-2 focus:ring-brand-main/20 outline-none"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">New Password</label>
                    <div className="relative mt-2">
                      <KeyIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={pwdForm.newPassword}
                        onChange={(e) => setPwdForm(p => ({ ...p, newPassword: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-brand-main focus:ring-2 focus:ring-brand-main/20 outline-none"
                        placeholder="Min. 8 characters"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</label>
                    <div className="relative mt-2">
                      <KeyIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={pwdForm.confirmPassword}
                        onChange={(e) => setPwdForm(p => ({ ...p, confirmPassword: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:border-brand-main focus:ring-2 focus:ring-brand-main/20 outline-none"
                        placeholder="Match password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={updatingPwd}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-main hover:bg-brand-dark px-6 py-3 text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <KeyIcon className="h-5 w-5" />
                  <span>{updatingPwd ? 'Updating…' : 'Change Password'}</span>
                </button>
              </div>
            </form>

          </div>

          {/* Right Column: Account Stats & Security Widgets (Takes 1/3 space) */}
          <div className="space-y-6">
            
            {/* MFA Security configuration card */}
            <div className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-brand-main" />
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Two-Factor Auth (MFA)</h3>
              </div>
              
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Add an extra layer of protection to your entry tickets. Once activated, logins will require a 6-digit dynamic code from Google/Microsoft Authenticator app.
              </p>
              
              {extraInfo.mfaEnabled ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold">
                    <CheckCircleSolid className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                    <span>MFA is currently ENABLED.</span>
                  </div>
                  <button
                    onClick={() => setMfaDeactivateOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 hover:bg-rose-50 text-rose-700 px-4 py-2.5 text-xs font-bold transition-all"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>Disable Authenticator</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-xs font-semibold">
                    <InformationCircleIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <span>MFA is currently disabled.</span>
                  </div>
                  <button
                    onClick={handleSetupMfa}
                    disabled={submittingMfa}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <QrCodeIcon className="h-4 w-4" />
                    <span>Configure Authenticator</span>
                  </button>
                </div>
              )}
            </div>

            {/* Account Activity Stats */}
            <div className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Account Overview</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <ShoppingBagIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Orders Placed</p>
                    <p className="text-base font-extrabold text-slate-900">{ordersCount} Orders</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Active passes</p>
                    <p className="text-base font-extrabold text-slate-900">{passesCount} Passes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Session info */}
            <div className="rounded-[32px] bg-slate-900 p-6 text-white shadow-sm border border-slate-800 space-y-3 text-xs">
              <p className="font-extrabold text-blue-400 uppercase tracking-widest text-[10px]">Session Logs</p>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="font-bold">Ticket Buyer</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last login:</span>
                <span className="font-semibold text-slate-300">
                  {extraInfo.lastLogin ? new Date(extraInfo.lastLogin).toLocaleString() : 'Just now'}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Setup MFA Modal */}
      <Modal
        open={mfaModalOpen}
        onClose={() => { setMfaModalOpen(false); setMfaSetupData(null); }}
        title="Setup Authenticator (2FA)"
        size="md"
      >
        {mfaSetupData && (
          <form onSubmit={handleActivateMfa} className="space-y-4 p-4 text-center">
            <p className="text-xs text-slate-600 max-w-sm mx-auto">
              Scan the QR code below using your favorite TOTP app (like Google Authenticator, Authy, or Duo).
            </p>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <img
                src={mfaSetupData.qrImage}
                alt="Authenticator QR"
                className="mx-auto w-44 h-44"
              />
            </div>

            <div className="text-left bg-slate-50 p-3 rounded-xl border border-slate-200 max-w-sm mx-auto">
              <p className="text-[10px] font-black uppercase text-slate-400">Manual Setup Key</p>
              <p className="font-mono text-xs text-slate-800 font-semibold break-all select-all mt-1">{mfaSetupData.secret}</p>
            </div>

            <div className="max-w-xs mx-auto space-y-2 text-left pt-2">
              <label className="block text-xs font-bold text-slate-500 uppercase">Verification Code</label>
              <input
                value={mfaTokenInput}
                onChange={(e) => setMfaTokenInput(e.target.value)}
                maxLength={6}
                placeholder="6-digit code"
                className="w-full text-center tracking-[0.25em] font-extrabold rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm focus:border-brand-main focus:ring-1 focus:ring-brand-main outline-none"
              />
            </div>

            <div className="pt-4 flex gap-3 max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => { setMfaModalOpen(false); setMfaSetupData(null); }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingMfa}
                className="flex-1 rounded-xl bg-brand-main hover:bg-brand-dark py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
              >
                {submittingMfa ? 'Confirming…' : 'Activate 2FA'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Disable MFA Modal */}
      <Modal
        open={mfaDeactivateOpen}
        onClose={() => { setMfaDeactivateOpen(false); setDeactivateTokenInput(''); }}
        title="Disable Authenticator"
        size="sm"
      >
        <form onSubmit={handleDeactivateMfa} className="space-y-4 p-4">
          <p className="text-xs text-slate-600 text-center">
            Please enter the 6-digit code from your authenticator app to disable Two-Factor Authentication.
          </p>

          <div className="space-y-2 max-w-xs mx-auto pt-2">
            <input
              value={deactivateTokenInput}
              onChange={(e) => setDeactivateTokenInput(e.target.value)}
              maxLength={6}
              placeholder="6-digit code"
              className="w-full text-center tracking-[0.25em] font-extrabold rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs focus:border-brand-main focus:ring-1 focus:ring-brand-main outline-none"
            />
          </div>

          <div className="pt-4 flex gap-3 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => { setMfaDeactivateOpen(false); setDeactivateTokenInput(''); }}
              className="flex-1 rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingMfa}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              {submittingMfa ? 'Disabling…' : 'Disable'}
            </button>
          </div>
        </form>
      </Modal>

    </BuyerLayout>
  );
};

export default BuyerProfilePage;
