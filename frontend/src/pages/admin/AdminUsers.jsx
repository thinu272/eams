import React, { useState, useEffect } from 'react';
import { getUsers, createUser, toggleUserActive } from '../../api/users';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const roleColors = { main_admin: 'purple', main_organiser: 'blue', sub_organiser: 'green', staff: 'orange', volunteer: 'yellow', auditor: 'gray' };
const roleLabels = { main_admin: 'Main Admin', main_organiser: 'Main Organiser', sub_organiser: 'Sub Organiser', staff: 'Staff', volunteer: 'Volunteer', auditor: 'Auditor' };

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'main_organiser', phone: '' });

  const load = () => getUsers({ limit: 100 }).then(r => setUsers(r.data.data.users));
  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser(form);
      toast.success('User created');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'main_organiser', phone: '' });
      load();
    } catch (err) { 
      console.log('USER_CREATE_UI_ERROR:', err);
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to create user';
      toast.error(msg); 
    }
    finally { setCreating(false); }
  };

  const handleToggle = async (id) => {
    await toggleUserActive(id);
    toast.success('User status updated');
    load();
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">System Users</h1><p className="text-gray-500 text-sm">Create and manage admins, organisers, and staff</p></div>
        <Button onClick={() => setShowCreate(true)}>+ Create New User</Button>
      </div>

      <Table>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Assignments</Th><Th>Actions</Th></tr></thead>
        <tbody>
          {users.map(user => (
            <Tr key={user._id}>
              <Td><p className="font-medium text-gray-900">{user.name}</p></Td>
              <Td>{user.email}</Td>
              <Td><Badge color={roleColors[user.role]}>{roleLabels[user.role]}</Badge></Td>
              <Td><Badge color={user.isActive ? 'green' : 'red'}>{user.isActive ? 'Active' : 'Inactive'}</Badge></Td>
              <Td>
                {user.role === 'main_organiser' || user.role === 'sub_organiser' ? (
                  <span className="text-xs text-gray-500">{(user.assignedEvents || []).length} events</span>
                ) : '—'}
              </Td>
              <Td>
                <button onClick={() => handleToggle(user._id)} className={`text-xs ${user.isActive ? 'text-red-600' : 'text-green-600'} hover:underline`}>
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create User">
        <form onSubmit={handleCreate} className="space-y-4">
          {[['name','Full Name','text',true],['email','Email','email',true],['password','Password','password',true],['phone','Phone','text',false]].map(([k,l,t,r]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{l}{r && ' *'}</label>
              <input type={t} required={r} value={form[k]} onChange={e => setForm(f => ({...f, [k]: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Object.entries(roleLabels).filter(([k]) => k !== 'main_admin').map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={creating}>Create</Button>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminUsers;
