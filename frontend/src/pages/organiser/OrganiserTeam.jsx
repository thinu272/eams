import React, { useEffect, useState } from 'react';
import { getMyEvents } from '../../api/events';
import { assignUserToEvent, createUser, getUsers, toggleUserActive, updateUserPermissions } from '../../api/users';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const roleColors = { sub_organiser: 'blue', staff: 'orange', volunteer: 'green', auditor: 'gray' };
const roleLabels = { sub_organiser: 'Sub Organiser', staff: 'Staff', volunteer: 'Volunteer', auditor: 'Auditor' };
const defaultPermissions = {
  canAddAttendees: true,
  canBulkUpload: true,
  canVerifyPhotos: true,
  canInviteAttendees: true,
  canViewReports: false,
  canManageStaff: false,
};

const OrganiserTeam = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'sub_organiser',
    phone: '',
    permissions: { ...defaultPermissions },
    assignedZones: [],
  });

  useEffect(() => {
    getMyEvents().then((r) => {
      const evs = r.data?.data?.events || [];
      setEvents(evs);
      if (evs.length) setSelectedEvent(evs[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    getUsers({ eventId: selectedEvent, limit: 8, page })
      .then((r) => {
        setUsers(r.data?.data?.users || []);
        setPages(r.data?.data?.pages || 1);
        setTotal(r.data?.data?.total || 0);
      });
  }, [selectedEvent, page]);

  useEffect(() => {
    setPage(1);
  }, [selectedEvent]);

  const selectedEventData = events.find((event) => event._id === selectedEvent);
  const teamUsers = users.filter((member) => member.role !== 'main_organiser' && member.role !== 'main_admin');

  const openCreateModal = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'sub_organiser',
      phone: '',
      permissions: { ...defaultPermissions },
      assignedZones: [],
    });
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        phone: form.phone,
        permissions: form.permissions,
        assignedZones: form.assignedZones,
        createdBy: user._id,
      });

      const createdUser = response.data?.data?.user;
      await assignUserToEvent(createdUser._id, selectedEvent);
      if (form.role === 'sub_organiser') {
        await updateUserPermissions(createdUser._id, {
          eventId: selectedEvent,
          permissions: form.permissions,
          assignedZones: form.assignedZones,
        });
      }
      toast.success('Team member added');
      setShowCreate(false);
      setPage(1);
      const refreshed = await getUsers({ eventId: selectedEvent, limit: 8, page: 1 });
      setUsers(refreshed.data?.data?.users || []);
      setPages(refreshed.data?.data?.pages || 1);
      setTotal(refreshed.data?.data?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add team member');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePermission = (key) => {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }));
  };

  const handleZoneToggle = (zoneName) => {
    setForm((current) => ({
      ...current,
      assignedZones: current.assignedZones.includes(zoneName)
        ? current.assignedZones.filter((zone) => zone !== zoneName)
        : [...current.assignedZones, zoneName],
    }));
  };

  const openPermissionsModal = (member) => {
    setEditingUser(member);
    setForm((current) => ({
      ...current,
      permissions: {
        ...defaultPermissions,
        ...(member.permissions || {}),
      },
      assignedZones: member.assignedZones || [],
    }));
  };

  const handleSavePermissions = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingPermissions(true);
    try {
      await updateUserPermissions(editingUser._id, {
        eventId: selectedEvent,
        permissions: form.permissions,
        assignedZones: form.assignedZones,
      });
      toast.success('Permissions updated');
      setEditingUser(null);
      const refreshed = await getUsers({ eventId: selectedEvent, limit: 8, page });
      setUsers(refreshed.data?.data?.users || []);
      setPages(refreshed.data?.data?.pages || 1);
      setTotal(refreshed.data?.data?.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sub-Organiser Management</h1>
            <p className="text-gray-500 text-sm">Create operational users, assign tasks, and control who can do what.</p>
          </div>
          <div className="flex gap-3">
            <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
            </select>
            <Button onClick={openCreateModal}>+ Create Member</Button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Team Members</h2>
              <p className="text-xs text-gray-500">{total} users assigned to this event</p>
            </div>
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Zones / Tasks</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {teamUsers.map((member) => (
                <Tr key={member._id}>
                  <Td><p className="font-medium text-gray-900">{member.name}</p></Td>
                  <Td>{member.email}</Td>
                  <Td><Badge color={roleColors[member.role] || 'gray'}>{roleLabels[member.role] || member.role}</Badge></Td>
                  <Td><Badge color={member.isActive ? 'green' : 'red'}>{member.isActive ? 'Active' : 'Inactive'}</Badge></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(member.assignedZones || []).slice(0, 3).map((zone) => (
                        <span key={zone} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{zone}</span>
                      ))}
                      {member.role === 'sub_organiser' && member.permissions?.canManageStaff && (
                        <span className="px-2 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">Manage Staff</span>
                      )}
                      {member.role === 'sub_organiser' && member.permissions?.canViewReports && (
                        <span className="px-2 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">Reports</span>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex gap-3 text-xs">
                      {member.role === 'sub_organiser' && (
                        <button onClick={() => openPermissionsModal(member)} className="text-blue-600 hover:underline">Permissions</button>
                      )}
                      <button
                        onClick={async () => {
                          await toggleUserActive(member._id);
                          const refreshed = await getUsers({ eventId: selectedEvent, limit: 8, page });
                          setUsers(refreshed.data?.data?.users || []);
                          setPages(refreshed.data?.data?.pages || 1);
                          setTotal(refreshed.data?.data?.total || 0);
                        }}
                        className="text-red-600 hover:underline"
                      >
                        {member.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
              {teamUsers.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-500">No team members assigned to this event yet.</td>
                </tr>
              )}
            </tbody>
          </Table>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((current) => Math.min(current + 1, pages))}>Next</Button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Team Member">
        <form onSubmit={handleCreate} className="space-y-4">
          {[['name', 'Full Name', 'text', true], ['email', 'Email', 'email', true], ['password', 'Password', 'password', true], ['phone', 'Phone', 'text', false]].map(([key, label, type, required]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} required={required} value={form[key]} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>

          {form.role === 'sub_organiser' && (
            <>
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Permissions</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(defaultPermissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={!!form.permissions[key]} onChange={() => handleTogglePermission(key)} />
                      <span>{key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim()}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-2">Assigned Zones</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedEventData?.zones || []).map((zone) => (
                    <label key={zone.id || zone.name} className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm">
                      <input type="checkbox" checked={form.assignedZones.includes(zone.name)} onChange={() => handleZoneToggle(zone.name)} />
                      <span>{zone.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={creating}>Create Member</Button>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title="Update Permissions">
        {editingUser && (
          <form onSubmit={handleSavePermissions} className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Team Member</p>
              <p className="font-medium text-gray-900">{editingUser.name}</p>
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">Permissions</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(defaultPermissions).map(([key]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={!!form.permissions[key]} onChange={() => handleTogglePermission(key)} />
                    <span>{key.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim()}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">Assigned Zones</p>
              <div className="flex flex-wrap gap-2">
                {(selectedEventData?.zones || []).map((zone) => (
                  <label key={zone.id || zone.name} className="flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm">
                    <input type="checkbox" checked={form.assignedZones.includes(zone.name)} onChange={() => handleZoneToggle(zone.name)} />
                    <span>{zone.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="submit" loading={savingPermissions}>Save</Button>
              <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default OrganiserTeam;
