import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

const BuyerProfilePage = () => {
  const { user, loadUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const initialValues = useMemo(() => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  }), [user]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await api.get('/user/profile');
        const profile = data?.data?.user || initialValues;
        setForm({
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
        });
      } catch (err) {
        setError(err?.response?.data?.message || err.message);
        setForm(initialValues);
      } finally {
        setLoading(false);
      }
    };
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
    } catch (err) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BuyerLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
          <p className="mt-1 text-sm text-slate-600">Update your contact info for receipts and invites.</p>
        </div>

        {success && (
          <div className="rounded-3xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
            <div className="flex items-center gap-3">
              <CheckCircleSolid className="h-5 w-5 text-emerald-700" />
              <p className="text-sm font-semibold text-emerald-900">Saved.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-3xl bg-red-50 p-4 ring-1 ring-red-200">
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-700" />
              <p className="text-sm font-semibold text-red-900">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700">Name</label>
              <div className="relative mt-2">
                <UserIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Email</label>
              <div className="relative mt-2">
                <EnvelopeIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Phone</label>
              <div className="relative mt-2">
                <PhoneIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
                  placeholder="+1234567890"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                <CheckCircleIcon className="h-5 w-5" />
                <span>{saving ? 'Saving…' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </BuyerLayout>
  );
};

export default BuyerProfilePage;

