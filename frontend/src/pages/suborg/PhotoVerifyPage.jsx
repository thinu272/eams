import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { getAttendees, verifyPhoto } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';

const PhotoVerifyPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) setSelectedEvent(evs[0]._id); }); }, []);

  const load = () => {
    if (!selectedEvent) return;
    getAttendees({ eventId: selectedEvent, status: 'confirmed', limit: 50 }).then(r => setAttendees(r.data.data.attendees.filter(a => a.photo)));
  };
  useEffect(() => { load(); }, [selectedEvent]);

  const handle = async (id, status) => {
    const reason = status === 'rejected' ? prompt('Rejection reason:') : undefined;
    await verifyPhoto(id, { status, rejectionReason: reason });
    toast.success(`Photo ${status}`);
    load();
  };

  const pending = attendees.filter(a => a.photoVerificationStatus === 'pending');
  const done = attendees.filter(a => a.photoVerificationStatus !== 'pending');

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Photo Verification</h1><p className="text-gray-500 text-sm">{pending.length} pending review</p></div>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pending.map(a => (
          <div key={a._id} className="bg-white rounded-xl border-2 border-yellow-300 p-4">
            <div className="flex items-center gap-3 mb-3">
              <img src={`/${a.photo}`} alt="" className="w-16 h-16 rounded-full object-cover border border-gray-200" onError={e => { e.target.style.display='none'; }}/>
              <div>
                <p className="font-semibold text-gray-900">{a.fullName}</p>
                <p className="text-xs text-gray-500">{a.categoryName}</p>
                {a.nationalId && <p className="text-xs text-gray-400">ID: {a.nationalId}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="success" onClick={() => handle(a._id, 'verified')} className="flex-1">✓ Verify</Button>
              <Button size="sm" variant="danger" onClick={() => handle(a._id, 'rejected')} className="flex-1">✗ Reject</Button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400">No photos pending verification</div>}
      </div>
    </DashboardLayout>
  );
};

export default PhotoVerifyPage;
