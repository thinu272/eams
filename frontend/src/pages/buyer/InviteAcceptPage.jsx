import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDaysIcon, CheckBadgeIcon, MapPinIcon, TicketIcon } from '@heroicons/react/24/solid';
import { confirmInvite, getInviteInfo, respondToInvite } from '../../api/attendees';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';
import CameraCapture from '../../components/shared/CameraCapture';
import PhotoValidationFeedback from '../../components/shared/PhotoValidationFeedback';
import { usePhotoAiValidation } from '../../hooks/usePhotoAiValidation';
import { CameraIcon, PhotoIcon } from '@heroicons/react/24/outline';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

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
  const [showCamera, setShowCamera] = useState(false);
  const [preview, setPreview] = useState(null);
  const {
    validationErrors,
    allowOverride,
    setAllowOverride,
    qualityAnalysis,
    faceAnalysis,
    validating,
    validateFile,
    resetValidation,
    appendValidationToFormData,
    canSubmitPhoto,
    modelLoadFailed,
    imageRef,
    overlayRef,
  } = usePhotoAiValidation();

  useEffect(() => {
    getInviteInfo(token)
      .then((response) => {
        const payload = response.data?.data?.invite;
        setInvite(payload);

        if (payload?.attendee) {
          setForm({
            fullName: payload.attendee.fullName || '',
            email: payload.attendee.email || '',
            phone: payload.attendee.phone || '',
            dateOfBirth: payload.attendee.dateOfBirth ? payload.attendee.dateOfBirth.split('T')[0] : '',
            nicPassport: payload.attendee.nationalId || '',
          });
        }

        if ((payload?.inviteStatus || 'PENDING') === 'ACCEPTED') {
          setStep('form');
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

  const handleAccept = async () => {
    setResponding(true);
    try {
      const { data } = await respondToInvite({ token, response: 'ACCEPTED' });
      setInvite((current) => ({
        ...current,
        inviteStatus: data?.data?.inviteStatus || 'ACCEPTED',
        inviteRespondedAt: data?.data?.respondedAt || new Date().toISOString(),
      }));
      setStep('form');
      toast.success('Invitation accepted. Please complete your details.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to accept invitation.');
    } finally {
      setResponding(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName) {
      return toast.error('Full Name is required');
    }
    if (!form.email) {
      return toast.error('Email is required');
    }
    if (!photo) {
      return toast.error('Identity Verification Photo is required');
    }
    if (!canSubmitPhoto(true)) {
      return toast.error('Please fix photo validation issues or allow override.');
    }
    if (form.phone && !phoneRegex.test(form.phone.trim())) {
      return toast.error('Enter a valid international phone number (e.g. +1234567890)');
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
      appendValidationToFormData(fd);

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
                    Accept this invitation to continue to the attendee confirmation form and complete your entry details.
                  </p>
                  <div className="mt-8">
                    <Button className="w-full justify-center" loading={responding} onClick={handleAccept}>
                      Accept Invitation
                    </Button>
                  </div>
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
                      <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
                      <input type="email" value={form.email} readOnly className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-500 outline-none cursor-not-allowed" required />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                      <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" placeholder="+1234567890 (Optional)" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">NIC / Passport</label>
                      <input value={form.nicPassport} onChange={(e) => setForm((current) => ({ ...current, nicPassport: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" placeholder="(Optional)" />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Date of Birth</label>
                      <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((current) => ({ ...current, dateOfBirth: e.target.value }))} className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500" />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Identity Verification Photo *</label>
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <label className="flex-1 group relative flex h-[100px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-500 hover:bg-blue-50">
                            {photo ? (
                              <div className="relative h-full w-full">
                                <img ref={imageRef} src={preview} alt="Preview" className="h-full w-full rounded-xl object-cover shadow-md" />
                                <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100">
                                  <PhotoIcon className="h-6 w-6 text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <PhotoIcon className="mb-1 h-6 w-6 text-slate-300 transition-colors group-hover:text-blue-500" />
                                <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Upload</p>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              await validateFile(file);
                              setPhoto(file);
                              setPreview(URL.createObjectURL(file));
                            }} className="hidden" />
                          </label>

                          <button
                            type="button"
                            onClick={() => setShowCamera(true)}
                            className="flex-1 group relative flex h-[100px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-all hover:border-blue-500 hover:bg-blue-50"
                          >
                            <CameraIcon className="mb-1 h-6 w-6 text-slate-300 transition-colors group-hover:text-blue-500" />
                            <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Live Photo</p>
                          </button>
                        </div>

                        {showCamera && (
                          <CameraCapture 
                            onCapture={async (file) => {
                              await validateFile(file);
                              setPhoto(file);
                              setPreview(URL.createObjectURL(file));
                              setShowCamera(false);
                            }} 
                            onClose={() => setShowCamera(false)} 
                          />
                        )}
                      </div>
                      <PhotoValidationFeedback
                        validationErrors={validationErrors}
                        qualityAnalysis={qualityAnalysis}
                        faceAnalysis={faceAnalysis}
                        allowOverride={allowOverride}
                        onAllowOverrideChange={setAllowOverride}
                        modelLoadFailed={modelLoadFailed}
                        validating={validating}
                      />
                      <p className="mt-2 text-xs text-slate-500">Recommended for entry verification.</p>
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
