import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { getEvents } from '../../api/events';
import { format } from 'date-fns';
import PublicLayout from '../../components/layout/PublicLayout';
import Badge from '../../components/ui/Badge';

const statusColor = { published: 'green', ongoing: 'blue', completed: 'gray', cancelled: 'red' };

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents({ status: 'published' }).then(r => setEvents(r.data.data.events)).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-700/50 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Tickets now available
          </div>
          <h1 className="text-5xl font-bold mb-4 leading-tight">Experience the Match Live</h1>
          <p className="text-xl text-blue-200 mb-8 max-w-2xl mx-auto">Secure your seats for the biggest cricket events. VIP, General, School, and Media tickets available.</p>
          <a href="/events" className="bg-white text-blue-900 px-8 py-3 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors inline-block">Browse Events</a>
        </div>
      </div>

      {/* Events */}
      <div id="events" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Upcoming Events</h2>
        <p className="text-gray-500 mb-10">Select an event to view details and purchase tickets.</p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No events available at this time.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map(event => (
              <Link key={event._id} to={`/events/${event.slug}`} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all hover:border-blue-300">
                <div className="relative h-36 overflow-hidden">
                  {event.coverImage ? (
                    <img
                      src={`http://localhost:5000/${event.coverImage}`}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800"></div>
                  )}
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div>
                      {event.matchDetails?.teamA && (
                        <p className="text-white text-xs font-medium mb-1">{event.matchDetails.teamA} vs {event.matchDetails.teamB}</p>
                      )}
                      <Badge color={statusColor[event.status] || 'gray'}>{event.status}</Badge>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2 leading-tight">{event.name}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                    <CalendarDaysIcon className="h-4 w-4 text-blue-500" />
                    <span>{format(new Date(event.startDate), 'EEE, MMM d yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
                    <MapPinIcon className="h-4 w-4 text-blue-500" />
                    <span>{event.venue?.name}, {event.venue?.city}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(event.categories || []).slice(0, 3).map(cat => (
                      <span key={cat.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {cat.name} — {cat.price === 0 ? 'Free' : `LKR ${cat.price.toLocaleString()}`}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default HomePage;
