import React, { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import PublicLayout from '../../components/layout/PublicLayout';
import { getEvents } from '../../api/events';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../../utils/backend';
import PublicEventCard from '../../components/events/PublicEventCard';

const EventsListingPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    date: '',
    category: '',
  });

  // Unique categories derived from events list if we don't have a specific endpoint
  const [availableCategories, setAvailableCategories] = useState([]);

  const fetchEvents = () => {
    setLoading(true);
    getEvents({ 
      limit: 50,
      search: filters.search || undefined,
      date: filters.date || undefined,
      category: filters.category || undefined
    })
      .then((res) => {
        const fetched = res.data?.data?.events || [];
        setEvents(fetched);
        
        // Extract unique eventTypes for the filter dropdown if not fully loaded yet
        if (filters.category === '' && filters.search === '' && filters.date === '') {
           const types = [...new Set(fetched.map(e => (e.eventType === 'other' && e.customEventType) ? e.customEventType : e.eventType).filter(Boolean))];
           setAvailableCategories(types.length > 0 ? types : ['Cricket Match', 'Tournament', 'VIP Event']);
        }
      })
      .catch((err) => {
        console.error('FETCH_EVENTS_ERROR:', err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Debounce the search fetch
    const timeoutId = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    const socket = io(getSocketUrl());
    
    socket.on('event_update', (data) => {
      console.log('Listing update received:', data);
      fetchEvents();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: '', date: '', category: '' });
  };

  return (
    <PublicLayout>
      {/* Header Section */}
      <section className="bg-slate-950 text-white border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
              Match <span className="text-sky-400">Fixtures</span>
            </h1>
            <p className="mt-4 text-lg text-slate-400 font-medium max-w-xl">
              Browse the official calendar for upcoming matches. Filter by date or match type to find your perfect experience.
            </p>
          </div>
        </div>
      </section>

      {/* Filter & Listing Section */}
      <section className="bg-slate-50 min-h-screen pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Filters Bar */}
          <div className="-mt-8 rounded-2xl bg-white p-4 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">
            <div className="flex flex-col lg:flex-row gap-4">
              
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search events, teams, or venues..."
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Date */}
              <div className="lg:w-48">
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => updateFilter('date', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div className="lg:w-48">
                <select
                  value={filters.category}
                  onChange={(e) => updateFilter('category', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 appearance-none"
                >
                  <option value="">All Types</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Clear */}
              {(filters.search || filters.date || filters.category) && (
                <button
                  onClick={clearFilters}
                  className="rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Clear
                </button>
              )}

            </div>
          </div>

          {/* Results Info */}
          <div className="mt-10 mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {loading ? 'Searching...' : `${events.length} Event${events.length !== 1 ? 's' : ''} Found`}
            </h2>
          </div>

          {/* Listing Grid */}
          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[1,2,3,4,5,6].map(i => <div key={i} className="h-80 bg-slate-200 animate-pulse rounded-2xl"></div>)}
             </div>
          ) : events.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white py-24 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
                <MagnifyingGlassIcon className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-900">No events matched your search.</p>
              <p className="mt-2 text-slate-500">Try adjusting your filters or date range.</p>
              <button onClick={clearFilters} className="mt-6 text-blue-600 font-bold hover:text-blue-700">Clear all filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <PublicEventCard key={event._id} event={event} />
              ))}
            </div>
          )}

        </div>
      </section>
    </PublicLayout>
  );
};

export default EventsListingPage;
