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
} from '@heroicons/react/24/outline';

const statusPill = (status) => {
  const map = {
    PENDING: 'bg-slate-100 text-slate-700',
    INVITED: 'bg-amber-100 text-amber-900',
    PENDING_VERIFICATION: 'bg-amber-100 text-amber-900',
    CONFIRMED: 'bg-emerald-100 text-emerald-900',
  };
  return map[status] || 'bg-slate-100 text-slate-700';
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
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const handleAssign = async (ticketId, form) => {
    setSavingTicketId(ticketId);
    try {
      await assignAttendee({ ticketId, ...form, notificationChannel: 'email' });
      toast.success('Invite sent');
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
      toast.success('Invite resent');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Resend failed');
    } finally {
      setSavingTicketId(null);
    }
  };

  return (
    <BuyerLayout>
      <div className="space-y-4 animate-fade-in">
        <Link
          to="/buyer/tickets"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back</span>
        </Link>

        {order && (
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Order {order.orderNumber}</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{order.event?.name}</h2>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {formatDate(order.event?.startDate)}
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPinIcon className="h-4 w-4" />
                {order.event?.venue?.name || 'Venue TBD'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Total</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Assigned</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{stats.assigned}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Pending</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">{stats.pending}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-lg font-bold text-slate-900">Ticket slots</h3>

          {loading && (
            <div className="space-y-3">
              <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
              <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
            </div>
          )}

          {!loading && tickets.length === 0 && (
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200 text-sm text-slate-600">
              No ticket slots found.
            </div>
          )}

          {!loading && tickets.map((ticket) => (
            <TicketSlotCard
              key={ticket._id}
              ticket={ticket}
              saving={savingTicketId === ticket._id}
              onAssign={handleAssign}
              onResend={handleResend}
              onViewQr={() => setQrTicket(ticket)}
            />
          ))}
        </div>
      </div>

      <Modal
        open={!!qrTicket}
        onClose={() => setQrTicket(null)}
        title="Ticket QR Code"
        size="sm"
      >
        <div className="space-y-3 text-center">
          <p className="text-sm text-slate-600">
            {qrTicket?.attendee?.fullName || qrTicket?.attendee?.email || 'Attendee'}
          </p>
          {qrTicket?.attendee?.qrCode ? (
            <img
              src={qrTicket.attendee.qrCode}
              alt="QR Code"
              className="mx-auto w-64 max-w-full rounded-2xl bg-white p-4 ring-1 ring-slate-200"
            />
          ) : (
            <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-600 ring-1 ring-slate-200">
              QR not available yet.
            </div>
          )}
          <p className="text-xs text-slate-500">Category: {qrTicket?.categoryName}</p>
        </div>
      </Modal>
    </BuyerLayout>
  );
};

const TicketSlotCard = ({ ticket, saving, onAssign, onResend, onViewQr }) => {
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

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Slot #{ticket.slotIndex}
          </p>
          <p className="mt-1 truncate text-base font-bold text-slate-900">{ticket.categoryName}</p>
          <p className="mt-1 truncate text-sm text-slate-600">
            {ticket.attendee?.fullName || ticket.inviteEmail || 'Not assigned yet'}
          </p>
        </div>
        <span className={`shrink-0 rounded-2xl px-3 py-1 text-xs font-semibold ${statusPill(ticket.status)}`}>
          {isPending ? 'Pending' : isInvited ? 'Invited' : isSubmitted ? 'Submitted' : isConfirmed ? 'Confirmed' : ticket.status}
        </span>
      </div>

      {isPending && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
              placeholder="Name"
            />
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
              placeholder="Email"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-slate-900/10 focus:ring-4"
              placeholder="Phone (optional)"
            />
          </div>

          <button
            onClick={() => onAssign(ticket._id, form)}
            disabled={saving || !form.email.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Sending…</span>
              </>
            ) : (
              <>
                <UserPlusIcon className="h-5 w-5" />
                <span>Assign & send invite</span>
              </>
            )}
          </button>
        </div>
      )}

      {(isInvited || isSubmitted) && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            {isInvited ? <ClockIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
            <span>{isInvited ? 'Waiting for attendee' : 'Attendee submitted details'}</span>
          </div>
          {isInvited && (
            <button
              onClick={() => onResend(ticket._id)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50"
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span>Resend</span>
            </button>
          )}
        </div>
      )}

      {isConfirmed && ticket.attendee?.qrCode && (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">QR ready</p>
              <p className="mt-1 text-xs text-emerald-800">Attendee completed identity and ticket is confirmed.</p>
            </div>
            <button
              type="button"
              onClick={onViewQr}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-900 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              <QrCodeIcon className="h-4 w-4" />
              <span>View QR</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerOrderDetailsPage;
