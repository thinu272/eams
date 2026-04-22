import React, { useEffect, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import { listSubOrganisers, createSubOrganiser, updateSubOrganiserStatus } from '../../api/organiser';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

const OrganiserTeam = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  const load = () => {
    listSubOrganisers().then((res) => setUsers(res.data?.data?.users || []));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createSubOrganiser(form);
      toast.success('Sub organiser invited');
      setOpen(false);
      setForm({ name: '', email: '', phone: '', password: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    }
  };

  const toggleStatus = async (id, status) => {
    try {
      await updateSubOrganiserStatus(id, status === 'Active' ? 'inactive' : 'active');
      toast.success('Status updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sub Organisers</h1>
            <p className="text-sm text-slate-500">Manage your sub organisers and permissions.</p>
          </div>
          <Button onClick={() => setOpen(true)}>Add Sub Organiser</Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{u.phone}</td>
                  <td className="px-4 py-3">{u.status}</td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(u._id, u.status)}>
                      {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-400">No sub organisers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Sub Organiser">
        <form onSubmit={handleCreate} className="space-y-4">
          <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
          <input className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Temporary Password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
          <div className="flex gap-3">
            <Button type="submit">Invite</Button>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </OrganiserLayout>
  );
};

export default OrganiserTeam;
