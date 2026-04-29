import React, { useEffect, useMemo, useState } from 'react';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import { Link } from 'react-router-dom';
import {
  TicketIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowRightIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import api from '../../api/client';
import QRCodeDisplay from '../../components/attendee/QRCodeDisplay';

const StatCard = ({ label, value, icon: Icon, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-white ring-slate-200 text-slate-900',
    blue: 'bg-blue-50 ring-blue-200 text-blue-900',
    amber: 'bg-amber-50 ring-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 ring-emerald-200 text-emerald-900',
  };

  return (
    <div className={`rounded-3xl p-5 shadow-sm ring-1 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
};

const BuyerHomePage = () => {
  const [orders, setOrders] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getBuyerTickets().catch(() => ({ data: { data: { orders: [] } } })),
      api.get('/user/tickets').catch(() => ({ data: { data: { tickets: [] } } }))
    ])
      .then(([buyerRes, userRes]) => {
        setOrders(buyerRes.data?.data?.orders || []);
        setPasses(userRes.data?.data?.tickets || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const totalTickets = orders.reduce((acc, o) => acc + (o.stats?.total || 0), 0);
    const assigned = orders.reduce((acc, o) => acc + (o.stats?.assigned || 0), 0);
    const pending = orders.reduce((acc, o) => acc + (o.stats?.pending || 0), 0);
    return { totalTickets, assigned, pending };
  }, [orders]);

  const nextOrder = useMemo(() => {
    const now = Date.now();
    return [...orders]
      .filter((o) => o.event?.startDate)
      .sort((a, b) => new Date(a.event.startDate) - new Date(b.event.startDate))
      .find((o) => new Date(o.event.startDate).getTime() >= now) || orders[0] || null;
  }, [orders]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <BuyerLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">Ticket Owner</p>
          <h2 className="mt-2 text-2xl font-bold">Manage your tickets in a few taps</h2>
          <p className="mt-2 text-sm text-slate-200">Assign attendees, track invite status, and keep everything ready for entry.</p>
          {nextOrder?.event && (
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-200">Next event</p>
              <p className="mt-1 text-lg font-semibold">{nextOrder.event.name}</p>
              <p className="mt-1 text-sm text-slate-200">
                {formatDate(nextOrder.event.startDate)} • {nextOrder.event.venue?.name || 'Venue TBD'}
              </p>
              <Link
                to={`/buyer/assign/${nextOrder._id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                <span>Assign attendees</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
            <div className="h-28 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Total tickets" value={stats.totalTickets} icon={TicketIcon} tone="blue" />
            <StatCard label="Assigned" value={stats.assigned} icon={UserGroupIcon} tone="emerald" />
            <StatCard label="Pending" value={stats.pending} icon={ClockIcon} tone="amber" />
          </div>
        )}

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Quick actions</h3>
            <span className="text-xs text-slate-500">Mobile-friendly</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              to="/buyer/tickets"
              className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm transition hover:bg-slate-800"
            >
              <p className="text-sm font-semibold">My orders</p>
              <p className="mt-1 text-xs text-slate-200">See categories and assign tickets</p>
            </Link>
            <Link
              to="/buyer/invites"
              className="rounded-2xl bg-slate-100 px-5 py-4 text-slate-900 shadow-sm transition hover:bg-slate-200"
            >
              <p className="text-sm font-semibold">Invite status</p>
              <p className="mt-1 text-xs text-slate-600">Resend invites when needed</p>
            </Link>
          </div>
        </div>

        {/* My Passes / QR Codes */}
        {passes.length > 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2 mb-6">
              <QrCodeIcon className="h-6 w-6 text-slate-900" />
              <h3 className="text-xl font-bold text-slate-900">My Entry Passes</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {passes.map(pass => {
                const isConfirmed = pass.attendee?.isConfirmed && pass.attendee?.confirmationStatus === 'confirmed';
                return (
                  <div key={pass._id} className="rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
                    <div className="bg-slate-50 p-4 border-b border-slate-200">
                      <h4 className="font-bold text-slate-900 truncate">{pass.event?.name}</h4>
                      <p className="text-sm text-slate-600">{formatDate(pass.event?.startDate)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-1 bg-white rounded-md border border-slate-200">
                          {pass.categoryName}
                        </span>
                        {isConfirmed ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                            <CheckCircleSolid className="h-4 w-4" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                            <ClockIcon className="h-4 w-4" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col items-center justify-center bg-white">
                      {isConfirmed ? (
                        <>
                          <QRCodeDisplay 
                            value={pass.attendee?.qrCode || pass.attendee?.qrToken || pass.qrToken} 
                            size={180}
                            className="mb-3"
                          />
                          <p className="text-xs text-slate-500 text-center">Scan at the entrance</p>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <QrCodeIcon className="h-8 w-8 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-600">Complete confirmation to view QR code</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BuyerLayout>
  );
};

export default BuyerHomePage;

