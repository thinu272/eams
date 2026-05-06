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
      <div className="relative min-h-[85vh] flex items-center overflow-hidden bg-brand-dark text-white">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-main/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-brand-accent/20 rounded-full blur-[100px] animate-float"></div>
        </div>
        
        <div className="absolute inset-0 bg-slate-950">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-slate-900 to-blue-900/20" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-300 backdrop-blur-md animate-fade-in">
            <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)]"></span>
            Next-Gen Event Experience
          </div>
          
          <h1 className="mt-8 text-4xl font-black uppercase tracking-tighter leading-tight md:text-6xl lg:text-7xl animate-fade-in [animation-delay:100ms] whitespace-nowrap">
            Live the <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-main via-blue-400 to-cyan-400">Moment</span>
          </h1>
          
          <p className="mx-auto mt-10 max-w-2xl text-lg md:text-xl text-slate-400 font-medium leading-relaxed animate-fade-in [animation-delay:200ms]">
            ENTRYNEX platform secures your seats for the most exclusive events. <br className="hidden md:block"/>
            From stadium matches to premium conferences, we handle the access.
          </p>
          
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 animate-fade-in [animation-delay:300ms]">
            <Link
              to="/events"
              className="btn-premium group flex items-center gap-3 px-10 py-5 text-lg"
            >
              Secure Tickets
              <ChevronRightIcon className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/login"
              className="px-10 py-5 text-lg font-bold text-slate-300 hover:text-white transition-all border border-white/10 rounded-2xl hover:bg-white/5 backdrop-blur-sm"
            >
              Organiser Login
            </Link>
          </div>
        </div>
      </div>

      {/* Featured Events Section */}
      <div id="events" className="relative z-10 mx-auto max-w-[1400px] px-6 py-32">
        <div className="flex flex-col items-center text-center mb-24">
          <p className="text-xs font-black uppercase tracking-[0.5em] text-brand-main mb-4 opacity-80">Discovery</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-tight">
            Featured <br className="md:hidden"/> <span className="text-brand-main">Experiences</span>
          </h2>
          <div className="mt-8 h-1.5 w-32 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full w-1/3 bg-brand-main rounded-full animate-shimmer"></div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[500px] rounded-[32px] border border-slate-100 bg-white/50 animate-pulse shimmer-effect"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center glass rounded-[40px] border-dashed border-slate-200">
            <div className="inline-flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 text-slate-300">
              <CalendarDaysIcon className="h-12 w-12" />
            </div>
            <p className="mt-6 text-2xl font-black text-slate-900">Stay Tuned</p>
            <p className="mt-2 text-slate-500 font-medium">New experiences are being curated as we speak.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              return <PublicEventCard key={event._id} event={event} />;
            })}
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-20 text-center">
             <Link
              to="/events"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-white border border-slate-200 text-sm font-black uppercase tracking-widest text-slate-900 hover:bg-slate-50 hover:border-brand-main transition-all group"
            >
              Explore all events 
              <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1 text-brand-main" />
            </Link>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default HomePage;
