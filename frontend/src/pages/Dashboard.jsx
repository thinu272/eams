import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getUserDashboard } from '../api/userPortal';
import TicketCard from '../components/dashboard/TicketCard';
import EventCard from '../components/dashboard/EventCard';
import ActivityItem from '../components/dashboard/ActivityItem';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { getDashboardPathForRole } from '../config/roleNavigation';

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const roleDashboardPath = getDashboardPathForRole(user?.role);
  if (user?.role && roleDashboardPath !== '/dashboard') {
    return <Navigate to={roleDashboardPath} replace />;
  }

  useEffect(() => {
    getUserDashboard()
      .then((res) => {
        const payload = res.data?.data || {};
        setData({
          currentTickets: payload.tickets || [],
          previousOrders: [],
          assignedEvents: [],
          upcomingPublicEvents: (payload.upcomingEvents || [])
            .map((ticket) => ticket.event)
            .filter(Boolean),
          recentActivity: (payload.notifications || []).map((item) => ({
            id: item.id,
            title: item.type,
            description: item.message,
          })),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const activeTicket = useMemo(() => {
    return data?.currentTickets?.[0] || null;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-r from-blue-900 to-blue-700 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-200">My Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold">Welcome back, {user?.name || 'User'}!</h1>
          <p className="mt-2 text-sm text-blue-100">One place to see everything you need.</p>
        </div>

        {loading && <p className="mt-6 text-sm text-blue-100">Loading your dashboard…</p>}

        {!loading && (
          <div className="mt-8 space-y-10 text-slate-900">
            {data?.currentTickets?.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">My Current Tickets</h2>
                <div className="grid grid-cols-1 gap-4">
                  <TicketCard ticket={activeTicket} />
                </div>
                <div className="flex gap-3">
                  <Link to="/attendee/dashboard"><Button>Show Full Ticket</Button></Link>
                  <Link to="/buyer/dashboard"><Button variant="outline">View Buyer Dashboard</Button></Link>
                </div>
              </section>
            )}

            {data?.previousOrders?.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">Previous Orders</h2>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {data.previousOrders.map((order) => (
                    <div key={order._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Order {order.orderNumber}</p>
                      <h3 className="text-lg font-bold text-slate-900">{order.event?.name}</h3>
                      <p className="text-sm text-slate-500">{order.event?.venue?.name}</p>
                      <p className="text-sm font-semibold text-slate-900 mt-2">LKR {Number(order.totalAmount || 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data?.assignedEvents?.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">My Events</h2>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {data.assignedEvents.map((event) => (
                    <div key={event._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Assigned Event</p>
                      <h3 className="text-lg font-bold text-slate-900">{event.name}</h3>
                      <p className="text-sm text-slate-500">{event.venue?.name}</p>
                      <div className="mt-3 text-xs text-slate-500">
                        Confirmed: <span className="font-semibold text-slate-700">{event.stats?.confirmed || 0}</span> /
                        Total: <span className="font-semibold text-slate-700">{event.stats?.total || 0}</span> /
                        Checked-in: <span className="font-semibold text-slate-700">{event.stats?.checkedIn || 0}</span>
                      </div>
                      <Button className="mt-4">Go to Event Dashboard</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">Upcoming Events</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {data?.upcomingPublicEvents?.map((event) => <EventCard key={event._id} event={event} />)}
                {(!data?.upcomingPublicEvents || data.upcomingPublicEvents.length === 0) && (
                  <div className="rounded-2xl border border-dashed border-blue-400/40 bg-blue-900/30 p-6 text-sm text-blue-100">
                    No upcoming events yet. <Link className="underline" to="/events">Browse events</Link>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white">Recent Activity</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data?.recentActivity?.map((item) => <ActivityItem key={item.id} item={item} />)}
                {(!data?.recentActivity || data.recentActivity.length === 0) && (
                  <div className="rounded-2xl border border-dashed border-blue-400/40 bg-blue-900/30 p-6 text-sm text-blue-100">
                    No recent activity yet.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-blue-800/40 bg-blue-900/40 p-6 text-white">
              <h2 className="text-xl font-bold">Quick Actions</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/events"><Button>Browse Events</Button></Link>
                <Link to="/buyer/dashboard"><Button variant="outline">My Orders</Button></Link>
                <Link to="/attendee/dashboard"><Button variant="outline">My Tickets</Button></Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
