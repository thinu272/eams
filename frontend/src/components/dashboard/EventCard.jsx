import React from 'react';
import { Link } from 'react-router-dom';

const EventCard = ({ event }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs uppercase tracking-widest text-slate-400">Upcoming Event</p>
    <h3 className="text-lg font-bold text-slate-900">{event.name}</h3>
    <p className="text-sm text-slate-500">{event.venue?.name}</p>
    <p className="text-xs text-slate-400 mt-1">{event.startDate ? new Date(event.startDate).toLocaleDateString() : ''}</p>
    <Link to="/events" className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700">
      Browse Tickets →
    </Link>
  </div>
);

export default EventCard;
