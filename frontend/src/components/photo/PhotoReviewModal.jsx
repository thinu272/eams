import React from 'react';
import Button from '../ui/Button';

const PhotoReviewModal = ({ open, onClose, attendee, onVerify, onReject }) => {
  if (!open || !attendee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Photo Review</h2>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">Close</button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Uploaded Photo</p>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {attendee.photo ? (
                <img src={attendee.photo} alt="Attendee" className="w-full rounded-xl object-contain max-h-[420px]" />
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">No photo</div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Tip: check face clarity and lighting.</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Attendee Details</p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold">Full Name:</span> {attendee.fullName || '-'}</p>
              <p><span className="font-semibold">National ID:</span> {attendee.nationalId || '-'}</p>
              <p><span className="font-semibold">DOB:</span> {attendee.dateOfBirth ? new Date(attendee.dateOfBirth).toLocaleDateString() : '-'}</p>
              <p><span className="font-semibold">Category:</span> {attendee.categoryName || '-'}</p>
              <p><span className="font-semibold">Event:</span> {attendee.event?.name || '-'}</p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button onClick={onVerify} className="bg-green-600 hover:bg-green-500">Verify</Button>
              <Button variant="danger" onClick={onReject}>Reject</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoReviewModal;
