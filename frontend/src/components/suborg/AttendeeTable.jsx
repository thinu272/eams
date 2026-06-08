import React from 'react';
import Badge from '../ui/Badge';

const confirmationColors = {
  confirmed: 'green',
  invited: 'blue',
  pending: 'yellow',
  rejected: 'red',
};

const verificationColors = {
  verified: 'green',
  pending: 'yellow',
  rejected: 'red',
};

const sourceLabels = {
  self_purchase: 'Public',
  invite: 'Invite',
  manual: 'Manual',
  bulk_upload: 'Bulk',
  sponsor: 'Sponsor',
};

const AttendeeTable = ({ attendees, loading, onView, onMarkAttendance, onEdit, canEdit, onDisableToggle, onDelete }) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Attendee</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Source</th>
              <th className="px-5 py-4">Zones</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Verification</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((attendee) => (
              <tr key={attendee._id} className="border-t border-slate-100 align-top">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{attendee.fullName || '-'}</p>
                  <p className="mt-1 text-xs text-slate-500">{attendee.email || attendee.phone || 'No contact'}</p>
                </td>
                <td className="px-5 py-4 text-slate-700">{attendee.categoryName || '-'}</td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {sourceLabels[attendee.addedVia] || 'Unknown'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {(attendee.allowedZones || []).slice(0, 3).map((zone) => (
                      <span key={`${attendee._id}-${zone}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {zone}
                      </span>
                    ))}
                    {(attendee.allowedZones || []).length > 3 && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        +{(attendee.allowedZones || []).length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="space-y-2">
                    <Badge color={confirmationColors[attendee.confirmationStatus] || 'gray'}>{attendee.confirmationStatus || 'pending'}</Badge>
                    {attendee.checkedIn && <div><Badge color="sky">checked in</Badge></div>}
                    {attendee.isDisabled && <div><Badge color="red">disabled</Badge></div>}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Badge color={verificationColors[String(attendee.photoVerificationStatus || '').toLowerCase()] || 'gray'}>
                    {attendee.photoVerificationStatus || 'pending'}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onView?.(attendee)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      View
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => onEdit?.(attendee)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Edit
                      </button>
                    )}
                    {onDisableToggle && (
                      <button type="button" onClick={() => onDisableToggle(attendee)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        {attendee.isDisabled ? 'Enable' : 'Disable'}
                      </button>
                    )}
                    {onDelete && attendee.addedVia !== 'self_purchase' && attendee.addedVia !== 'invite' && (
                      <button type="button" onClick={() => onDelete(attendee._id)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                        Delete
                      </button>
                    )}
                    {!attendee.checkedIn && !attendee.isDisabled && (
                      <button type="button" onClick={() => onMarkAttendance?.(attendee)} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500">
                        Mark attendance
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && attendees.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                  No attendees in your assigned zones yet.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                  Loading attendees...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendeeTable;
