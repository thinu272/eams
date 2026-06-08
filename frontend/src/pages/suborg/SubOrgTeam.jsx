import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { getSubOrgTeam, createSubOrgTeamMember, updateSubOrgTeamMember, getSubZones } from '../../api/sub';
import toast from 'react-hot-toast';

const emptyTeamMember = { 
  name: '', 
  email: '', 
  phone: '', 
  password: '', 
  role: 'Staff',
  operationScope: 'entry',
  assignedGates: ['Main Gate'],
  assignedZones: [],
  permissions: { 
    canAddAttendees: false, 
    canVerifyPhotos: false, 
    canInviteAttendees: false, 
    canBulkUpload: false, 
    canEntryAccess: true 
  },
  
};

const scopeDescriptions = {
  entry: 'Can validate tickets at assigned gates or entry points.',
  zone: 'Can check attendee access only for the selected zones.',
  both: 'Can work at entry points and inside allowed zones.',
};

const SubOrgTeam = () => {
  const [team, setTeam] = useState([]);
  const [myZones, setMyZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyTeamMember);
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(team.length / pageSize));
  const pagedTeam = team.slice((page - 1) * pageSize, page * pageSize);
  const isCheckpointRole = ['Staff', 'Volunteer'].includes(form.role);

  const loadData = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const [teamRes, zonesRes] = await Promise.all([
        getSubOrgTeam({ eventId }),
        getSubZones({ eventId })
      ]);
      setTeam(teamRes.data?.data?.users || []);
      setMyZones(zonesRes.data?.data?.zones || []);
      setPage(1);
    } catch (err) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail;
      setCurrentEventId(newId);
      loadData(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    loadData();
  }, [currentEventId]);

  const handleEdit = (member) => {
    setForm({
      ...emptyTeamMember,
      ...member,
      role: member.role || 'Staff',
      operationScope: ['Staff', 'Volunteer'].includes(member.role)
        ? (member.assignedGates?.length && member.assignedZones?.length
            ? 'both'
            : member.assignedZones?.length
              ? 'zone'
              : 'entry')
        : 'entry',
      assignedGates: ['Staff', 'Volunteer'].includes(member.role) && member.assignedGates?.length ? member.assignedGates : ['Main Gate'],
      assignedZones: ['Staff', 'Volunteer'].includes(member.role) ? (member.assignedZones || []) : [],
      _id: member._id
    });
    setModalOpen(true);
  };

  const handleCreate = () => {
    setForm(emptyTeamMember);
    setModalOpen(true);
  };

  const updateRole = (role) => {
    setForm((current) => {
      if (!['Staff', 'Volunteer'].includes(role)) {
        return {
          ...current,
          role,
          operationScope: 'entry',
          assignedGates: [],
          assignedZones: [],
          permissions: {
            ...current.permissions,
            canEntryAccess: false,
          },
        };
      }

      return {
        ...current,
        role,
        assignedGates: current.assignedGates?.length ? current.assignedGates : ['Main Gate'],
      };
    });
  };

  const setScope = (scope) => {
    setForm((current) => ({
      ...current,
      operationScope: scope,
      assignedGates: scope === 'zone' ? [] : (current.assignedGates?.length ? current.assignedGates : ['Main Gate']),
      assignedZones: scope === 'entry' ? [] : current.assignedZones,
      permissions: {
        ...current.permissions,
        canEntryAccess: scope === 'entry' || scope === 'both',
      },
      assignedZones: scope === 'entry' ? [] : current.assignedZones,
    }));
  };

  const updateGateAt = (index, value) => {
    setForm((current) => {
      const next = [...(current.assignedGates || [])];
      next[index] = value;
      return { ...current, assignedGates: next };
    });
  };

  const saveMember = async () => {
    try {
      const assignedGates = form.operationScope === 'zone'
        || !['Staff', 'Volunteer'].includes(form.role)
        ? []
        : (form.assignedGates || []).map((item) => item.trim()).filter(Boolean);
      const assignedZones = form.operationScope === 'entry'
        || !['Staff', 'Volunteer'].includes(form.role)
        ? []
        : (form.assignedZones || []).map(String).filter(Boolean);

      if (form._id) {
        await updateSubOrgTeamMember(form._id, {
          ...form,
          eventId: currentEventId,
          assignedGates,
          assignedZones,
          permissions: {
            ...form.permissions,
            canEntryAccess: ['Staff', 'Volunteer'].includes(form.role) && (form.operationScope === 'entry' || form.operationScope === 'both'),
          },
        });
        toast.success('Member updated');
      } else {
        await createSubOrgTeamMember({
          ...form,
          eventId: currentEventId,
          assignedGates,
          assignedZones,
          permissions: {
            ...form.permissions,
            canEntryAccess: ['Staff', 'Volunteer'].includes(form.role) && (form.operationScope === 'entry' || form.operationScope === 'both'),
          },
        });
        toast.success('Member created');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-slate-900 to-indigo-900 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-200">Team Management</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Event Team</h1>
              <p className="mt-2 text-sm text-slate-200">
                Manage Staff and Volunteers assigned to your zones.
              </p>
            </div>
            <Button onClick={handleCreate}>Add Team Member</Button>
          </div>
        </div>

        <Card>
          <CardHeader 
            title="Team Members" 
            subtitle="Personnel added by you for your assigned operations."
          />
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role & Contact</Th>
                <Th>Checkpoint Type</Th>
                <Th>Assigned Zones</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {pagedTeam.map((user) => (
                <Tr key={user._id}>
                  <Td><div className="font-semibold">{user.name}</div></Td>
                  <Td>
                    <div className="text-xs font-bold uppercase text-indigo-600">{user.role}</div>
                    <div className="text-sm text-slate-600">{user.email}</div>
                    <div className="text-xs text-slate-400">{user.phone}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {user.assignedGates?.length > 0 && (
                        <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700">Entry Point</span>
                      )}
                      {user.assignedZones?.length > 0 && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Zone Checkpoint</span>
                      )}
                      {!user.assignedGates?.length && !user.assignedZones?.length && (
                        <span className="text-xs text-slate-400 italic">No direct scope</span>
                      )}
                    </div>
                    {user.assignedGates?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.assignedGates.map((gate) => (
                          <span key={gate} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">{gate}</span>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(user.assignedZones || []).map(zid => (
                        <span key={zid} className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700 font-medium">{zid}</span>
                      ))}
                      {(!(user.assignedZones || []).length) && <span className="text-xs text-slate-400 italic">No specific zone</span>}
                    </div>
                  </Td>
                  <Td><Badge color={user.status === 'Active' ? 'green' : 'gray'}>{user.status}</Badge></Td>
                  <Td>
                    <button className="text-xs font-bold text-indigo-600 hover:underline" onClick={() => handleEdit(user)}>Edit Access</button>
                  </Td>
                </Tr>
              ))}
              {!loading && team.length === 0 && (
                <Tr>
                  <Td colSpan="6" className="py-12 text-center text-slate-400">
                    You haven't added any team members yet.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
          {pages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                Showing {pagedTeam.length} of {team.length} team members
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-500">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage((current) => Math.min(pages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form._id ? 'Edit Team Member Access' : 'Add New Team Member'} size="lg">
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
          {/* Header Info */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Team Member Setup</h3>
              <p className="text-sm text-blue-700">Configure access and permissions for event staff</p>
            </div>
          </div>

          {/* Basic Details */}
          <div className="rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-semibold text-slate-700">Basic Information</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input 
                  value={form.name} 
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select 
                  value={form.role} 
                  onChange={e => updateRole(e.target.value)} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  <option value="Staff">Staff</option>
                  <option value="Volunteer">Volunteer</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input 
                  value={form.email} 
                  onChange={e => setForm(f => ({...f, email: e.target.value}))} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="staff@example.com"
                  type="email"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input 
                  value={form.phone} 
                  onChange={e => setForm(f => ({...f, phone: e.target.value}))} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="+1 234 567 8900"
                />
              </div>

              {!form._id && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input 
                    value={form.password} 
                    onChange={e => setForm(f => ({...f, password: e.target.value}))} 
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                    placeholder="Create a secure temporary password"
                    type="password"
                  />
                  <p className="text-xs text-slate-500 mt-1">Member will be asked to change this on first login</p>
                </div>
              )}
            </div>
          </div>

          {isCheckpointRole && (
            <>
              {/* Checkpoint Assignment */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700">Checkpoint Assignment</span>
                </div>
                
                <p className="text-sm text-slate-600 mb-4">Choose whether this team member works at gates, zones, or both</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    ['entry', 'Entry Point Staff'],
                    ['zone', 'Zone Checkpoint'],
                    ['both', 'Both'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(value)}
                      className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                        form.operationScope === value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                
                <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                  <p className="text-sm text-blue-800">{scopeDescriptions[form.operationScope]}</p>
                </div>

                {(form.operationScope === 'entry' || form.operationScope === 'both') && (
                  <div className="mt-5">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Entry Points / Gates
                    </label>
                    <div className="space-y-3">
                      {(form.assignedGates || []).map((gate, index) => (
                        <div key={`${index}-${gate}`} className="flex gap-3">
                          <input
                            value={gate}
                            onChange={(e) => updateGateAt(index, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            placeholder="e.g. Main Gate"
                          />
                          {(form.assignedGates || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => setForm((curr) => ({ ...curr, assignedGates: curr.assignedGates.filter((_, idx) => idx !== index) }))}
                              className="rounded-lg border border-red-300 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setForm((curr) => ({ ...curr, assignedGates: [...(curr.assignedGates || []), ''] }))}
                        className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        + Add Entry Point
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Zone Access */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700">Zone Access</span>
                </div>
                
                <p className="text-sm text-slate-600 mb-4">
                  {form.operationScope === 'entry'
                    ? 'Zone selection is disabled because this member is assigned only to entry points.'
                    : 'Select the zones this member is allowed to check or control.'}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myZones.map((zone) => (
                    <label key={zone.id} className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
                      form.operationScope === 'entry'
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}>
                      <input
                        type="checkbox"
                        disabled={form.operationScope === 'entry'}
                        checked={(form.assignedZones || []).includes(zone.id || zone.name)}
                        onChange={(e) => {
                          const zid = zone.id || zone.name;
                          const next = e.target.checked 
                            ? [...new Set([...(form.assignedZones || []), zid])]
                            : (form.assignedZones || []).filter(item => item !== zid);
                          setForm(curr => ({ 
                            ...curr,
                            assignedZones: next,
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium">{zone.name}</span>
                    </label>
                  ))}
                  {myZones.length === 0 && (
                    <p className="text-xs italic text-slate-400 py-3 col-span-2 text-center">No zones assigned to you yet.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Capabilities */}
          <div className="rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-semibold text-slate-700">Capabilities</span>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">Choose the actions this team member can perform</p>
            
            <div className="space-y-3">
              {[
                ['canVerifyPhotos', 'Verify Attendee Photos'],
                ['canEntryAccess', 'Process Gate Entry'],
                ['canInviteAttendees', 'Send Invites'],
              ].map(([key, label]) => (
                <label key={key} className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
                  key === 'canEntryAccess' && isCheckpointRole && form.operationScope === 'zone'
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                }`}>
                  <input 
                    type="checkbox" 
                    disabled={key === 'canEntryAccess' && isCheckpointRole && form.operationScope === 'zone'}
                    checked={!!form.permissions[key]} 
                    onChange={(e) => setForm((curr) => ({ ...curr, permissions: { ...curr.permissions, [key]: e.target.checked } }))} 
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-6 flex gap-3">
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3"
              onClick={saveMember}
            >
              {form._id ? 'Update Team Member' : 'Create Team Member'}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 py-3"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgTeam;
