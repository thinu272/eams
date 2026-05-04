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
  responsibilities: {
    zoneIds: [],
    verificationAccess: false,
    entryAccess: true
  }
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
      assignedZones: ['Staff', 'Volunteer'].includes(member.role) ? (member.assignedZones || member.responsibilities?.zoneIds || []) : [],
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
          responsibilities: {
            ...current.responsibilities,
            zoneIds: [],
            entryAccess: false,
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
      responsibilities: {
        ...current.responsibilities,
        zoneIds: scope === 'entry' ? [] : current.responsibilities?.zoneIds || [],
        entryAccess: scope === 'entry' || scope === 'both',
      },
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
          responsibilities: {
            ...form.responsibilities,
            zoneIds: assignedZones,
            entryAccess: ['Staff', 'Volunteer'].includes(form.role) && (form.operationScope === 'entry' || form.operationScope === 'both'),
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
          responsibilities: {
            ...form.responsibilities,
            zoneIds: assignedZones,
            entryAccess: ['Staff', 'Volunteer'].includes(form.role) && (form.operationScope === 'entry' || form.operationScope === 'both'),
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
              {team.map((user) => (
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
                      {(user.assignedZones || user.responsibilities?.zoneIds || []).map(zid => (
                        <span key={zid} className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700 font-medium">{zid}</span>
                      ))}
                      {(!(user.assignedZones || user.responsibilities?.zoneIds)?.length) && <span className="text-xs text-slate-400 italic">No specific zone</span>}
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
        </Card>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form._id ? 'Edit Team Member' : 'Add New Team Member'}>
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Basic Details</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Name</span>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Full name" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Role</span>
                <select value={form.role} onChange={e => updateRole(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <option value="Staff">Staff</option>
                  <option value="Volunteer">Volunteer</option>
                  <option value="Auditor">Auditor</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Email</span>
                <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Email address" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-500">Phone</span>
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Phone number" />
              </label>
              {!form._id && (
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Temporary Password</span>
                  <input value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Initial password" />
                </label>
              )}
            </div>
          </div>

          {isCheckpointRole && (
            <>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">Checkpoint Assignment</span>
                    <p className="mt-1 text-sm text-slate-500">Choose whether this team member works at gates, zones, or both.</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-700">
                    {form.role}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ['entry', 'Entry Point Staff'],
                    ['zone', 'Zone Checkpoint'],
                    ['both', 'Both'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(value)}
                      className={`rounded-xl border px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] transition ${
                        form.operationScope === value
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-500">{scopeDescriptions[form.operationScope]}</p>

                {(form.operationScope === 'entry' || form.operationScope === 'both') && (
                  <div className="mt-4 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Entry Point / Gate</span>
                    {(form.assignedGates || []).map((gate, index) => (
                      <div key={`${index}-${gate}`} className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={gate}
                          onChange={(e) => updateGateAt(index, e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                          placeholder="e.g. Main Gate"
                        />
                        {(form.assignedGates || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm((curr) => ({ ...curr, assignedGates: curr.assignedGates.filter((_, idx) => idx !== index) }))}
                            className="rounded-xl border border-rose-200 px-4 py-3 text-xs font-bold text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm((curr) => ({ ...curr, assignedGates: [...(curr.assignedGates || []), ''] }))}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600"
                    >
                      Add Entry Point
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {form.operationScope === 'zone' || form.operationScope === 'both' ? 'Zone Access To Allow' : 'Zone Assignment (My Scope)'}
                  </span>
                  <p className="mt-1 text-sm text-slate-500">
                    {form.operationScope === 'entry'
                      ? 'Zone selection is disabled because this member is assigned only to entry points.'
                      : 'Select the zones this member is allowed to check or control.'}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {myZones.map((zone) => (
                    <label key={zone.id} className={`flex items-center gap-3 rounded-xl border p-3 text-sm transition ${
                      form.operationScope === 'entry'
                        ? 'border-slate-100 bg-slate-50 text-slate-400'
                        : 'border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40'
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
                            responsibilities: { ...curr.responsibilities, zoneIds: next },
                          }));
                        }}
                      />
                      <span className="font-medium">{zone.name}</span>
                    </label>
                  ))}
                  {myZones.length === 0 && <p className="text-[10px] text-slate-400 italic">No zones assigned to you yet.</p>}
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-[10px] font-bold uppercase text-slate-500">Capabilities</span>
            <p className="mt-1 text-sm text-slate-500">Choose the actions this team member can perform inside your event scope.</p>
            <div className="mt-3 grid gap-2">
              {[
                ['canVerifyPhotos', 'Verify Attendee Photos'],
                ['canEntryAccess', 'Process Gate Entry'],
                ['canInviteAttendees', 'Send Invites'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3 text-sm text-slate-700">
                  <input 
                    type="checkbox" 
                    disabled={key === 'canEntryAccess' && isCheckpointRole && form.operationScope === 'zone'}
                    checked={!!form.permissions[key]} 
                    onChange={(e) => setForm((curr) => ({ ...curr, permissions: { ...curr.permissions, [key]: e.target.checked } }))} 
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button className="sm:min-w-[220px]" onClick={saveMember}>
              {form._id ? 'Update Team Member' : 'Create Team Member'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgTeam;
