import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvents } from '../../api/events';
import PublicEventCard from '../../components/events/PublicEventCard';

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents({ limit: 3, status: 'published' })
      .then((res) => {
        setEvents(res.data?.data?.events || []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PublicLayout>
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2805&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-28 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-4 py-1.5 text-sm font-medium text-sky-300 backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
            Live Updates & Tickets Available
          </div>
          <h1 className="mt-8 text-5xl font-black uppercase tracking-tight leading-tight md:text-7xl">
            Experience the <span className="text-sky-400">Match Live</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-300 font-medium pb-2">
            Secure your seats for the biggest cricket events. VVIP, VIP, General Admission, and Media passes available now.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/events"
              className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-900/50 transition-all hover:bg-blue-500 hover:scale-105 active:scale-95"
            >
              Browse Events
            </Link>
            <Link
              to="/login"
              className="rounded-xl border-2 border-slate-600 bg-slate-900/50 px-8 py-4 text-lg font-bold text-slate-300 backdrop-blur-sm transition-all hover:border-slate-400 hover:text-white"
            >
              Partner Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Featured Events Section */}
      <div id="events" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900">
            Upcoming <span className="text-blue-700">Events</span>
          </h2>
          <div className="mt-3 h-1.5 w-24 rounded-full bg-blue-600"></div>
          <p className="mb-12 mt-6 max-w-2xl text-lg text-slate-600">
            Don't miss out on the action. Select an event below to view ticket categories, stadium zones, and prices.
          </p>
        </div>

        {loading ? (
          <div className="mx-auto grid max-w-[1220px] grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:gap-10">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[460px] rounded-2xl border border-slate-200 bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <CalendarDaysIcon className="h-10 w-10 text-slate-400" />
            </div>
            <p className="mt-4 text-xl font-medium text-slate-900">No events found</p>
            <p className="text-slate-500">There are no published events at this time. Check back later!</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1220px] grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:gap-10">
            {events.map((event) => {
              return <PublicEventCard key={event._id} event={event} />;
            })}
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-16 text-center">
             <Link
              to="/events"
              className="inline-flex items-center gap-2 text-lg font-bold text-blue-700 hover:text-blue-600 transition-colors group"
            >
              View all upcoming matches 
              <ChevronRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default HomePage;
