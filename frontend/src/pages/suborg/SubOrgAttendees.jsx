import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { getAttendees, createAttendee, inviteAttendee } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const confirmColors = { confirmed: 'green', invited: 'blue', pending: 'yellow', rejected: 'red' };

const SubOrgAttendees = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', nationalId: '', categoryId: '' });

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) setSelectedEvent(evs[0]._id); }); }, []);

  const load = () => {
    if (!selectedEvent) return;
    getAttendees({ eventId: selectedEvent, search, limit: 50 }).then(r => { setAttendees(r.data.data.attendees); setTotal(r.data.data.total); });
  };
  useEffect(() => { load(); }, [selectedEvent, search]);

  const selectedEventData = events.find(e => e._id === selectedEvent);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await createAttendee({ ...form, eventId: selectedEvent });
      toast.success('Attendee added');
      setShowAdd(false);
      setForm({ fullName: '', email: '', phone: '', nationalId: '', categoryId: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setAdding(false); }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Attendees</h1><p className="text-gray-500 text-sm">{total} total</p></div>
        <div className="flex gap-3">
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"/>
          <Button onClick={() => setShowAdd(true)}>+ Add Attendee</Button>
        </div>
      </div>

      <Table>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Category</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {attendees.map(a => (
            <Tr key={a._id}>
              <Td><p className="font-medium">{a.fullName || '—'}</p></Td>
              <Td>{a.email || '—'}</Td>
              <Td>{a.categoryName}</Td>
              <Td><Badge color={confirmColors[a.confirmationStatus]}>{a.confirmationStatus}</Badge></Td>
              <Td>
                {a.confirmationStatus === 'pending' && (
                  <button onClick={async () => { await inviteAttendee(a._id); toast.success('Invite sent'); load(); }} className="text-xs text-blue-600 hover:underline">Send Invite</button>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Attendee Manually">
        <form onSubmit={handleAdd} className="space-y-4">
          {[['fullName','Full Name',true],['email','Email',true],['phone','Phone',false],['nationalId','National ID',false]].map(([k,l,r]) => (
            <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}{r&&' *'}</label><input required={r} value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select required value={form.categoryId} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Select category</option>
              {(selectedEventData?.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3"><Button type="submit" loading={adding}>Add</Button><Button variant="outline" type="button" onClick={() => setShowAdd(false)}>Cancel</Button></div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgAttendees;
