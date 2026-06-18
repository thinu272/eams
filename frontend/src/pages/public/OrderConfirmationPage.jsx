import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  CheckBadgeIcon, 
  ChevronDownIcon, 
  ChevronUpIcon, 
  EnvelopeIcon, 
  InformationCircleIcon, 
  PhoneIcon,
  TicketIcon, 
  UserPlusIcon 
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import PublicLayout from '../../components/layout/PublicLayout';
import { getBuyerOrderByToken, saveTicketAttendee, sendTicketInvite } from '../../api/orders';
import CameraCapture from '../../components/shared/CameraCapture';
import { CameraIcon } from '@heroicons/react/24/outline';

const OrderConfirmationPage = () => {
  const { token } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [inviteEmailByTicket, setInviteEmailByTicket] = useState({});
  const [invitePhoneByTicket, setInvitePhoneByTicket] = useState({});
  const [submittingTicketId, setSubmittingTicketId] = useState(null);
  const [formByTicket, setFormByTicket] = useState({});
  const [cameraTicketId, setCameraTicketId] = useState(null);

  const loadOrder = async () => {
    setLoading(true);
    try {
      console.log('OrderConfirmationPage: Loading order with token:', token);
      const response = await getBuyerOrderByToken(token);
      console.log('OrderConfirmationPage: API Response data:', response.data);
      setPayload(response.data.data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load this order confirmation link.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [token]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? 'TBD' : date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
    });
  };

  const isConfirmedTicket = (status) => status === 'ASSIGNED' || status === 'CONFIRMED' || status === 'INVITED';
  
  const getTicketStatusBadge = (status) => {
    switch (status) {
        case 'CONFIRMED':
        case 'ASSIGNED':
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-700 ring-1 ring-inset ring-blue-600/20">
                    <CheckCircleIcon className="h-4 w-4" /> Confirmed
                </span>
            );
        case 'INVITED':
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-sky-700 ring-1 ring-inset ring-sky-600/20">
                    <EnvelopeIcon className="h-4 w-4" /> Invited
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-500 ring-1 ring-inset ring-slate-600/20">
                    Pending
                </span>
            );
    }
  };

  const totalTickets = payload?.tickets?.length || 0;
  const confirmedCount = useMemo(
    () => (payload?.tickets || []).filter((ticket) => isConfirmedTicket(ticket.status)).length,
    [payload]
  );
  const progressPercentage = totalTickets > 0 ? (confirmedCount / totalTickets) * 100 : 0;

  const getForm = (ticketId) =>
    formByTicket[ticketId] || {
      fullName: '',
      nationalId: '',
      passportNumber: '',
      dateOfBirth: '',
      email: '',
      phone: '',
      photo: null,
    };

  const updateForm = (ticketId, key, value) => {
    setFormByTicket((prev) => ({
      ...prev,
      [ticketId]: {
        ...getForm(ticketId),
        [key]: value,
      },
    }));
  };

  const prefillBuyerDetails = (ticketId) => {
    const current = getForm(ticketId);
    const buyer = payload?.order || {};
    const next = {
      fullName: current.fullName || buyer.buyerName || '',
      email: current.email || buyer.buyerEmail || '',
      phone: current.phone || buyer.buyerPhone || '',
    };
    setFormByTicket((prev) => ({
      ...prev,
      [ticketId]: {
        ...current,
        ...next,
      },
    }));
  };

  const toggleTicketForm = (ticketId) => {
    if (expandedTicketId === ticketId) {
      setExpandedTicketId(null);
      return;
    }
    prefillBuyerDetails(ticketId);
    setExpandedTicketId(ticketId);
  };

  const handleFillSubmit = async (ticketId) => {
    const form = getForm(ticketId);
    if (!form.fullName || !form.email) {
      toast.error('Full name and email are required.');
      return;
    }
    if (!form.photo) {
      toast.error('Identity Verification Photo is required.');
      return;
    }

    const body = new FormData();
    body.append('fullName', form.fullName);
    body.append('nationalId', form.nationalId);
    body.append('passportNumber', form.passportNumber);
    body.append('dateOfBirth', form.dateOfBirth);
    body.append('email', form.email);
    body.append('phone', form.phone);
    if (form.photo) {
      body.append('photo', form.photo);
    }
    // Explicitly set ticketId
    body.append('ticketId', ticketId);

    setSubmittingTicketId(ticketId);
    try {
      await saveTicketAttendee(ticketId, body);
      toast.success('Attendee identity confirmed successfully!');
      setExpandedTicketId(null);
      await loadOrder();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save attendee details.');
    } finally {
      setSubmittingTicketId(null);
    }
  };

  const handleSendInvite = async (ticketId) => {
    const email = (inviteEmailByTicket[ticketId] || '').trim();
    const phone = (invitePhoneByTicket[ticketId] || '').trim();
    if (!email) {
      toast.error('Please enter an invite email address.');
      return;
    }

    if (payload?.smsEnabled && !phone) {
      toast.error('Please enter a phone number for SMS invite.');
      return;
    }

    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone.trim().replace(/\s+/g, ''))) {
      toast.error('Please enter a valid international phone number');
      return;
    }

    setSubmittingTicketId(ticketId);
    try {
      await sendTicketInvite(ticketId, { 
        email, 
        phone: phone || undefined, 
        notificationChannel: (payload?.smsEnabled && phone) ? 'both' : 'email' 
      });
      toast.success('Secure invite link sent via Email & SMS.');
      await loadOrder();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send invite.');
    } finally {
      setSubmittingTicketId(null);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
           <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-xl" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500">Retrieving Secure Link...</p>
           </div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !payload) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 mb-8">
             <InformationCircleIcon className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-black text-slate-950 uppercase tracking-tight">Security Check Failed</h1>
          <p className="mt-6 text-lg text-slate-500 font-medium max-w-2xl mx-auto">{error || 'This order link is no longer valid or has expired for security reasons.'}</p>
          <div className="mt-10">
            <Link
              to="/events"
              className="inline-flex rounded-full bg-slate-950 px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-blue-600"
            >
              Browse Public Events
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const { order, tickets } = payload;

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-slate-50 pb-24">
        {/* Profile Header */}
        <div className="h-80 bg-slate-950 px-4 pt-16 sm:px-6 lg:px-8">
           <div className="mx-auto max-w-7xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                 <div>
                    <p className="text-sm font-black uppercase tracking-[0.3em] text-blue-500 mb-4">Verification Portal</p>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight sm:text-6xl">
                       {order?.event?.name || 'Order Details'}
                    </h1>
                    <div className="mt-6 flex flex-wrap gap-4">
                        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 backdrop-blur">
                            Order #{order.orderNumber}
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 backdrop-blur">
                            Buyer: {order.buyerName}
                        </div>
                    </div>
                 </div>
                 
                 <div className="w-full lg:w-80">
                    <div className="mb-2 flex items-center justify-between font-black uppercase tracking-widest text-[10px] text-slate-400">
                        <span>Assignment Progress</span>
                        <span>{confirmedCount}/{totalTickets} Slots</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                        <div 
                           className="h-full bg-blue-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
                           style={{ width: `${progressPercentage}%` }} 
                        />
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div className="relative mx-auto -mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
           <div className="grid gap-8 lg:grid-cols-3">
              {/* Sidebar Info */}
              <div className="space-y-6">
                 <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                    <div className="bg-slate-900 px-6 py-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-blue-400">Order Information</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Event Date</p>
                            <p className="font-bold text-slate-900">{formatDate(payload?.order?.event?.startDate)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Venue</p>
                            <p className="font-bold text-slate-900">{payload?.order?.event?.venue?.name || 'TBD'}</p>
                        </div>
                        <div className="pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Total Investment</p>
                            <p className="text-xl font-black text-blue-700">{formatCurrency(payload?.order?.totalAmount)}</p>
                        </div>
                    </div>
                 </div>

                 <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
                    <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight text-blue-900 mb-3">
                        <InformationCircleIcon className="h-5 w-5" /> Important Note
                    </h4>
                    <p className="text-sm font-medium leading-relaxed text-blue-700">
                        Every ticket holder must have their identity confirmed to generate a valid entry QR. You can fill details yourself or delegate via email/SMS invites.
                    </p>
                 </div>
              </div>

              {/* Tickets Column */}
               <div className="lg:col-span-2 space-y-6">
                  {tickets.map((ticket) => {
                     const form = getForm(ticket._id);
                     const isOpen = expandedTicketId === ticket._id;
                     const confirmed = isConfirmedTicket(ticket.status);

                     return (
                         <article key={ticket._id} className={`group overflow-hidden rounded-3xl border transition-all duration-300 ${confirmed ? 'border-blue-200 bg-white shadow-lg' : 'border-slate-200 bg-white shadow-sm hover:shadow-xl'}`}>
                             <div className="p-6">
                                 <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                     <div className="flex items-center gap-4">
                                         <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                                             confirmed ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'
                                         }`}>
                                             <TicketIcon className="h-7 w-7" />
                                         </div>
                                         <div>
                                             <div className="flex items-center gap-2 mb-1">
                                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Slot #{ticket.slotIndex}</p>
                                                 {getTicketStatusBadge(ticket.status)}
                                             </div>
                                             <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">{ticket.categoryName}</h3>
                                         </div>
                                     </div>

                                     {!confirmed && (
                                         <div className="flex items-center gap-2">
                                             <button
                                                 type="button"
                                                 onClick={() => toggleTicketForm(ticket._id)}
                                                 className={`flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                                                     isOpen ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                                                 }`}
                                             >
                                                 {isOpen ? 'Close' : 'Complete Identity'}
                                                 {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                                             </button>
                                         </div>
                                     )}

                                     {confirmed && (
                                         <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 border border-slate-100">
                                             <div className="text-right">
                                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assigned To</p>
                                                 <p className="text-sm font-black text-slate-900">
                                                     {ticket.attendee?.fullName || ticket.inviteEmail || 'Guest'}
                                                 </p>
                                             </div>
                                             <CheckBadgeIcon className="h-6 w-6 text-blue-500" />
                                         </div>
                                     )}
                                 </div>

                                 {isOpen && !confirmed && (
                                     <div className="mt-8 animate-in slide-in-from-top duration-300">
                                         <div className="grid gap-8 lg:grid-cols-2">
                                             {/* Direct Fill */}
                                             <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6">
                                                 <div className="flex items-center gap-3 mb-6">
                                                     <CheckBadgeIcon className="h-6 w-6 text-blue-600" />
                                                     <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">I'm Attending</h4>
                                                 </div>
                                                 <div className="space-y-4">
                                                     <input
                                                         type="text"
                                                         value={form.fullName}
                                                         onChange={(e) => updateForm(ticket._id, 'fullName', e.target.value)}
                                                         placeholder="Full Name *"
                                                         className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                     />
                                                     <input
                                                         type="email"
                                                         value={form.email}
                                                         onChange={(e) => updateForm(ticket._id, 'email', e.target.value)}
                                                         placeholder="Email Address *"
                                                         className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                     />
                                                     <div className="grid grid-cols-2 gap-3">
                                                         <input
                                                             type="text"
                                                             value={form.nationalId}
                                                             onChange={(e) => updateForm(ticket._id, 'nationalId', e.target.value)}
                                                             placeholder="NIC / Passport"
                                                             className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold"
                                                         />
                                                         <input
                                                             type="date"
                                                             value={form.dateOfBirth}
                                                             onChange={(e) => updateForm(ticket._id, 'dateOfBirth', e.target.value)}
                                                             className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold"
                                                         />
                                                     </div>

                                                     {/* Photo Upload Area */}
                                                     <div>
                                                         <label className="mb-2 block text-xs font-bold text-slate-700">Identity Verification Photo *</label>
                                                         <div className="flex flex-col gap-3">
                                                             <div className="grid grid-cols-2 gap-2">
                                                                 <label className="flex-1 relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 transition-all hover:border-blue-500 hover:bg-blue-50 cursor-pointer group">
                                                                     {form.photo ? (
                                                                         <div className="relative h-32 w-full">
                                                                             <img
                                                                                 src={URL.createObjectURL(form.photo)}
                                                                                 alt="Preview"
                                                                                 className="h-full w-full rounded-xl object-cover shadow-md"
                                                                             />
                                                                             <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                 <span className="text-[10px] font-black uppercase tracking-widest text-white">Change Photo</span>
                                                                             </div>
                                                                         </div>
                                                                     ) : (
                                                                         <div className="flex flex-col items-center py-4">
                                                                             <div className="mb-2 rounded-full bg-slate-100 p-3 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                                                 <UserPlusIcon className="h-6 w-6" />
                                                                             </div>
                                                                             <p className="text-[10px] font-black text-center uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Upload Photo</p>
                                                                         </div>
                                                                     )}
                                                                     <input
                                                                         type="file"
                                                                         accept="image/*"
                                                                         onChange={(e) => updateForm(ticket._id, 'photo', e.target.files?.[0] || null)}
                                                                         className="hidden"
                                                                     />
                                                                 </label>

                                                                 <button
                                                                     type="button"
                                                                     onClick={() => setCameraTicketId(ticket._id)}
                                                                     className="flex-1 relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 transition-all hover:border-blue-500 hover:bg-blue-50 group"
                                                                 >
                                                                     <div className="mb-2 rounded-full bg-slate-100 p-3 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                                         <CameraIcon className="h-6 w-6" />
                                                                     </div>
                                                                     <p className="text-[10px] font-black text-center uppercase tracking-widest text-slate-400 group-hover:text-blue-700">Live Camera</p>
                                                                 </button>
                                                             </div>
                                                             {cameraTicketId === ticket._id && (
                                                                 <CameraCapture
                                                                     onCapture={(file) => updateForm(ticket._id, 'photo', file)}
                                                                     onClose={() => setCameraTicketId(null)}
                                                                 />
                                                             )}
                                                         </div>
                                                     </div>

                                                     <button
                                                         type="button"
                                                         onClick={() => handleFillSubmit(ticket._id)}
                                                         disabled={submittingTicketId === ticket._id}
                                                         className="w-full rounded-xl bg-slate-950 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800 disabled:opacity-50"
                                                     >
                                                         Confirm My Details
                                                     </button>
                                                 </div>
                                             </div>

                                             {/* Invite Others */}
                                             <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6">
                                                 <div className="flex items-center gap-3 mb-6">
                                                     <UserPlusIcon className="h-6 w-6 text-sky-600" />
                                                     <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Delegate Slot</h4>
                                                 </div>
                                                 <p className="text-xs font-medium text-slate-500 leading-relaxed mb-6">
                                                     We'll email a secure confirmation link to your guest so they can fill their own details.
                                                 </p>
                                                 <div className="space-y-4">
                                                     <div className="relative">
                                                         <EnvelopeIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                         <input
                                                             type="email"
                                                             value={inviteEmailByTicket[ticket._id] || ''}
                                                             onChange={(e) => setInviteEmailByTicket((prev) => ({ ...prev, [ticket._id]: e.target.value }))}
                                                             placeholder="Guest Email Address"
                                                             className="w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 py-3 text-sm font-bold transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                         />
                                                     </div>
                                                     <div className="relative">
                                                         <PhoneIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                                                         <input
                                                             type="tel"
                                                             value={invitePhoneByTicket[ticket._id] || ''}
                                                             onChange={(e) => setInvitePhoneByTicket((prev) => ({ ...prev, [ticket._id]: e.target.value }))}
                                                             placeholder={`Guest Phone ${payload?.smsEnabled ? '*' : '(Optional)'}`}
                                                             className="w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 py-3 text-sm font-bold transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                         />
                                                     </div>
                                                     <button
                                                         type="button"
                                                         onClick={() => handleSendInvite(ticket._id)}
                                                         disabled={submittingTicketId === ticket._id}
                                                         className="w-full rounded-xl border-2 border-slate-200 bg-white py-4 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-blue-500 hover:text-blue-700 disabled:opacity-50"
                                                     >
                                                         Email Secure Invite
                                                     </button>
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                             </div>
                         </article>
                     );
                  })}
               </div>
            </div>
         </div>
      </div>
    </PublicLayout>
  );
};

export default OrderConfirmationPage;
