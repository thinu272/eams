import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AttendeeLayout from '../../components/attendee/AttendeeLayout';
import AttendeeTicketCard from '../../components/attendee/AttendeeTicketCard';
import QRCodeDisplay from '../../components/attendee/QRCodeDisplay';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  TicketIcon, 
  CalendarIcon, 
  MapPinIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon,
  ArrowDownTrayIcon,
  UserCircleIcon,
  BellIcon,
  ArrowTopRightOnSquareIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const AttendeeDashboardPage = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (token, ticketNumber) => {
    if (!token) return;
    try {
      setDownloading(true);
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
      setDownloading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.get('/user/tickets');
      setTickets(data?.data?.tickets || []);
    } catch (err) {
      console.error('Error loading tickets:', err);
      setError(err?.response?.data?.message || err.message);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const primaryTicket = tickets[0];
  const needsConfirmation = tickets.some(t => !t.attendee?.isConfirmed || t.attendee?.confirmationStatus !== 'confirmed');
  const needsPhoto = tickets.some(t => !t.attendee?.photo && t.event?.requirePhotoVerification);
  const primaryConfirmed = primaryTicket?.attendee?.isConfirmed && primaryTicket?.attendee?.confirmationStatus === 'confirmed';

  const getInitials = (name) => {
    if (!name) return 'A';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getGreetingDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Time TBD';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <AttendeeLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AttendeeLayout>
    );
  }

  return (
    <AttendeeLayout>
      <div className="space-y-6 px-1 animate-fade-in">
        
        {/* Welcome Section Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark to-slate-900 rounded-[32px] p-6 sm:p-8 shadow-sm text-white border border-slate-800">
          <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-brand-main/15 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
            {/* User Avatar Initials */}
            <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-main to-blue-500 flex items-center justify-center text-xl font-bold text-white shadow-md ring-4 ring-slate-800">
              {getInitials(user?.name)}
            </div>
            
            {/* Text details */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <p className="text-[10px] font-extrabold tracking-wider text-blue-300 uppercase">{getGreetingDate()}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {user?.name || 'Attendee'}!
              </h1>
              <p className="text-slate-300 text-sm font-medium">
                {tickets.length > 0 ? (
                  `You have ${tickets.length} total event ticket${tickets.length > 1 ? 's' : ''}. ${
                    needsConfirmation ? 'Some tickets require confirmation.' : 'All tickets are confirmed and active.'
                  }`
                ) : (
                  'Explore upcoming events and manage your secure digital access passes.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Required Banner */}
        {(needsConfirmation || needsPhoto) && (
          <div className="relative overflow-hidden bg-amber-50/70 backdrop-blur border border-amber-200 rounded-[32px] p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100/80 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ClockIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm font-bold text-amber-900">Action Required</h3>
                <p className="text-amber-800 text-sm font-medium">
                  {needsConfirmation && 'Complete your identity confirmation'}
                  {needsConfirmation && needsPhoto && ' and '}
                  {needsPhoto && 'upload photo verification'}
                  {' to activate your tickets and unlock your entry QR codes.'}
                </p>
                <div className="pt-2">
                  <Link
                    to="/attendee/tickets"
                    className="inline-flex items-center space-x-2 text-amber-900 text-sm font-bold hover:underline"
                  >
                    <span>Go to My Tickets</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Event Ticket - Pass Style Card */}
        {primaryTicket && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 px-1">Your Next Entry Pass</h2>
            
            <div className="relative bg-white border border-slate-200 rounded-[32px] shadow-sm flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Column (Event details) */}
              <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                {/* Category Tag & Status */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-md">
                    {primaryTicket.categoryName || 'Standard'}
                  </span>
                  
                  {primaryConfirmed ? (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                      <CheckCircleSolid className="h-3.5 w-3.5" />
                      <span>Pass Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 px-3 py-0.5 bg-yellow-50 border border-yellow-100 text-yellow-700 text-xs font-bold rounded-full">
                      <ClockIcon className="h-3.5 w-3.5 text-yellow-500" />
                      <span>Pending Action</span>
                    </span>
                  )}
                </div>

                {/* Title & Info */}
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 leading-tight">
                    {primaryTicket.event?.name}
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-500 font-medium">
                    <div className="flex items-center space-x-2 text-xs">
                      <CalendarIcon className="h-4 w-4 text-brand-main flex-shrink-0" />
                      <span>{formatDate(primaryTicket.event?.startDate)} at {formatTime(primaryTicket.event?.startDate)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 text-xs">
                      <MapPinIcon className="h-4 w-4 text-brand-main flex-shrink-0" />
                      <span className="truncate">{primaryTicket.event?.venue?.name || 'Venue TBD'}</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal line */}
                <div className="border-t border-slate-100" />

                {/* User info & Download Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">ATTENDEE PASS</p>
                    <p className="font-bold text-slate-800 text-base leading-snug">
                      {primaryTicket.attendee?.fullName || user?.name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">#{primaryTicket.ticketNumber}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {primaryConfirmed && (
                      <button
                        onClick={() => handleDownload(primaryTicket.attendee?.qrToken, primaryTicket.ticketNumber)}
                        disabled={downloading}
                        className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-brand-main hover:bg-blue-700 active:scale-95 disabled:scale-100 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                      >
                        {downloading ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                            <span>Download PDF</span>
                          </>
                        )}
                      </button>
                    )}
                    
                    <Link
                      to={`/attendee/ticket/${primaryTicket._id}`}
                      className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-250"
                    >
                      <span>View Ticket</span>
                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Ticket punches & dashed border */}
              {primaryConfirmed && (
                <>
                  {/* Desktop Divider */}
                  <div className="hidden md:flex flex-col items-center justify-between relative py-6">
                    <div className="absolute top-0 -translate-y-1/2 w-8 h-8 bg-slate-50 rounded-full border border-slate-200 z-20" />
                    <div className="h-full border-l-2 border-dashed border-slate-200" />
                    <div className="absolute bottom-0 translate-y-1/2 w-8 h-8 bg-slate-50 rounded-full border border-slate-200 z-20" />
                  </div>
                  
                  {/* Mobile Divider */}
                  <div className="flex md:hidden items-center justify-between relative px-6 w-full">
                    <div className="absolute left-0 -translate-x-1/2 w-8 h-8 bg-slate-50 rounded-full border border-slate-200 z-20" />
                    <div className="w-full border-t-2 border-dashed border-slate-200" />
                    <div className="absolute right-0 translate-x-1/2 w-8 h-8 bg-slate-50 rounded-full border border-slate-200 z-20" />
                  </div>
                </>
              )}

              {/* Right Column (QR Code stub or Confirmation call to action) */}
              {primaryConfirmed ? (
                <div className="w-full md:w-72 p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-50/50 text-center border-t border-slate-100 md:border-t-0">
                  <div className="bg-white p-3 rounded-2xl shadow-inner border border-slate-200 inline-block">
                    <QRCodeDisplay 
                      value={primaryTicket.attendee?.qrCode || primaryTicket.attendee?.qrToken} 
                      size={130} 
                    />
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-4">
                    Present QR code at gate
                  </p>
                </div>
              ) : (
                <div className="w-full md:w-72 p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-50/50 text-center border-t border-slate-100 md:border-t-0 space-y-4">
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center mx-auto">
                    <ClockIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">Verification Pending</p>
                    <p className="text-xs text-slate-500 max-w-[180px] mx-auto mt-1 font-medium">
                      Please complete details to activate pass
                    </p>
                  </div>
                  <Link
                    to={`/confirm/${primaryTicket.attendee?.confirmationToken || primaryTicket.inviteToken}`}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors w-full justify-center"
                  >
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    <span>Confirm Pass</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Tickets</p>
                <p className="text-2xl font-bold text-slate-900">{tickets.length}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <TicketIcon className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">
                  {tickets.filter(t => t.attendee?.confirmationStatus === 'confirmed').length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center">
                <CheckCircleSolid className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Needs Action</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {tickets.filter(t => !t.attendee?.isConfirmed || t.attendee?.confirmationStatus !== 'confirmed').length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-yellow-50 border border-yellow-100 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Tickets list */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Your Ticket List</h2>
              <Link
                to="/attendee/tickets"
                className="text-brand-main hover:text-blue-700 text-sm font-bold hover:underline inline-flex items-center space-x-1"
              >
                <span>View All</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto">
                  <TicketIcon className="h-8 w-8 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">No tickets found</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1">
                    You haven't been assigned or purchased any tickets yet.
                  </p>
                </div>
                <div>
                  <Link
                    to="/events"
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-main hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
                  >
                    <span>Browse Events</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.slice(0, 3).map((ticket) => (
                  <AttendeeTicketCard key={ticket._id} ticket={ticket} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Help Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Actions Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Quick Services</h3>
              <p className="text-slate-500 text-sm mb-4">Easily browse and modify your profile or tickets</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/attendee/tickets"
                className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 hover:scale-[1.01] transition-all text-center space-y-2 group"
              >
                <TicketIcon className="h-6 w-6 text-brand-main group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800">My Tickets</span>
              </Link>
              
              <Link
                to="/attendee/events"
                className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 hover:scale-[1.01] transition-all text-center space-y-2 group"
              >
                <CalendarIcon className="h-6 w-6 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800">Browse Events</span>
              </Link>
              
              <Link
                to="/attendee/profile"
                className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 hover:scale-[1.01] transition-all text-center space-y-2 group"
              >
                <UserCircleIcon className="h-6 w-6 text-purple-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800">My Profile</span>
              </Link>
              
              <Link
                to="/attendee/notifications"
                className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 hover:scale-[1.01] transition-all text-center space-y-2 group"
              >
                <BellIcon className="h-6 w-6 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800">Notifications</span>
              </Link>
            </div>
          </div>

          {/* Help & Support Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Help & Support</h3>
              <p className="text-slate-500 text-sm">Need assistance with your ticket, verification, or gate entry?</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <QuestionMarkCircleIcon className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Digital QR Instructions</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Please ensure your screen brightness is turned up at the gates.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                <UserCircleIcon className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Photo Requirements</h4>
                  <p className="text-slate-500 text-xs mt-0.5">Verification photos must be clear portraits of your face without hats/glasses.</p>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 text-center border-t border-slate-100 pt-3">
              Contact us at <span className="font-semibold text-slate-600">support@entrynex.com</span>
            </div>
          </div>
        </div>

      </div>
    </AttendeeLayout>
  );
};

export default AttendeeDashboardPage;
