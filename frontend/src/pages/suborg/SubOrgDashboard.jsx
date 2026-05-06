import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubDashboard, createSubTicket, updateSubTicket, deleteSubTicket, regenerateTicketCode } from '../../api/sub';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import { v4 as uuidv4 } from 'uuid';
import { listSubOrganisers } from '../../api/organiser';

const metricCards = [
  { key: 'totalAttendees', label: 'Attendees in scope', accent: 'text-slate-900' },
  { key: 'checkedInCount', label: 'Checked in', accent: 'text-emerald-600' },
  { key: 'pendingVerifications', label: 'Pending verification', accent: 'text-amber-600' },
  { key: 'zoneCount', label: 'Assigned zones', accent: 'text-sky-600' },
];

const formatTime = (value) => new Date(value).toLocaleString();

const emptyCategory = { 
  name: '', 
  description: '', 
  price: 0, 
  capacity: 0, 
  allowedZones: [], 
  isPrivate: true,
  maxUsage: null 
};

const SubOrgDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [categoryModal, setCategoryModal] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const load = (eventId) => {
    setLoading(true);
    Promise.all([
      getSubDashboard({ eventId }),
      listSubOrganisers({ eventId }).catch(() => ({ data: { data: { users: [] } } }))
    ])
      .then(([subRes, teamRes]) => {
        const dashboardData = subRes.data?.data || null;
        setData(dashboardData);
        setTeamMembers(teamRes.data?.data?.users || []);
        setLoadError('');
        
        // Sync currentEventId if backend fell back to a different one
        if (dashboardData?.event?._id && String(dashboardData.event._id) !== String(eventId)) {
          console.log(`[Dashboard] Syncing event ID to ${dashboardData.event._id}`);
          setCurrentEventId(String(dashboardData.event._id));
          localStorage.setItem('lastSelectedEventId', String(dashboardData.event._id));
        }
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 404 || status === 403) {
          localStorage.removeItem('lastSelectedEventId');
          setCurrentEventId('');
        }
        const message = error.response?.data?.message || 'Unable to load sub-organiser workspace.';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load(currentEventId);

    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => {
      window.removeEventListener('entrynex:event-select', handleEventSelect);
    };
  }, []);

  const saveCategory = async () => {
    if (!categoryModal.name.trim()) return toast.error('Category name is required');
    setIsSaving(true);
    try {
      const payload = { ...categoryModal, eventId: currentEventId };
      if (categoryModal.id) {
        await updateSubTicket(categoryModal.id, payload);
        toast.success('Ticket category updated');
      } else {
        await createSubTicket(payload);
        toast.success('Ticket category created');
      }
      setCategoryModal(null);
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const removeCategory = async (catId) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await deleteSubTicket(catId, { eventId: currentEventId });
      toast.success('Category deleted');
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    }
  };

  const handleRegenerateCode = async (catId) => {
    try {
      await regenerateTicketCode(catId, { eventId: currentEventId });
      toast.success('Access code regenerated');
      load(currentEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to regenerate code');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-6 text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Sub Organiser workspace</p>
          <div className="mt-3">
            <div>
              <h1 className="text-3xl font-bold">{data?.event?.name || 'Assigned event'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                Keep your zone operations fast and clear. This workspace only shows the zones and attendees assigned to you.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <div key={card.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className={`mt-3 text-3xl font-bold ${card.accent}`}>
                {loading ? '-' : data?.metrics?.[card.key] || 0}
              </p>
            </div>
          ))}
        </div>

        {loadError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Assigned zones</h2>
                <p className="mt-1 text-sm text-slate-500">Capacity and operational visibility for your current scope.</p>
              </div>
              <Link to="/suborg/zones" className="text-sm font-semibold text-sky-700">Open zone workspace</Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(data?.zones || []).map((zone) => (
                <div key={zone.id || zone.name} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{zone.name}</h3>
                    <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">cap {zone.capacity || 0}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Use entry and zone scans here only. Other event areas stay hidden.</p>
                </div>
              ))}
              {!loading && (data?.zones || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500 md:col-span-2">
                  No zones assigned yet. Ask the main organiser to assign at least one zone.
                </div>
              )}
            </div>
          </div>

          {/* Managed Categories Section */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 font-bold">Ticket Management</h2>
                <p className="mt-1 text-[10px] text-slate-400">Manage categories delegated to you or created by you.</p>
              </div>
              <Button size="sm" onClick={() => setCategoryModal({ ...emptyCategory, id: '', allowedZones: (data?.zones || []).map(z => z.id || z.name) })}>Add Ticket</Button>
            </div>
            
            <div className="mt-6 space-y-4 flex-1">
              {data?.categories?.map((cat) => (
                <div key={cat.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{cat.name}</h3>
                        {cat.isPrivate && <Badge color="indigo" size="xs">Private</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{cat.description || 'No description provided.'}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-medium text-slate-400">
                        <span>Price: {data?.event?.settings?.currency || 'LKR'} {Number(cat.price).toLocaleString()}</span>
                        <span>Sold: {cat.sold || 0} / {cat.capacity || 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => setCategoryModal(cat)} className="text-[10px] font-bold text-blue-600 uppercase hover:underline">Edit</button>
                      <button onClick={() => removeCategory(cat.id)} className="text-[10px] font-bold text-rose-600 uppercase hover:underline">Delete</button>
                    </div>
                  </div>
                  
                  {cat.isPrivate && cat.accessCode && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-400">Access Code</span>
                        <span className="text-xs font-mono font-bold text-indigo-600 tracking-wider">{cat.accessCode}</span>
                      </div>
                      <button 
                        onClick={() => handleRegenerateCode(cat.id)}
                        className="rounded-lg bg-slate-50 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Regenerate Code"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {(!data?.categories || data.categories.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" /></svg>
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-400 italic">No managed categories yet.</p>
                </div>
              )}
            </div>
            
            <p className="mt-4 text-[10px] italic text-slate-400">
              You can only create and manage tickets for the zones assigned to your workspace.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Last 5 actions</h2>
                <p className="mt-1 text-sm text-slate-500">Recent entry and zone activity inside your assignment.</p>
              </div>
              <Link to="/suborg/logs" className="text-sm font-semibold text-sky-700">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {(data?.activity || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{item.action}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.attendeeName} - {item.zoneName}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.actorName} - {formatTime(item.timestamp)}</p>
                </div>
              ))}
              {!loading && (data?.activity || []).length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                  No actions recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CategoryModal 
        open={!!categoryModal}
        onClose={() => setCategoryModal(null)}
        category={categoryModal}
        setCategory={setCategoryModal}
        zones={data?.zones || []}
        teamMembers={teamMembers}
        currency={data?.event?.settings?.currency || 'LKR'}
        onSave={saveCategory}
        loading={isSaving}
      />
    </DashboardLayout>
  );
};

const CategoryModal = ({ open, onClose, category, setCategory, zones, teamMembers, currency, onSave, loading }) => (
  <Modal open={open} onClose={onClose} title={category?.id ? 'Edit Ticket Category' : 'Create New Ticket'}>
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Category Name</span>
          <input 
            value={category?.name || ''} 
            onChange={(e) => setCategory(curr => ({ ...curr, name: e.target.value }))} 
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20" 
            placeholder="e.g. VIP Seating" 
          />
        </label>
        
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase text-slate-500">Description</span>
          <textarea 
            value={category?.description || ''} 
            onChange={(e) => setCategory(curr => ({ ...curr, description: e.target.value }))} 
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20" 
            placeholder="What's included in this ticket?"
            rows={2}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Price ({currency})</span>
            <input 
              type="number"
              value={category?.price || 0} 
              onChange={(e) => setCategory(curr => ({ ...curr, price: Number(e.target.value) }))} 
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20" 
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase text-slate-500">Total Capacity</span>
            <input 
              type="number"
              value={category?.capacity || 0} 
              onChange={(e) => setCategory(curr => ({ ...curr, capacity: Number(e.target.value) }))} 
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20" 
            />
          </label>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!category?.isPrivate}
              onChange={(e) => setCategory(curr => ({ ...curr, isPrivate: e.target.checked }))}
              className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-indigo-900">Private Ticket</span>
              <span className="text-[10px] text-indigo-600/70 leading-tight">Requires a special access code to view and purchase.</span>
            </div>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <span className="text-xs font-bold uppercase text-slate-500">Authorized Zones</span>
          <p className="mt-1 text-[10px] text-slate-400">Choose which zones this ticket gives access to.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {zones.map(zone => (
              <label key={zone.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={(category?.allowedZones || []).includes(zone.id || zone.name)}
                  onChange={(e) => {
                    const zid = zone.id || zone.name;
                    const next = e.target.checked
                      ? [...new Set([...(category?.allowedZones || []), zid])]
                      : (category?.allowedZones || []).filter(id => id !== zid);
                    setCategory(curr => ({ ...curr, allowedZones: next }));
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                />
                <span className="truncate">{zone.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <span className="text-xs font-bold uppercase text-slate-500">Management Delegation</span>
          <p className="mt-1 text-[10px] text-slate-400">Assign other sub-organisers to help manage this category.</p>
          <div className="mt-3 space-y-2">
            {teamMembers.filter(m => m.role === 'SubOrganiser' || m.role === 'sub_organiser').map((member) => (
              <label key={member._id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2 text-sm hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={(category?.assignedSubOrganisers || []).includes(member._id)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...new Set([...(category?.assignedSubOrganisers || []), member._id])]
                      : (category?.assignedSubOrganisers || []).filter(id => id !== member._id);
                    setCategory(curr => ({ ...curr, assignedSubOrganisers: next }));
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-700">{member.name}</span>
                  <span className="text-[10px] text-slate-500">{member.email}</span>
                </div>
              </label>
            ))}
            {teamMembers.filter(m => m.role === 'SubOrganiser' || m.role === 'sub_organiser').length === 0 && (
              <p className="text-xs italic text-slate-400 py-2">No other sub-organisers found.</p>
            )}
          </div>
        </div>
      </div>

      <Button className="w-full" onClick={onSave} loading={loading}>
        {category?.id ? 'Update Category' : 'Create Category'}
      </Button>
    </div>
  </Modal>
);

export default SubOrgDashboard;
