import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { format } from 'date-fns';
import PublicLayout from '../../components/layout/PublicLayout';
import Badge from '../../components/ui/Badge';
import { getEvents } from '../../api/events';

const buildAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  return `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
};

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
      <div id="events" className="max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900">
            Upcoming <span className="text-blue-700">Events</span>
          </h2>
          <div className="mt-3 h-1.5 w-24 rounded-full bg-blue-600"></div>
          <p className="mb-14 mt-6 max-w-2xl text-lg text-slate-600">
            Don't miss out on the action. Select an event below to view ticket categories, stadium zones, and prices.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[420px] rounded-2xl border border-slate-200 bg-slate-100 animate-pulse"
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
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const categories = event.categories || [];
              const minPrice = categories.length > 0 ? Math.min(...categories.map(c => c.price)) : 0;
              const hasFree = categories.some(c => c.price === 0);
              const eventImage = event.coverImage || event.bannerImage || event.branding?.bannerImage;

              return (
                <Link
                  key={event._id}
                  to={`/events/${event.slug || event._id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 transition-all hover:-translate-y-2 hover:border-blue-600 hover:shadow-blue-900/20"
                >
                  <div className="relative h-60 overflow-hidden bg-slate-200">
                    {eventImage ? (
                      <img
                        src={buildAssetUrl(eventImage)}
                        alt={event.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-slate-800 text-slate-400 text-6xl uppercase font-black">
                        {event.name.substring(0,2)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="flex justify-between items-end">
                        <div>
                          <Badge color="sky" className="mb-2 !bg-sky-400 !text-slate-900 border-none font-bold uppercase tracking-widest text-[10px]">
                            {event.eventType || 'Cricket Match'}
                          </Badge>
                          <h3 className="line-clamp-2 text-2xl font-black leading-tight text-white transition-colors group-hover:text-sky-400">
                            {event.name}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 p-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 text-slate-600 font-medium">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-blue-600">
                          <CalendarDaysIcon className="h-5 w-5" />
                        </div>
                        {event.startDate ? format(new Date(event.startDate), 'EEEE, MMM d, yyyy') : 'TBD'}
                      </div>
                      <div className="flex items-start gap-3 text-slate-600 font-medium">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-blue-600 flex-shrink-0 mt-0.5">
                          <MapPinIcon className="h-5 w-5" />
                        </div>
                        <span className="line-clamp-2 leading-tight py-1">{event.venue?.name || 'TBD'} {event.venue?.city ? `, ${event.venue.city}` : ''}</span>
                      </div>
                    </div>

                    <div className="mt-8 border-t border-slate-100 pt-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Starting From</p>
                        <p className="text-xl font-black text-slate-900">
                           {minPrice > 0 ? `LKR ${minPrice.toLocaleString()}` : hasFree ? 'Free' : 'TBD'}
                        </p>
                      </div>
                      <span className="rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors group-hover:border-blue-600 group-hover:bg-blue-600 group-hover:text-white">
                        Get Tickets
                      </span>
                    </div>
                  </div>
                </Link>
              );
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
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default HomePage;
