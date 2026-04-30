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
      className="group flex h-full min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/10"
    >
      <div className="relative aspect-[16/11] overflow-hidden bg-slate-100">
        {eventImage ? (
          <img
            src={buildAssetUrl(eventImage)}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800 text-5xl font-black uppercase text-slate-400">
            {event.name.substring(0, 2)}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent"></div>

        <div className="absolute left-4 top-4">
          <Badge
            color="sky"
            className="border-none px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg"
            style={{ backgroundColor: themeColor }}
          >
            {event.eventType || 'Cricket Match'}
          </Badge>
        </div>

        {categories.length > 0 && categories.every(c => c.sold >= c.capacity) && (
          <div className="absolute right-4 top-4">
            <Badge
              color="red"
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg bg-red-600 border-none"
            >
              Sold Out
            </Badge>
          </div>
        )}

        {event.branding?.logoImage && (
          <div className="absolute bottom-4 left-4 h-12 w-12 overflow-hidden rounded-xl bg-white p-1.5 shadow-xl ring-2 ring-white/20">
            <img
              src={buildAssetUrl(event.branding.logoImage)}
              alt={`${event.name} logo`}
              className="h-full w-full object-contain"
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="line-clamp-2 min-h-[4rem] text-2xl font-black leading-tight text-slate-900 transition-colors group-hover:text-blue-700 lg:text-[2rem]">
          {event.name}
        </h3>

        <div className="mt-6 space-y-3.5">
          <div className="flex items-start gap-3 text-[15px] font-medium text-slate-600">
            <CalendarDaysIcon className="h-5 w-5 flex-shrink-0" style={{ color: themeColor }} />
            <span className="leading-tight">
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

          <div className="flex items-start gap-3 text-[15px] font-medium text-slate-600">
            <MapPinIcon className="h-5 w-5 flex-shrink-0" style={{ color: themeColor }} />
            <span className="line-clamp-2 leading-tight">{event.venue?.name || 'TBD'}</span>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-5">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Tickets From
            </span>
            <span className="mt-1.5 block text-[1.05rem] font-black text-slate-900">
              {minPrice > 0
                ? `${event.settings?.currency || 'LKR'} ${minPrice.toLocaleString()}`
                : hasFree
                  ? 'Free'
                  : 'TBD'}
            </span>
          </div>

          <span
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-opacity group-hover:opacity-95"
            style={{ backgroundColor: themeColor }}
          >
            Details
          </span>
        </div>
      </div>
    </Link>
  );
};

export default PublicEventCard;
