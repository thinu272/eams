import React from 'react';
import { TicketIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

const EmptyState = ({ title = 'No entry passes yet', message = 'Complete your ticket configuration to retrieve entry passes or invite guests.', actionLink = '/buyer/tickets', actionText = 'Manage Purchased Tickets' }) => {
  return (
    <div className="rounded-[32px] bg-white border border-slate-200 p-8 sm:p-12 text-center shadow-sm max-w-xl mx-auto my-8">
      <div className="mx-auto h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
        <TicketIcon className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="mt-6 text-xl font-extrabold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">{message}</p>
      {actionLink && (
        <Link
          to={actionLink}
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand-main px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-dark transition-all active:scale-95"
        >
          <span>{actionText}</span>
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
};

export default EmptyState;
