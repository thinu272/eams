import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
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
  const themeColor = event.branding?.themeColor || '#2563EB';
  const eventImage = event.branding?.bannerImage || event.coverImage || event.bannerImage;

  return (
    <Link
      to={`/events/${event.slug || event._id}`}
      className="group card-premium flex h-full min-h-[460px] flex-col p-0 overflow-hidden"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {eventImage ? (
          <img
            src={buildAssetUrl(eventImage)}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-5xl font-black uppercase text-slate-700">
            {event.name.substring(0, 2)}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>

        <div className="absolute left-5 top-5">
          <div
            className="rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-lg backdrop-blur-md bg-white/20 border border-white/30"
          >
            {event.eventType || 'Cricket Match'}
          </div>
        </div>

        {categories.length > 0 && categories.every(c => c.sold >= c.capacity) && (
          <div className="absolute right-5 top-5">
            <div
              className="rounded-full bg-rose-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-rose-900/40"
            >
              Sold Out
            </div>
          </div>
        )}

        <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
           {event.branding?.logoImage && (
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/90 p-2 shadow-2xl backdrop-blur-sm border border-white/50">
              <img
                src={buildAssetUrl(event.branding.logoImage)}
                alt={`${event.name} logo`}
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <div className="text-right">
             <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
              Tickets From
            </span>
            <span className="mt-1 block text-lg font-black text-white">
              {minPrice > 0
                ? `${event.settings?.currency || 'LKR'} ${minPrice.toLocaleString()}`
                : hasFree
                  ? 'Free'
                  : 'TBD'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="line-clamp-2 min-h-[4rem] text-2xl font-black leading-tight text-slate-900 transition-colors group-hover:text-brand-main">
          {event.name}
        </h3>

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-brand-main">
               <CalendarDaysIcon className="h-4 w-4" />
            </div>
            <span>
              {event.startDate
                ? new Date(event.startDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'TBD'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-brand-main">
               <MapPinIcon className="h-4 w-4" />
            </div>
            <span className="line-clamp-1">{event.venue?.name || 'TBD'}</span>
          </div>
        </div>

        <div className="mt-8">
           <div className="btn-premium w-full text-center py-3 bg-slate-900 text-sm tracking-widest uppercase font-black group-hover:bg-brand-main group-hover:shadow-brand-main/40 transition-all duration-500">
            View Experience
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PublicEventCard;
