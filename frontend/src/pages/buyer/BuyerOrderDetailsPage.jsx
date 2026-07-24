import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import BuyerLayout from '../../components/layout/BuyerLayout';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import {
  assignAttendee,
  getBuyerOrderDetails,
  resendInvite,
} from '../../api/buyer';
import {
  ArrowLeftIcon,
  CalendarIcon,
  MapPinIcon,
  UserPlusIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  QrCodeIcon,
  ShoppingBagIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';

const statusPill = (status) => {
  const map = {
    PENDING: 'bg-slate-100 text-slate-700 border border-slate-200',
    INVITED: 'bg-blue-50 text-blue-700 border border-blue-100',
    PENDING_VERIFICATION: 'bg-amber-50 text-amber-800 border border-amber-100',
    CONFIRMED: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
};

const statusLabel = (status) => {
  const map = {
    PENDING: 'Not Assigned',
    INVITED: 'Invited',
    PENDING_VERIFICATION: 'Photo Submitted',
    CONFIRMED: 'Confirmed',
  };
  return map[status] || status;
};

const BuyerOrderDetailsPage = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingTicketId, setSavingTicketId] = useState(null);
  const [qrTicket, setQrTicket] = useState(null);

  const load = () => {
    setLoading(true);
    return getBuyerOrderDetails(orderId)
      .then((res) => {
        setOrder(res.data?.data?.order || null);
        setTickets(res.data?.data?.tickets || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [orderId]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const assigned = tickets.filter((t) => t.status !== 'PENDING').length;
    const pending = tickets.filter((t) => t.status === 'PENDING').length;
    return { total, assigned, pending };
  }, [tickets]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleAssign = async (ticketId, form) => {
    setSavingTicketId(ticketId);
    try {
      await assignAttendee({ ticketId, ...form, notificationChannel: 'email' });
      toast.success('Invite sent successfully!');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Assign failed');
    } finally {
      setSavingTicketId(null);
    }
  };

  const handleResend = async (ticketId) => {
    setSavingTicketId(ticketId);
    try {
      await resendInvite(ticketId, { notificationChannel: 'email' });
      toast.success('Invite code resent successfully!');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setSavingTicketId(null);
    }
  };

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        
        {/* Navigation back */}
        <Link
          to="/buyer/tickets"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to Purchased Tickets</span>
        </Link>

        {order && (
          <div className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-slate-200">
                    Order #{order.orderNumber}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Placed on {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900 leading-snug">{order.event?.name}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold mt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-brand-main" />
                    {formatDate(order.event?.startDate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinIcon className="h-4 w-4 text-brand-main" />
                    {order.event?.venue?.name || 'Venue TBD'}
                  </span>
                </div>
              </div>
            </div>

            {/* Order Status Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/60">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Order Status</p>
                <p className={`mt-1 text-sm font-bold ${(['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'RESERVED') || (order?.paymentMethod === 'bank_transfer' && order?.paymentStatus !== 'paid') ? 'text-orange-700' : 'text-slate-900'}`}>
                  {(['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'RESERVED') || (order?.paymentMethod === 'bank_transfer' && order?.paymentStatus !== 'paid') ? 'Reserved - Awaiting Payment' : order?.status || 'Pending'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/60">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Payment Status</p>
                <p className={`mt-1 text-sm font-bold ${order?.paymentStatus === 'awaiting_payment' ? 'text-red-700' : order?.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {order?.paymentStatus === 'awaiting_payment' ? 'Awaiting Payment' : order?.paymentStatus === 'paid' ? 'Paid' : order?.paymentStatus || 'Pending'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/60">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Ticket Status</p>
                <p className={`mt-1 text-sm font-bold ${(['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'RESERVED') || (order?.paymentMethod === 'bank_transfer' && order?.paymentStatus !== 'paid') ? 'text-red-700' : 'text-slate-900'}`}>
                  {(['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'RESERVED') || (order?.paymentMethod === 'bank_transfer' && order?.paymentStatus !== 'paid') ? 'Not Yet Issued' : 'Issued'}
                </p>
              </div>
            </div>

            {/* Payment Method Display */}
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/60">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Payment Method</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {order?.paymentMethod === 'cash_at_entrance' || order?.paymentMethod === 'cash_on_entrance' ? 'Cash at Entrance' : order?.paymentMethod || 'Card'}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-slate-900">Manage Ticket Slots</h3>
            <p className="text-xs text-slate-500 font-medium">Assign a guest email to activate each pass slot.</p>
          </div>

          {/* Reserved Order Notice */}
          {!loading && ((['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'RESERVED') || (order?.paymentMethod === 'bank_transfer' && order?.paymentStatus !== 'paid')) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-900">Tickets Will Be Issued Only After Payment Verification</h4>
                <p className="text-sm text-amber-800 mt-1">
                  {order?.paymentMethod === 'bank_transfer' 
                    ? 'Your payment is currently being verified. Ticket features will be available after the organizer approves your payment.'
                    : 'Payment must be completed at the event venue before your tickets can be issued. You cannot assign or download tickets until payment is received at the payment counter.'}
                </p>
              </div>
            </div>
          )}

          {/* Post-Payment Notice */}
          {!loading && ['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'CONFIRMED' && order?.paymentStatus === 'paid' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm flex gap-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-900">Payment Confirmed – Tickets Issued</h4>
                <p className="text-sm text-emerald-800 mt-1">Your payment has been received and your tickets have been issued. You can now assign attendees, download tickets, and view QR codes.</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="h-32 rounded-3xl bg-slate-200 animate-pulse" />
              <div className="h-32 rounded-3xl bg-slate-200 animate-pulse" />
            </div>
          )}

          {!loading && tickets.length === 0 && (
            <div className="rounded-[32px] bg-white p-10 text-center shadow-sm border border-slate-200 text-sm text-slate-500">
              No ticket slots found in this order.
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map((ticket) => (
                <TicketSlotCard
                  key={ticket._id}
                  ticket={ticket}
                  saving={savingTicketId === ticket._id}
                  onAssign={handleAssign}
                  onResend={handleResend}
                  onViewQr={() => setQrTicket(ticket)}
                  isAwaitingVenuePayment={['cash_on_entrance', 'cash_at_entrance'].includes(order?.paymentMethod) && order?.status === 'RESERVED' || (order?.paymentMethod === 'bank_transfer' && order?.paymentStatus !== 'paid')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={!!qrTicket}
        onClose={() => setQrTicket(null)}
        title="Access Pass QR Code"
        size="sm"
      >
        <div className="space-y-4 text-center p-4">
          <div className="space-y-1">
            <p className="text-base font-extrabold text-slate-900">
              {qrTicket?.attendee?.fullName || 'Access Pass'}
            </p>
            <p className="text-xs text-slate-500 font-medium">{qrTicket?.attendee?.email}</p>
          </div>

          {qrTicket?.attendee?.qrCode ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <img
                src={qrTicket.attendee.qrCode}
                alt="QR Code"
                className="mx-auto w-48 h-48 rounded-xl"
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500 border border-slate-200">
              QR code verification is not completed yet.
            </div>
          )}
          
          <div className="pt-2 flex flex-col items-center justify-center gap-1">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md border border-slate-200">
              {qrTicket?.categoryName}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Ticket ID: {qrTicket?.ticketNumber}</span>
          </div>
        </div>
      </Modal>
    </BuyerLayout>
  );
};

const TicketSlotCard = ({ ticket, saving, onAssign, onResend, onViewQr, isAwaitingVenuePayment }) => {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '' });

  useEffect(() => {
    if (ticket?.attendee) {
      setForm({
        fullName: ticket.attendee?.fullName || '',
        email: ticket.attendee?.email || ticket.inviteEmail || '',
        phone: ticket.attendee?.phone || ticket.invitePhone || '',
      });
    } else {
      setForm({ fullName: '', email: '', phone: '' });
    }
  }, [ticket]);

  const isPending = ticket.status === 'PENDING';
  const isInvited = ticket.status === 'INVITED';
  const isSubmitted = ticket.status === 'PENDING_VERIFICATION';
  const isConfirmed = ticket.status === 'CONFIRMED';
  const isInvalidated = ticket.status === 'CANCELLED' || ticket.refundStatus === 'refunded';
  const isPhotoRejected = !isInvalidated && String(ticket.attendee?.photoVerificationStatus || '').toLowerCase() === 'rejected';
  const resubmitHref = ticket.attendee?.resubmitToken
    ? `/resubmit/${ticket.attendee.resubmitToken}`
    : `/buyer/confirm/${ticket._id}`;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Slot #{ticket.slotIndex}
          </p>
          <p className="mt-1 truncate text-base font-extrabold text-slate-900">{ticket.categoryName}</p>
          <p className="mt-1 truncate text-xs text-slate-500 font-semibold leading-normal">
            {ticket.attendee?.fullName || ticket.inviteEmail || 'No guest assigned'}
          </p>
          {ticket.status !== 'PENDING' && (
            <div className="mt-2 space-y-0.5 text-[10px] text-slate-400 font-medium font-mono">
              {(ticket.inviteSentAt || ticket.createdAt) && (
                <p>Assigned: {new Date(ticket.inviteSentAt || ticket.createdAt).toLocaleString()}</p>
              )}
              {isConfirmed && (ticket.attendee?.confirmedAt || ticket.updatedAt) && (
                <p>Confirmed: {new Date(ticket.attendee?.confirmedAt || ticket.updatedAt).toLocaleString()}</p>
              )}
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${isInvalidated ? 'bg-slate-100 text-slate-700 border border-slate-200' : isPhotoRejected ? 'bg-red-50 text-red-700 border border-red-100' : statusPill(ticket.status)}`}>
          {isInvalidated ? 'Invalidated' : isPhotoRejected ? 'Photo Rejected' : statusLabel(ticket.status)}
        </span>
      </div>

      {isPending && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-col gap-2">
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-main focus:ring-1 focus:ring-brand-main outline-none"
              placeholder="Guest Full Name"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-main focus:ring-1 focus:ring-brand-main outline-none"
              placeholder="Guest Email Address"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs focus:border-brand-main focus:ring-1 focus:ring-brand-main outline-none"
              placeholder="Guest Mobile (optional)"
            />
          </div>

          <button
            onClick={() => onAssign(ticket._id, form)}
            disabled={saving || !form.email.trim() || isAwaitingVenuePayment}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-main px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-dark transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                <span>Sending Invitation…</span>
              </>
            ) : (
              <>
                <UserPlusIcon className="h-4 w-4" />
                <span>Assign Slot & Invite</span>
              </>
            )}
          </button>
        </div>
      )}

      {isInvalidated && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-800">Ticket invalidated</p>
          <p className="text-[11px] leading-relaxed text-slate-600">
            {ticket.invalidationReason || 'Maximum photo resubmissions were reached.'}
          </p>
          {ticket.refundAmount > 0 && (
            <p className="text-[11px] font-semibold text-emerald-700">
              Refund initiated: LKR {Number(ticket.refundAmount).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {isPhotoRejected && (
        <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-red-800">Photo verification rejected</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                {ticket.attendee?.photoRejectionReason || 'Please upload a clearer verification photo.'}
              </p>
            </div>
          </div>
          <Link
            to={resubmitHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-all active:scale-95"
          >
            <PhotoIcon className="h-3.5 w-3.5" />
            <span>Resubmit Photo</span>
          </Link>
        </div>
      )}

      {(isInvited || isSubmitted) && !isPhotoRejected && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            {isInvited ? (
              <ClockIcon className="h-4 w-4 text-slate-400" />
            ) : (
              <CheckBadgeIcon className="h-4 w-4 text-brand-main" />
            )}
            <span>{isInvited ? 'Awaiting guest confirmation' : 'Photo submitted'}</span>
          </div>
          {isInvited && (
            <button
              onClick={() => onResend(ticket._id)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition-all"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              <span>Resend invite</span>
            </button>
          )}
        </div>
      )}

      {isConfirmed && ticket.attendee?.qrCode && (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-brand-main font-semibold">
            <CheckCircleIcon className="h-4 w-4" />
            <span>Ticket Active</span>
          </div>
          <button
            onClick={() => onViewQr(ticket)}
            disabled={isAwaitingVenuePayment}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 disabled:opacity-50 transition-all"
          >
            <QrCodeIcon className="h-3.5 w-3.5 text-slate-400" />
            <span>View QR Code</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default BuyerOrderDetailsPage;
