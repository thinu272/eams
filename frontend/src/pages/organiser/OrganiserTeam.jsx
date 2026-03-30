import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { getUsers, createUser, toggleUserActive, assignUserToEvent } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const roleColors = { sub_organiser: 'blue', staff: 'orange', volunteer: 'green', auditor: 'gray' };
const roleLabels = { sub_organiser: 'Sub Organiser', staff: 'Staff', volunteer: 'Volunteer', auditor: 'Auditor' };

const OrganiserTeam = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sub_organiser', phone: '' });

  const loadUsers = () => getUsers({ eventId: selectedEvent, limit: 100 }).then(r => setUsers(r.data.data.users));
  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) setSelectedEvent(evs[0]._id); }); }, []);
  useEffect(() => { if (selectedEvent) loadUsers(); }, [selectedEvent]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await createUser({ ...form, createdBy: user._id });
      await assignUserToEvent(data.data.user._id, selectedEvent);
      toast.success('Team member added');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'sub_organiser', phone: '' });
      loadUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const teamUsers = users.filter(u => u.role !== 'main_organiser' && u.role !== 'main_admin');

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">My Team</h1><p className="text-gray-500 text-sm">{teamUsers.length} members</p></div>
        <div className="flex gap-3">
          <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <Button onClick={() => setShowCreate(true)}>+ Add Member</Button>
        </div>
      </div>

      <Table>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {teamUsers.map(u => (
            <Tr key={u._id}>
              <Td><p className="font-medium text-gray-900">{u.name}</p></Td>
              <Td>{u.email}</Td>
              <Td><Badge color={roleColors[u.role] || 'gray'}>{roleLabels[u.role] || u.role}</Badge></Td>
              <Td><Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></Td>
              <Td><button onClick={async () => { await toggleUserActive(u._id); loadUsers(); }} className="text-xs text-red-600 hover:underline">{u.isActive ? 'Deactivate' : 'Activate'}</button></Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Team Member">
        <form onSubmit={handleCreate} className="space-y-4">
          {[['name','Full Name','text',true],['email','Email','email',true],['password','Password','password',true],['phone','Phone','text',false]].map(([k,l,t,r]) => (
            <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label><input type={t} required={r} value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"/></div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Object.entries(roleLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-3"><Button type="submit" loading={creating}>Add</Button><Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button></div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default OrganiserTeam;
