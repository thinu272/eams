import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDaysIcon, CheckBadgeIcon, MapPinIcon, TicketIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { confirmInvite, getInviteInfo, respondToInvite } from '../../api/attendees';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const phoneRegex = /^\+947\d{8}$/;

const formatVenue = (venue) => {
  if (!venue) return 'Venue will be announced';
  if (typeof venue === 'string') return venue;
  return [venue.name, venue.city, venue.address].filter(Boolean).join(', ');
};

const formatDate = (value) => {
  if (!value) return 'Date to be announced';
  return new Date(value).toLocaleString();
};

const InviteAcceptPage = () => {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState('preview');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nicPassport: '',
  });
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    getInviteInfo(token)
      .then((response) => {
        const payload = response.data?.data?.invite;
        setInvite(payload);
        if ((payload?.inviteStatus || 'PENDING') === 'ACCEPTED') {
          setStep('form');
        } else if (payload?.inviteStatus === 'DECLINED') {
          setStep('declined');
        } else {
          setStep('preview');
        }
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Invalid or expired invitation link');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const venueText = useMemo(() => formatVenue(invite?.eventVenue), [invite]);

  const handleRespond = async (response) => {
    setResponding(true);
    try {
      const { data } = await respondToInvite({ token, response });
      setInvite((current) => ({
        ...current,
        inviteStatus: data?.data?.inviteStatus || response,
        inviteRespondedAt: data?.data?.respondedAt || new Date().toISOString(),
      }));
      if (response === 'ACCEPTED') {
        setStep('form');
        toast.success('Invitation accepted. Please complete your details.');
      } else {
        setStep('declined');
        toast.success('Invitation declined.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to record your response.');
    } finally {
      setResponding(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName || !form.nicPassport || !form.phone || !form.dateOfBirth) {
      return toast.error('Name, ID, phone, and date of birth are required');
    }
    if (!phoneRegex.test(form.phone.trim())) {
      return toast.error('Use Sri Lanka format: +947XXXXXXXX');
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('token', token);
      fd.append('fullName', form.fullName);
      fd.append('nicPassport', form.nicPassport);
      fd.append('phone', form.phone);
      fd.append('dateOfBirth', form.dateOfBirth);
      if (form.email) fd.append('email', form.email);
      if (photo) fd.append('photo', photo);

      await confirmInvite(fd);
      setDone(true);
      toast.success('Invite accepted and identity confirmed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm invite.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckBadgeIcon className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-slate-900">Invitation Accepted</h2>
          <p className="mt-3 text-sm text-slate-500">
            Your details have been submitted successfully. You’ll receive the final ticket confirmation shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#e2e8f0)] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
          <div className="bg-slate-950 px-8 py-10 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">Event Invitation</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">{invite?.eventName || 'Invitation'}</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">You have been invited to this event.</p>
          </div>

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <CalendarDaysIcon className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Event Date</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{formatDate(invite?.eventStartDate)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <MapPinIcon className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Venue</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{venueText}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <TicketIcon className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ticket Category</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{invite?.categoryName || 'N/A'}</p>
                  </div>
                </div>
              </div>
              {invite?.inviteExpiresAt && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  Invitation expires on {new Date(invite.inviteExpiresAt).toLocaleString()}.
                </div>
              )}
            </div>

            <div>
              {step === 'preview' && (
                <div className="rounded-3xl border border-slate-200 p-6">
                  <h2 className="text-2xl font-bold text-slate-900">Review Invitation</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Accept this invitation to continue to the attendee confirmation form. If you decline, the organiser can reassign the ticket later.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Button className="flex-1 justify-center" loading={responding} onClick={() => handleRespond('ACCEPTED')}>
                      Accept Invitation
                    </Button>
                    <button
                      type="button"
                      disabled={responding}
                      onClick={() => handleRespond('DECLINED')}
                      className="flex-1 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {step === 'declined' && (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                    <XCircleIcon className="h-8 w-8 text-red-600" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold text-slate-900">Invitation Declined</h2>
                  <p className="mt-3 text-sm text-slate-600">You have declined this invitation.</p>
                  <button
                    type="button"
                    onClick={() => handleRespond('ACCEPTED')}
                    className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Change to Accept
                  </button>
                </div>
              )}

              {step === 'form' && (
                <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 p-6">
                  <h2 className="text-2xl font-bold text-slate-900">Complete Attendee Details</h2>
                  <p className="mt-2 text-sm text-slate-500">Fill in your information to confirm this invitation.</p>

                  <div className="mt-6 space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
                      <input value={form.fullName} onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))} required className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                      <input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Phone *</label>
                      <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">NIC / Passport *</label>
                      <input value={form.nicPassport} onChange={(e) => setForm((current) => ({ ...current, nicPassport: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Date of Birth *</label>
                      <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((current) => ({ ...current, dateOfBirth: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Upload Photo</label>
                      <input type="file" accept="image/jpeg,image/png" onChange={(e) => setPhoto(e.target.files?.[0] || null)} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm" />
                      <p className="mt-1 text-xs text-slate-500">Optional but recommended for entry verification.</p>
                    </div>
                  </div>

                  <Button type="submit" className="mt-6 w-full justify-center" loading={submitting}>
                    Submit Confirmation
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
