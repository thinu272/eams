import React from 'react';
import { Link } from 'react-router-dom';
import { QrCodeIcon, ArrowDownTrayIcon, CalendarIcon, MapPinIcon, ShieldCheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import QRCodeDisplay from '../attendee/QRCodeDisplay';

const TicketCard = ({ pass, onDownload, downloading }) => {
  const isConfirmed = pass.status === 'CONFIRMED';
  const isPendingVerification = pass.status === 'PENDING_VERIFICATION' || 
    (pass.status === 'ASSIGNED' && pass.attendee?.photo && pass.event?.requirePhotoVerification);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative bg-white border border-slate-200 rounded-[32px] shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col overflow-hidden">
      {/* Top Content (Event Header Info) */}
      <div className="p-6 flex flex-col justify-between flex-1 space-y-4">
        {/* Tags */}
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">
            {pass.categoryName || 'Standard'}
          </span>

          {isConfirmed ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">
              <CheckCircleSolid className="h-3.5 w-3.5" /> Active Pass
            </span>
          ) : isPendingVerification ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full animate-pulse">
              Awaiting Verification
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              Pending Action
            </span>
          )}
        </div>

        {/* Event Details */}
        <div className="space-y-2">
          <h4 className="font-extrabold text-slate-900 text-base leading-tight truncate">{pass.event?.name}</h4>

          <div className="space-y-1 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-brand-main flex-shrink-0" />
              <span>{formatDate(pass.event?.startDate)} at {formatTime(pass.event?.startDate)}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 text-brand-main flex-shrink-0" />
              <span className="truncate">{pass.event?.venue?.name || 'Venue TBD'}</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="font-medium text-slate-500">ATTENDEE: {pass.attendee?.fullName || 'Not assigned'}</span>
          <span className="font-semibold text-slate-600">#{pass.ticketNumber}</span>
        </div>
      </div>

      {/* Dashed Divider with circle ticket punches */}
      <div className="relative flex items-center justify-between px-5 w-full bg-white">
        <div className="absolute left-0 -translate-x-1/2 w-5 h-5 bg-slate-50 rounded-full border border-slate-200 z-10" />
        <div className="w-full border-t border-dashed border-slate-200" />
        <div className="absolute right-0 translate-x-1/2 w-5 h-5 bg-slate-50 rounded-full border border-slate-200 z-10" />
      </div>

      {/* Bottom Content (QR Code stub) */}
      <div className="p-6 flex flex-col items-center justify-center bg-slate-50/50 rounded-b-[32px] text-center border-t border-slate-100">
        {isConfirmed ? (
          <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="bg-white p-2 rounded-2xl shadow-inner border border-slate-100 inline-block">
              <QRCodeDisplay
                value={pass.attendee?.qrCode || pass.attendee?.qrToken || pass.qrToken}
                size={100}
              />
            </div>

            <div className="text-center sm:text-left space-y-3">
              <p className="text-xs text-slate-500 font-medium">Scan QR code at entry gate</p>
              <button
                onClick={onDownload}
                disabled={downloading}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-main hover:bg-blue-700 disabled:scale-100 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : isPendingVerification ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full py-2">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center">
              <ClockIcon className="h-6 w-6 text-amber-500" />
            </div>

            <div className="text-center sm:text-left space-y-1">
              <p className="text-xs font-bold text-amber-800">Awaiting Photo Verification</p>
              <p className="text-[11px] text-slate-500 font-medium">Organizer is reviewing your photo. QR will unlock upon approval.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full py-2">
            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center">
              <QrCodeIcon className="h-6 w-6 text-slate-400" />
            </div>

            <div className="text-center sm:text-left space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                {pass.attendee?.isConfirmed || pass.attendee?.confirmationStatus === 'confirmed' 
                  ? 'Pass confirmed. QR code will appear after photo approval.' 
                  : 'Complete confirmation to view QR & PDF'}
              </p>
              {!(pass.attendee?.isConfirmed || pass.attendee?.confirmationStatus === 'confirmed') && (
                <Link
                  to={`/confirm/${pass.attendee?.confirmationToken || pass.inviteToken}`}
                  className="inline-flex items-center space-x-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  <span>Confirm Pass</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketCard;
