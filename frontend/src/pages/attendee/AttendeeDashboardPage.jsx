import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AttendeeLayout from '../../components/attendee/AttendeeLayout';
import AttendeeTicketCard from '../../components/attendee/AttendeeTicketCard';
import api from '../../api/client';
import { 
  TicketIcon, 
  CalendarIcon, 
  MapPinIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

const AttendeeDashboardPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
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
      <div className="p-6">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back!</h1>
          <p className="text-gray-600">
            {primaryTicket ? `Your next event: ${primaryTicket.event?.name}` : 'Manage your tickets and event information'}
          </p>
        </div>

        {/* Action Required Banner */}
        {(needsConfirmation || needsPhoto) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800">Action Required</h3>
                <p className="text-amber-700 text-sm mt-1">
                  {needsConfirmation && 'Complete confirmation process'}
                  {needsConfirmation && needsPhoto && ' and '}
                  {needsPhoto && 'upload photo verification'}
                  {' to activate your tickets.'}
                </p>
                <div className="mt-3">
                  <Link
                    to="/attendee/tickets"
                    className="inline-flex items-center space-x-2 text-amber-800 text-sm font-medium hover:text-amber-900"
                  >
                    <span>View Tickets</span>
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Primary Event Card */}
        {primaryTicket && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-4">
                  <TicketIcon className="h-8 w-8" />
                  <h2 className="text-xl font-bold">{primaryTicket.event?.name}</h2>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 text-blue-100">
                    <CalendarIcon className="h-4 w-4" />
                    <span>{formatDate(primaryTicket.event?.startDate)} at {formatTime(primaryTicket.event?.startDate)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-blue-100">
                    <MapPinIcon className="h-4 w-4" />
                    <span>{primaryTicket.event?.venue?.name || 'Venue TBD'}</span>
                  </div>
                  
                  <div className="flex items-center space-x-3 text-blue-100">
                    <TicketIcon className="h-4 w-4" />
                    <span>Ticket #{primaryTicket.ticketNumber}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center space-x-2 mb-2">
                  {primaryTicket.attendee?.confirmationStatus === 'confirmed' ? (
                    <>
                      <CheckCircleSolid className="h-5 w-5 text-green-300" />
                      <span className="text-green-300">Confirmed</span>
                    </>
                  ) : (
                    <>
                      <ClockIcon className="h-5 w-5 text-yellow-300" />
                      <span className="text-yellow-300">Pending</span>
                    </>
                  )}
                </div>
                
                <Link
                  to={`/attendee/ticket/${primaryTicket._id}`}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <span>View Ticket</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
              </div>
              <TicketIcon className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Confirmed</p>
                <p className="text-2xl font-bold text-green-600">
                  {tickets.filter(t => t.attendee?.confirmationStatus === 'confirmed').length}
                </p>
              </div>
              <CheckCircleSolid className="h-8 w-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Action</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {tickets.filter(t => !t.attendee?.isConfirmed || t.attendee?.confirmationStatus !== 'confirmed').length}
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Your Tickets</h2>
              <Link
                to="/attendee/tickets"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                View All
              </Link>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-8">
                <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets yet</h3>
                <p className="text-gray-600 mb-4">
                  You haven't purchased any tickets yet
                </p>
                <Link
                  to="/events"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <span>Browse Events</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
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

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/attendee/tickets"
                className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View All Tickets
              </Link>
              <Link
                to="/attendee/events"
                className="block w-full text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Event Details
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
            <div className="space-y-3">
              <Link
                to="/attendee/profile"
                className="block w-full text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Update Profile
              </Link>
              <Link
                to="/attendee/notifications"
                className="block w-full text-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                View Notifications
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AttendeeLayout>
  );
};

export default AttendeeDashboardPage;
