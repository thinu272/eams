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
  KeyIcon,
  CameraIcon,
  TrashIcon,
  QrCodeIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

const BuyerProfilePage = () => {
  const { user, loadUser } = useAuth();

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

  const [ordersCount, setOrdersCount] = useState(0);
  const [passesCount, setPassesCount] = useState(0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPwd, setUpdatingPwd] = useState(false);

  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [mfaTokenInput, setMfaTokenInput] = useState('');
  const [submittingMfa, setSubmittingMfa] = useState(false);

  const [mfaDeactivateOpen, setMfaDeactivateOpen] = useState(false);
  const [deactivateTokenInput, setDeactivateTokenInput] = useState('');

  const initialValues = useMemo(
    () => ({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    }),
    [user]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, buyerRes, userRes] = await Promise.all([
        api
          .get('/user/profile')
          .catch(() => ({ data: { data: { user: initialValues } } })),
        getBuyerTickets().catch(() => ({ data: { data: { orders: [] } } })),
        api
          .get('/user/tickets')
          .catch(() => ({ data: { data: { tickets: [] } } })),
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
      await api.put('/user/profile', {
        name: form.name,
        email: form.email,
        phone: form.phone,
      });
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
        setExtraInfo((prev) => ({
          ...prev,
          profilePhoto: res.data.data?.url,
        }));
        toast.success('Profile picture updated!', { id: 'photo-upload' });
        await loadUser?.();
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || 'Failed to upload photo',
        { id: 'photo-upload' }
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

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
      setPwdForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update password');
    } finally {
      setUpdatingPwd(false);
    }
  };

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
    } catch {
      toast.error('Failed to retrieve MFA configurations');
    } finally {
      setSubmittingMfa(false);
    }
  };

  const handleActivateMfa = async (e) => {
    e.preventDefault();
    if (!mfaTokenInput.trim()) {
      toast.error('Please input your 6-digit authenticator code.');
      return;
    }
    try {
      setSubmittingMfa(true);
      const res = await api.post('/auth/mfa/activate', {
        token: mfaTokenInput,
      });
      if (res.data?.success) {
        toast.success('MFA enabled on your account!');
        setMfaModalOpen(false);
        setMfaSetupData(null);
        await load();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Verification failed. Try again.'
      );
    } finally {
      setSubmittingMfa(false);
    }
  };

  const handleDeactivateMfa = async (e) => {
    e.preventDefault();
    if (!deactivateTokenInput.trim()) {
      toast.error('Code is required.');
      return;
    }
    try {
      setSubmittingMfa(true);
      const res = await api.post('/auth/mfa/deactivate', {
        token: deactivateTokenInput,
      });
      if (res.data?.success) {
        toast.success('MFA disabled successfully.');
        setMfaDeactivateOpen(false);
        setDeactivateTokenInput('');
        await load();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || 'Failed to deactivate MFA.'
      );
    } finally {
      setSubmittingMfa(false);
    }
  };

  const initials = form.name
    ? form.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'B';

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

  return (
    <BuyerLayout>
      <div className="space-y-5 sm:space-y-6 pb-16 sm:pb-20">
        {/* ── Profile header ── */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center text-center sm:text-left">
                <div className="relative group shrink-0">
                  {extraInfo.profilePhoto ? (
                    <img
                      src={extraInfo.profilePhoto}
                      alt="Profile"
                      className="h-16 w-16 rounded-2xl object-cover border border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-sm">
                      {initials}
                    </div>
                  )}
                  <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white shadow hover:bg-slate-800 transition">
                    <CameraIcon className="h-3.5 w-3.5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      {form.name || 'Buyer'}
                    </h1>
                    {extraInfo.isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircleSolid className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                        Pending Verification
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Registered Buyer · ID:{' '}
                    {user?._id?.substring(0, 8) || '—'}…
                  </p>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Member since
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-700">
                  {extraInfo.createdAt
                    ? new Date(extraInfo.createdAt).toLocaleDateString(
                        undefined,
                        {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }
                      )
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {success && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3.5">
            <CheckCircleSolid className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-900">
              Profile settings saved successfully.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3.5">
            <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-rose-600" />
            <p className="text-sm font-semibold text-rose-900">{error}</p>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Left: forms */}
          <div className="lg:col-span-2 space-y-5">
            {/* Personal details */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5"
            >
              <h2 className="text-base font-bold text-slate-900">
                Personal Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Full Name
                  </label>
                  <div className="relative mt-1.5">
                    <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Email Address
                    </label>
                    <div className="relative mt-1.5">
                      <EnvelopeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Phone Number
                    </label>
                    <div className="relative mt-1.5">
                      <PhoneIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="+947XXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {saving ? 'Saving…' : 'Save Details'}
                </button>
              </div>
            </form>

            {/* Change password */}
            <form
              onSubmit={handlePasswordUpdate}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-5"
            >
              <h2 className="text-base font-bold text-slate-900">
                Change Password
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Current Password
                  </label>
                  <div className="relative mt-1.5">
                    <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={pwdForm.currentPassword}
                      onChange={(e) =>
                        setPwdForm((p) => ({
                          ...p,
                          currentPassword: e.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      New Password
                    </label>
                    <div className="relative mt-1.5">
                      <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={pwdForm.newPassword}
                        onChange={(e) =>
                          setPwdForm((p) => ({
                            ...p,
                            newPassword: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Min. 8 characters"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Confirm Password
                    </label>
                    <div className="relative mt-1.5">
                      <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="password"
                        value={pwdForm.confirmPassword}
                        onChange={(e) =>
                          setPwdForm((p) => ({
                            ...p,
                            confirmPassword: e.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Match password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={updatingPwd}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
                >
                  <KeyIcon className="h-4 w-4" />
                  {updatingPwd ? 'Updating…' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Right: security + stats */}
          <div className="space-y-5">
            {/* MFA */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ShieldCheckIcon className="h-5 w-5" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Two-Factor Auth
                </p>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Protect your account with a 6-digit code from Google or
                Microsoft Authenticator.
              </p>

              {extraInfo.mfaEnabled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
                    <CheckCircleSolid className="h-4 w-4 shrink-0 text-emerald-600" />
                    MFA is enabled
                  </div>
                  <button
                    type="button"
                    onClick={() => setMfaDeactivateOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Disable Authenticator
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                    <InformationCircleIcon className="h-4 w-4 shrink-0 text-amber-600" />
                    MFA is disabled
                  </div>
                  <button
                    type="button"
                    onClick={handleSetupMfa}
                    disabled={submittingMfa}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
                  >
                    <QrCodeIcon className="h-4 w-4" />
                    Configure Authenticator
                  </button>
                </div>
              )}
            </div>

            {/* Account overview */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Account Overview
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <ShoppingBagIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Orders Placed
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {ordersCount} Orders
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <TicketIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Active Passes
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {passesCount} Passes
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Session */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 shadow-sm space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Session
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Role</span>
                <span className="font-semibold text-slate-900">
                  Ticket Buyer
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Last login</span>
                <span className="font-medium text-slate-700 text-right">
                  {extraInfo.lastLogin
                    ? new Date(extraInfo.lastLogin).toLocaleString()
                    : 'Just now'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup MFA Modal */}
      <Modal
        open={mfaModalOpen}
        onClose={() => {
          setMfaModalOpen(false);
          setMfaSetupData(null);
        }}
        title="Setup Authenticator (2FA)"
        size="md"
      >
        {mfaSetupData && (
          <form onSubmit={handleActivateMfa} className="space-y-4 p-2 text-center">
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              Scan the QR code with Google Authenticator, Authy, or Duo.
            </p>

            <div className="inline-block rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <img
                src={mfaSetupData.qrImage}
                alt="Authenticator QR"
                className="mx-auto h-44 w-44"
              />
            </div>

            <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Manual Setup Key
              </p>
              <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-800 select-all">
                {mfaSetupData.secret}
              </p>
            </div>

            <div className="mx-auto max-w-xs space-y-2 text-left pt-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Verification Code
              </label>
              <input
                value={mfaTokenInput}
                onChange={(e) => setMfaTokenInput(e.target.value)}
                maxLength={6}
                placeholder="6-digit code"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center text-sm font-bold tracking-[0.25em] text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="mx-auto flex max-w-xs gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMfaModalOpen(false);
                  setMfaSetupData(null);
                }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingMfa}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition"
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
        onClose={() => {
          setMfaDeactivateOpen(false);
          setDeactivateTokenInput('');
        }}
        title="Disable Authenticator"
        size="sm"
      >
        <form onSubmit={handleDeactivateMfa} className="space-y-4 p-2">
          <p className="text-center text-sm text-slate-600">
            Enter the 6-digit code from your authenticator app to disable 2FA.
          </p>

          <div className="mx-auto max-w-xs">
            <input
              value={deactivateTokenInput}
              onChange={(e) => setDeactivateTokenInput(e.target.value)}
              maxLength={6}
              placeholder="6-digit code"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-center text-sm font-bold tracking-[0.25em] text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="mx-auto flex max-w-xs gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setMfaDeactivateOpen(false);
                setDeactivateTokenInput('');
              }}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingMfa}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50 transition"
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