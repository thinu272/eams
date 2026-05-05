import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Badge from '../ui/Badge';

const buildAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const PublicEventCard = ({ event }) => {
  const categories = event.categories || [];
  const minPrice = categories.length > 0 ? Math.min(...categories.map((category) => category.price)) : 0;
  const hasFree = categories.some((category) => category.price === 0);
  const themeColor = '#2563EB'; // Reverted to default brand blue
  const eventImage = event.branding?.bannerImage || event.coverImage || event.bannerImage;

  return (
    <Link
      to={`/events/${event.slug || event._id}`}
      className="group flex flex-col bg-white rounded-[40px] overflow-hidden border border-slate-100 hover:border-brand-main/30 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] transition-all duration-500 h-full"
    >
      <div className="relative aspect-[16/11] overflow-hidden bg-slate-50">
        {eventImage ? (
          <img
            src={buildAssetUrl(eventImage)}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-6xl font-black uppercase text-slate-800">
            {event.name.substring(0, 2)}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>

        <div className="absolute left-6 top-6">
          <div
            className="rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white backdrop-blur-md bg-white/10 border border-white/20"
          >
            {event.eventType === 'other' && event.customEventType ? event.customEventType : (event.eventType || 'Experience')}
          </div>
        </div>

        {categories.length > 0 && categories.every(c => c.sold >= c.capacity) && (
          <div className="absolute right-6 top-6">
            <div
              className="rounded-full bg-rose-500 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-500/30"
            >
              Sold Out
            </div>
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
           {event.branding?.logoImage ? (
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white p-2.5 shadow-2xl transition-transform duration-500 group-hover:-translate-y-2">
              <img
                src={buildAssetUrl(event.branding.logoImage)}
                alt={`${event.name} logo`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : <div className="w-16" />}
          
          <div className="text-right">
             <span className="block text-[9px] font-black uppercase tracking-[0.3em] text-white/60 mb-1">
              Admission from
            </span>
            <span className="block text-2xl font-black text-white tracking-tighter">
              {minPrice > 0
                ? `${event.settings?.currency || 'LKR'} ${minPrice.toLocaleString()}`
                : hasFree
                  ? 'FREE'
                  : 'TBD'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-8">
        <h3 className="line-clamp-2 min-h-[4.5rem] text-2xl md:text-3xl font-black leading-[1.1] text-slate-900 group-hover:text-brand-main transition-colors">
          {event.name}
        </h3>

        <div className="mt-8 flex flex-col gap-4">
          <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-brand-main border border-slate-100 group-hover:bg-brand-main/5 group-hover:border-brand-main/20 transition-colors">
               <CalendarDaysIcon className="h-5 w-5" />
            </div>
            <span className="text-slate-600">
              {event.startDate
                ? new Date(event.startDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Date to be announced'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-brand-main border border-slate-100 group-hover:bg-brand-main/5 group-hover:border-brand-main/20 transition-colors">
               <MapPinIcon className="h-5 w-5" />
            </div>
            <span className="line-clamp-1 text-slate-600">{event.venue?.name || 'Venue to be confirmed'}</span>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-50">
           <div className="flex items-center justify-between group/btn">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 group-hover:text-brand-main transition-colors">Secure Tickets</span>
              <div className="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center text-white transition-all duration-500 group-hover:bg-brand-main group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                <ChevronRightIcon className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-0.5" />
              </div>
           </div>
        </div>
      </div>
    </Link>
  );
};

export default PublicEventCard;
