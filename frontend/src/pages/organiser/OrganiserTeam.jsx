import React, { useEffect, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import { listSubOrganisers, createSubOrganiser, updateSubOrganiserStatus } from '../../api/organiser';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { TrashIcon, PencilIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

const OrganiserTeam = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    listSubOrganisers()
      .then((res) => setUsers(res.data?.data?.users || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      return toast.error('Please fill in all required fields');
    }
    setSubmitting(true);
    try {
      await createSubOrganiser(form);
      toast.success('Sub organiser invited successfully');
      setOpen(false);
      setForm({ name: '', email: '', phone: '', password: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await updateSubOrganiserStatus(id, currentStatus === 'Active' ? 'inactive' : 'active');
      toast.success('Status updated successfully');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-500 mt-1">Manage your sub-organisers and team members</p>
          </div>
          <Button 
            onClick={() => setOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
          >
            + Add Team Member
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Total Members</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{users.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{users.filter(u => u.status === 'Active').length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-slate-600 text-sm font-medium">Inactive</p>
            <p className="text-2xl font-bold text-slate-500 mt-1">{users.filter(u => u.status !== 'Active').length}</p>
          </div>
        </div>

        {/* Team Members Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Name</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Email</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Phone</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-slate-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">ID: {u._id?.slice(-6)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{u.email}</td>
                      <td className="px-6 py-4 text-slate-700">{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.status === 'Active' ? (
                            <>
                              <CheckCircleIcon className="w-4 h-4 text-green-600" />
                              <span className="inline-flex px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                Active
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="w-4 h-4 text-slate-400" />
                              <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                Inactive
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => toggleStatus(u._id, u.status)}
                            className="text-xs"
                          >
                            {u.status === 'Active' ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-400 text-4xl mb-3">👥</div>
              <p className="text-slate-500 font-medium">No team members yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first team member to get started</p>
              <Button 
                size="sm"
                onClick={() => setOpen(true)}
                className="mt-4"
              >
                Add First Member
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add Team Member Modal */}
      <Modal 
        open={open} 
        onClose={() => {
          setOpen(false);
          setForm({ name: '', email: '', phone: '', password: '' });
        }} 
        title="Add New Team Member"
        size="lg"
      >
        <div className="mb-6">
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Add Team Member</h3>
              <p className="text-sm text-blue-700">Create a new sub-organiser account with access to your event</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="Enter full name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="john@example.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Invitation will be sent to this email</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="+1 234 567 8900"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">International format required</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Temporary Password <span className="text-red-500">*</span>
              </label>
              <input 
                className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                placeholder="Create a secure temporary password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
              <p className="text-xs text-slate-500 mt-1">Member will be asked to change this on first login</p>
            </div>
          </div>

          <div className="border-t pt-6 flex gap-3">
            <Button 
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3"
              loading={submitting}
            >
              Send Invitation
            </Button>
            <Button 
              type="button"
              variant="outline" 
              className="flex-1 py-3"
              onClick={() => {
                setOpen(false);
                setForm({ name: '', email: '', phone: '', password: '' });
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </OrganiserLayout>
  );
};

export default OrganiserTeam;
