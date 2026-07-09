import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import BuyerLayout from '../../components/layout/BuyerLayout';
import { getBuyerTickets } from '../../api/buyer';
import api from '../../api/client';
import TicketCard from '../../components/buyer/TicketCard';
import OrderControls from '../../components/buyer/OrderControls';
import EmptyState from '../../components/buyer/EmptyState';
import toast from 'react-hot-toast';
import {
  TicketIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowRightIcon,
  QrCodeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  MapPinIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const StatCard = ({ label, value, icon: Icon, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-white border-slate-200 text-slate-900',
    blue: 'bg-blue-50/70 border-blue-100 text-blue-900',
    amber: 'bg-amber-50/70 border-amber-100 text-amber-900',
    emerald: 'bg-emerald-50/70 border-emerald-100 text-emerald-900',
  };

  return (
    <div className={`rounded-3xl p-5 shadow-sm border hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
};

const BuyerHomePage = () => {
  const [orders, setOrders] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingIds, setDownloadingIds] = useState({});

  // Filtering / Search States for passes
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
    return new Date(dateString).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleDownload = async (token, ticketNumber, passId) => {
    if (!token) return;
    try {
      setDownloadingIds(prev => ({ ...prev, [passId]: true }));
      const response = await api.get(`/tickets/download/${token}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Ticket-${ticketNumber || token}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Ticket downloaded successfully!');
    } catch (error) {
      console.error('Error downloading ticket:', error);
      toast.error('Failed to download ticket PDF');
    } finally {
      setDownloadingIds(prev => ({ ...prev, [passId]: false }));
    }
  };

  const handleDownloadOrder = async (orderId) => {
    try {
      toast.loading('Generating order summary...', { id: 'order-pdf' });
      const response = await api.get(`/tickets/order-download/${orderId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `OrderSummary-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Order summary downloaded!', { id: 'order-pdf' });
    } catch (error) {
      console.error('Error downloading order summary:', error);
      toast.error('Failed to download order summary PDF', { id: 'order-pdf' });
    }
  };

  // Filtered Passes
  const filteredPasses = useMemo(() => {
    return passes.filter((pass) => {
      const matchesSearch = 
        (pass.event?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pass.ticketNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const isPendingVerification = pass.status === 'PENDING_VERIFICATION' || 
        (pass.status === 'ASSIGNED' && pass.attendee?.photo && pass.event?.requirePhotoVerification);
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'active' && pass.status === 'CONFIRMED') ||
        (statusFilter === 'verification' && isPendingVerification) ||
        (statusFilter === 'pending' && pass.status !== 'CONFIRMED' && !isPendingVerification);

      return matchesSearch && matchesStatus;
    });
  }, [passes, searchQuery, statusFilter]);

  return (
    <BuyerLayout>
      <div className="space-y-8 px-1 animate-fade-in">
        
        {/* Ticket Owner Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark to-slate-900 p-6 sm:p-8 text-white rounded-[32px] shadow-sm">
          <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-brand-main/15 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-blue-300">Ticket Owner</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Manage your tickets in a few taps</h2>
            <p className="text-slate-300 text-sm max-w-lg font-medium">Assign attendees, track invite status, and keep everything ready for entry.</p>
          </div>
        </div>

        {/* 1. Stats Grid (Full Width) */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-1">Overview</h4>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" />
              <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" />
              <div className="h-24 rounded-3xl bg-slate-200 animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total tickets" value={stats.totalTickets} icon={TicketIcon} tone="blue" />
              <StatCard label="Assigned" value={stats.assigned} icon={UserGroupIcon} tone="emerald" />
              <StatCard label="Pending" value={stats.pending} icon={ClockIcon} tone="amber" />
            </div>
          )}
        </div>

        {/* 2. Widgets Section (Full Width, Grid of widgets) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Widget A: Next Event Highlight */}
          {!loading && nextOrder?.event ? (
            <div className="relative overflow-hidden bg-slate-900 p-6 text-white rounded-[32px] shadow-sm border border-slate-800 flex flex-col justify-between min-h-[220px]">
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-brand-main/20 blur-xl pointer-events-none" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Next event highlight</p>
                <h4 className="text-lg font-extrabold text-white mt-3 leading-tight truncate">{nextOrder.event.name}</h4>
                
                <div className="mt-4 space-y-2 text-xs text-slate-300 font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-brand-main flex-shrink-0" />
                    <span>{formatDate(nextOrder.event.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-brand-main flex-shrink-0" />
                    <span className="truncate">{nextOrder.event.venue?.name || 'Venue TBD'}</span>
                  </div>
                </div>
              </div>

              <Link
                to={`/buyer/assign/${nextOrder._id}`}
                className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 px-4 py-2.5 text-xs font-bold transition-all shadow-sm active:scale-95 w-full"
              >
                <span>Assign attendees</span>
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="bg-slate-900 p-6 text-slate-400 rounded-[32px] border border-slate-800 flex items-center justify-center min-h-[220px]">
              <p className="text-xs font-medium">No upcoming events scheduled.</p>
            </div>
          )}

          {/* Widget B: Owner Portal Tools (Quick Actions) */}
          <div className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 flex flex-col justify-between min-h-[220px]">
            <div>
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Owner Portal Tools</h4>
              <p className="text-xs text-slate-500 font-medium">Quickly jump into your orders manager or tracking tools.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Link
                to="/buyer/tickets"
                className="group flex flex-col justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl shadow-sm transition-all"
              >
                <span className="text-xs font-extrabold text-slate-900">Manage Orders</span>
                <span className="mt-2 flex items-center text-[10px] font-bold text-brand-main group-hover:underline gap-1">
                  <span>View</span>
                  <ArrowRightIcon className="h-3 w-3" />
                </span>
              </Link>
              
              <Link
                to="/buyer/invites"
                className="group flex flex-col justify-between p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl shadow-sm transition-all"
              >
                <span className="text-xs font-extrabold text-slate-900">Track Invites</span>
                <span className="mt-2 flex items-center text-[10px] font-bold text-brand-main group-hover:underline gap-1">
                  <span>Track</span>
                  <ArrowRightIcon className="h-3 w-3" />
                </span>
              </Link>
            </div>
          </div>

          {/* Widget C: Quick Security Banner */}
          <div className="rounded-[32px] bg-white p-6 shadow-sm border border-slate-200 flex flex-col justify-between min-h-[220px]">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-brand-main" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Security & Invites</h4>
              </div>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Tickets must be assigned to guest emails for them to generate QR codes. Make sure guest details are correct.
              </p>
            </div>
            <Link
              to="/buyer/profile"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-all active:scale-95"
            >
              <span>Manage Profile Info</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 3. Purchased Orders list (Full Width) */}
        {!loading && orders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Your Purchased Orders</h3>
            <OrderControls orders={orders} onDownloadOrder={handleDownloadOrder} />
          </div>
        )}

        {/* 4. My Passes / QR Codes list (Full Width) */}
        {!loading && passes.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <QrCodeIcon className="h-5 w-5 text-slate-800" />
                <h3 className="text-lg font-bold text-slate-800">My Entry Passes</h3>
              </div>
              {/* Search & Filter Bar */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <input
                    type="text"
                    placeholder="Search by event or ticket..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-main bg-white"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="appearance-none pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-main bg-white cursor-pointer font-medium text-slate-700"
                  >
                    <option value="all">All Passes</option>
                    <option value="active">Active</option>
                    <option value="verification">Awaiting Verification</option>
                    <option value="pending">Pending</option>
                  </select>
                  <FunnelIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            {filteredPasses.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {filteredPasses.map(pass => (
                  <TicketCard
                    key={pass._id}
                    pass={pass}
                    onDownload={() => handleDownload(pass.attendee?.qrToken, pass.ticketNumber, pass._id)}
                    downloading={!!downloadingIds[pass._id]}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-[32px] border border-dashed border-slate-200">
                <p className="text-sm text-slate-500 font-medium">No entry passes match your filters.</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State if no passes and no orders */}
        {!loading && passes.length === 0 && orders.length === 0 && (
          <EmptyState />
        )}

      </div>
    </BuyerLayout>
  );
};

export default BuyerHomePage;
