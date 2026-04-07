import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import PublicLayout from '../../components/layout/PublicLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { getUserDashboard, updateUserProfile } from '../../api/userPortal';
import toast from 'react-hot-toast';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tickets', label: 'My Tickets' },
  { id: 'profile', label: 'Profile' },
];

const statusColors = {
  PENDING: 'yellow',
  ASSIGNED: 'blue',
  INVITED: 'blue',
  CONFIRMED: 'green',
  CANCELLED: 'red',
};

const buildAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000'}${path}`;
};

const createCalendarFile = (ticket) => {
  if (!ticket?.event?.startDate) return;

  const start = new Date(ticket.event.startDate);
  const end = new Date(ticket.event.endDate || ticket.event.startDate);
  const formatDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${ticket._id}@eams`,
    `SUMMARY:${ticket.event.name}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `LOCATION:${ticket.event.venue?.name || ''} ${ticket.event.venue?.city || ''}`.trim(),
    `DESCRIPTION:Ticket category: ${ticket.categoryName}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${ticket.event.name}-event.ics`;
  link.click();
  URL.revokeObjectURL(url);
};

const BuyerDashboardPage = () => {
  const { user, loadUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    getUserDashboard()
      .then((response) => {
        const data = response.data?.data || {};
        setUpcomingEvents(data.upcomingEvents || []);
        setPastEvents(data.pastEvents || []);
        setTickets(data.tickets || []);
        setNotifications(data.notifications || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
  }, [user]);

  const confirmedTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'CONFIRMED'),
    [tickets]
  );

  const pendingTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status !== 'CONFIRMED'),
    [tickets]
  );

  const handleProfileSave = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateUserProfile(profile);
      await loadUser();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Buyer & Attendee Portal</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">My Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Track upcoming events, open ticket details, revisit past attendance, and keep your contact details current.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader title="Upcoming Events" subtitle="Events you are set to attend next" />
                      <div className="space-y-4">
                        {upcomingEvents.map((ticket) => (
                          <div key={ticket._id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                              {ticket.event?.coverImage && (
                                <img src={buildAssetUrl(ticket.event.coverImage)} alt={ticket.event.name} className="h-20 w-24 rounded-xl object-cover" />
                              )}
                              <div>
                                <p className="text-lg font-semibold text-gray-900">{ticket.event?.name}</p>
                                <p className="text-sm text-gray-500">{ticket.event?.startDate ? format(new Date(ticket.event.startDate), 'EEE, MMM d yyyy • h:mm a') : 'Date pending'}</p>
                                <p className="mt-1 text-sm text-gray-700">{ticket.categoryName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge color={statusColors[ticket.status] || 'gray'}>{ticket.status}</Badge>
                              <Link to={`/ticket/${ticket._id}`}><Button variant="outline">View Ticket</Button></Link>
                            </div>
                          </div>
                        ))}
                        {upcomingEvents.length === 0 && (
                          <div className="rounded-2xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">No upcoming events linked to your account yet.</div>
                        )}
                      </div>
                    </Card>

                    <Card>
                      <CardHeader title="Past Events" subtitle="Your event history" />
                      <div className="space-y-3">
                        {pastEvents.map((ticket) => (
                          <div key={ticket._id} className="rounded-2xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-gray-900">{ticket.event?.name}</p>
                                <p className="text-sm text-gray-500">{ticket.event?.endDate ? format(new Date(ticket.event.endDate), 'MMM d, yyyy') : 'Completed event'}</p>
                              </div>
                              <Badge color="gray">{ticket.categoryName}</Badge>
                            </div>
                          </div>
                        ))}
                        {pastEvents.length === 0 && (
                          <div className="rounded-2xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">No past events found.</div>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader title="My Summary" subtitle="A quick view of your ticket activity" />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-blue-50 p-4">
                          <p className="text-sm text-blue-700">Total Tickets</p>
                          <p className="mt-2 text-3xl font-bold text-blue-700">{tickets.length}</p>
                        </div>
                        <div className="rounded-2xl bg-green-50 p-4">
                          <p className="text-sm text-green-700">Confirmed</p>
                          <p className="mt-2 text-3xl font-bold text-green-700">{confirmedTickets.length}</p>
                        </div>
                        <div className="rounded-2xl bg-amber-50 p-4">
                          <p className="text-sm text-amber-700">Pending</p>
                          <p className="mt-2 text-3xl font-bold text-amber-700">{pendingTickets.length}</p>
                        </div>
                        <div className="rounded-2xl bg-purple-50 p-4">
                          <p className="text-sm text-purple-700">Past Events</p>
                          <p className="mt-2 text-3xl font-bold text-purple-700">{pastEvents.length}</p>
                        </div>
                      </div>
                    </Card>

                    <Card>
                      <CardHeader title="Notification Center" subtitle="Recent ticket and event updates" />
                      <div className="space-y-3">
                        {notifications.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-gray-200 p-4">
                            <p className="font-medium text-gray-900">{item.message}</p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">{item.type.replace('_', ' ')}</p>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <div className="rounded-2xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">No notifications right now.</div>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'tickets' && (
                <Card>
                  <CardHeader title="My Tickets" subtitle="All tickets linked to you as a buyer or attendee" />
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {tickets.map((ticket) => (
                      <div key={ticket._id} className="rounded-2xl border border-gray-200 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-gray-900">{ticket.event?.name}</p>
                            <p className="text-sm text-gray-500">{ticket.categoryName}</p>
                          </div>
                          <Badge color={statusColors[ticket.status] || 'gray'}>{ticket.status}</Badge>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>{ticket.event?.startDate ? format(new Date(ticket.event.startDate), 'EEE, MMM d yyyy • h:mm a') : 'Date pending'}</p>
                            <p>{ticket.event?.venue?.name}{ticket.event?.venue?.city ? `, ${ticket.event.venue.city}` : ''}</p>
                            <p>Ticket No: {ticket.ticketNumber}</p>
                          </div>
                          {ticket.attendee?.qrCode ? (
                            <img src={ticket.attendee.qrCode} alt="Ticket QR" className="h-24 w-24 rounded-xl border border-gray-200 bg-white object-contain p-2" />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center text-xs text-gray-400">
                              QR pending
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link to={`/ticket/${ticket._id}`}><Button variant="outline">View Ticket</Button></Link>
                          <Button variant="outline" onClick={() => createCalendarFile(ticket)}>Add to Calendar</Button>
                          <Button variant="outline" onClick={() => window.print()}>Download Ticket (PDF)</Button>
                        </div>
                      </div>
                    ))}
                    {tickets.length === 0 && (
                      <div className="rounded-2xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">No tickets found for your account.</div>
                    )}
                  </div>
                </Card>
              )}

              {activeTab === 'profile' && (
                <Card className="max-w-2xl">
                  <CardHeader title="Profile" subtitle="Manage the contact details used for your orders and notifications" />
                  <form onSubmit={handleProfileSave} className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                      <input value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                      <input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                      <input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" loading={savingProfile}>Save Profile</Button>
                    </div>
                  </form>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default BuyerDashboardPage;
