import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { getAttendees, inviteAttendee, verifyPhoto } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const confirmColors = { confirmed: 'green', invited: 'blue', pending: 'yellow', rejected: 'red' };
const photoColors = { verified: 'green', pending: 'yellow', rejected: 'red' };

const OrganiserAttendees = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length > 0) setSelectedEvent(evs[0]._id); }); }, []);

  const loadAttendees = () => {
    if (!selectedEvent) return;
    setLoading(true);
    getAttendees({ eventId: selectedEvent, search, limit: 50 })
      .then(r => { setAttendees(r.data.data.attendees); setTotal(r.data.data.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAttendees(); }, [selectedEvent, search]);

  const handleInvite = async (id) => {
    try {
      await inviteAttendee(id);
      toast.success('Invite sent');
      loadAttendees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    }
  };

  const handleVerify = async (id, status) => {
    const reason = status === 'rejected' ? prompt('Rejection reason:') : undefined;
    await verifyPhoto(id, { status, rejectionReason: reason });
    toast.success(`Photo ${status}`);
    loadAttendees();
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Attendees</h1><p className="text-gray-500 text-sm">{total} total</p></div>
        <div className="flex gap-3">
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-48"/>
        </div>
      </div>

      <Table>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Category</Th><Th>Status</Th><Th>Photo</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {attendees.map(a => (
            <Tr key={a._id}>
              <Td><p className="font-medium">{a.fullName || '—'}</p></Td>
              <Td>{a.email || '—'}</Td>
              <Td>{a.categoryName}</Td>
              <Td><Badge color={confirmColors[a.confirmationStatus]}>{a.confirmationStatus}</Badge></Td>
              <Td><Badge color={photoColors[a.photoVerificationStatus]}>{a.photoVerificationStatus}</Badge></Td>
              <Td>
                <div className="flex gap-2">
                  {a.confirmationStatus === 'pending' && <button onClick={() => handleInvite(a._id)} className="text-xs text-blue-600 hover:underline">Invite</button>}
                  {a.photo && a.photoVerificationStatus === 'pending' && (
                    <>
                      <button onClick={() => handleVerify(a._id, 'verified')} className="text-xs text-green-600 hover:underline">Verify</button>
                      <button onClick={() => handleVerify(a._id, 'rejected')} className="text-xs text-red-600 hover:underline">Reject</button>
                    </>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </DashboardLayout>
  );
};

export default OrganiserAttendees;
