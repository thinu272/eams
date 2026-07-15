import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, CalendarIcon, MapPinIcon, PhotoIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import BuyerLayout from '../../components/layout/BuyerLayout';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PhotoValidationFeedback from '../../components/shared/PhotoValidationFeedback';
import { usePhotoAiValidation } from '../../hooks/usePhotoAiValidation';
import api from '../../api/client';
import { assignSelfToTicket } from '../../api/buyer';
import { useAuth } from '../../context/AuthContext';

const BuyerConfirmPassPage = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const {
    validationErrors,
    allowOverride,
    setAllowOverride,
    qualityAnalysis,
    faceAnalysis,
    validating,
    validateFile,
    appendValidationToFormData,
    canSubmitPhoto,
    modelLoadFailed,
    imageRef,
    overlayRef,
  } = usePhotoAiValidation();
  const [form, setForm] = useState({
    fullName: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: '',
    nationalId: '',
    passportNumber: '',
    nationality: '',
    photo: null,
  });

  useEffect(() => {
    let active = true;

    const loadTicket = async () => {
      try {
        const { data } = await api.get(`/user/ticket/${ticketId}`);
        if (!active) return;
        const loadedTicket = data?.data?.ticket;
        setTicket(loadedTicket);
        setForm((prev) => ({
          ...prev,
          fullName: loadedTicket?.attendee?.fullName || user?.name || prev.fullName,
          phone: loadedTicket?.attendee?.phone || user?.phone || prev.phone,
        }));
      } catch (err) {
        toast.error(err?.response?.data?.message || 'Unable to load this pass.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTicket();
    return () => {
      active = false;
    };
  }, [ticketId, user?.name, user?.phone]);

  const requiresPhoto = !!ticket?.event?.requirePhotoVerification;
  const eventDate = useMemo(() => {
    if (!ticket?.event?.startDate) return 'Date TBD';
    return new Date(ticket.event.startDate).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [ticket?.event?.startDate]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await validateFile(file);
    setForm((prev) => ({ ...prev, photo: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.fullName.trim()) return toast.error('Full name is required.');
    if (requiresPhoto && !form.photo && !ticket?.attendee?.photo) {
      return toast.error('A photo is required for this event.');
    }
    if (form.photo && !canSubmitPhoto(true)) {
      return toast.error('Please fix photo validation issues or allow override.');
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('fullName', form.fullName.trim());
      if (form.phone) payload.append('phone', form.phone.trim());
      if (form.dateOfBirth) payload.append('dateOfBirth', form.dateOfBirth);
      if (form.nationalId) payload.append('nationalId', form.nationalId.trim());
      if (form.passportNumber) payload.append('passportNumber', form.passportNumber.trim());
      if (form.nationality) payload.append('nationality', form.nationality.trim());
      if (form.photo) {
        payload.append('photo', form.photo);
        appendValidationToFormData(payload);
      }

      await assignSelfToTicket(ticketId, payload);
      toast.success(requiresPhoto ? 'Pass submitted for photo verification.' : 'Pass confirmed successfully.');
      navigate('/buyer/home');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to confirm pass.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <BuyerLayout>
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </BuyerLayout>
    );
  }

  if (!ticket) {
    return (
      <BuyerLayout>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Pass not found</h1>
          <p className="mt-2 text-sm text-slate-500">This pass may no longer be available for your account.</p>
          <Link to="/buyer/home" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link to="/buyer/home" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Confirm Pass</p>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{ticket.event?.name || 'Event pass'}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Ticket #{ticket.ticketNumber}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              {ticket.categoryName || 'Standard'}
            </div>
          </div>

          <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-blue-600" />
              <span>{eventDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 text-blue-600" />
              <span>{ticket.event?.venue?.name || 'Venue TBD'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Your details</h2>
              <p className="text-sm text-slate-500">These details will be attached to this entry pass.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name *" value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} required />
            <Input label="Email" value={user?.email || ''} disabled />
            <Input label="Phone Number" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="+94771234567" />
            <Input label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))} />
            <Input label="National ID / NIC" value={form.nationalId} onChange={(e) => setForm((prev) => ({ ...prev, nationalId: e.target.value }))} />
            <Input label="Passport Number" value={form.passportNumber} onChange={(e) => setForm((prev) => ({ ...prev, passportNumber: e.target.value }))} />
            <Input label="Nationality" value={form.nationality} onChange={(e) => setForm((prev) => ({ ...prev, nationality: e.target.value }))} />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
              <PhotoIcon className="h-4 w-4 text-blue-600" />
              Verification Photo {requiresPhoto ? '*' : ''}
            </label>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handlePhotoChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-2 text-xs text-slate-500">
              {requiresPhoto ? 'This event requires a clear face photo before the QR pass can be activated.' : 'Optional, but useful for faster event verification.'}
            </p>
            {photoPreview && (
              <div className="relative mt-4 inline-block">
                <img
                  ref={imageRef}
                  src={photoPreview}
                  alt="Selected preview"
                  className="h-36 w-36 rounded-2xl border border-slate-200 object-cover"
                />
                <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-36 w-36 rounded-2xl" />
              </div>
            )}
            {form.photo && (
              <PhotoValidationFeedback
                validationErrors={validationErrors}
                qualityAnalysis={qualityAnalysis}
                faceAnalysis={faceAnalysis}
                allowOverride={allowOverride}
                onAllowOverrideChange={setAllowOverride}
                modelLoadFailed={modelLoadFailed}
                validating={validating}
              />
            )}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/buyer/home')}>Cancel</Button>
            <Button type="submit" loading={submitting}>Confirm Pass</Button>
          </div>
        </form>
      </div>
    </BuyerLayout>
  );
};

export default BuyerConfirmPassPage;
