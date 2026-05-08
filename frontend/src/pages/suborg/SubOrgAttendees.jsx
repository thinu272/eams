import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Modal from '../../components/ui/Modal';
import AttendeeTable from '../../components/suborg/AttendeeTable';
import { getSubAttendees, getSubZones, scanSubEntry } from '../../api/sub';
import { createAttendee } from '../../api/attendees';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

const emptyWorkspace = { event: null, attendees: [], total: 0, pages: 1 };

const SubOrgAttendees = () => {
  const [searchParams] = useSearchParams();
  const initialZone = searchParams.get('zone') || '';
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [filters, setFilters] = useState({ search: '', category: '', status: '', verificationStatus: '', zone: initialZone });
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [zones, setZones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();
  
  const initialAttendee = { fullName: '', email: '', phone: '', categoryId: '', notificationChannel: 'email' };
  const [newAttendee, setNewAttendee] = useState(initialAttendee);

  const load = async (eventId = currentEventId) => {
    setLoading(true);
    try {
      const [attendeesRes, zonesRes] = await Promise.all([
        getSubAttendees({ ...filters, eventId }),
        getSubZones({ eventId }),
      ]);
      setWorkspace(attendeesRes.data?.data || emptyWorkspace);
      setZones(zonesRes.data?.data?.zones || []);
      setLoadError('');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to load attendees for this workspace.';
      setLoadError(message);
      setWorkspace(emptyWorkspace);
      setZones([]);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail;
      setCurrentEventId(newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => {
      window.removeEventListener('entrynex:event-select', handleEventSelect);
    };
  }, []);

  useEffect(() => {
    load();
  }, [filters.search, filters.category, filters.status, filters.verificationStatus, currentEventId]);

  const zoneFilteredAttendees = useMemo(() => {
    if (!filters.zone) return workspace.attendees || [];
    return (workspace.attendees || []).filter((attendee) => (attendee.allowedZones || []).includes(filters.zone));
  }, [filters.zone, workspace.attendees]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    (workspace.attendees || []).forEach((attendee) => {
      if (attendee.categoryId && !map.has(attendee.categoryId)) {
        map.set(attendee.categoryId, attendee.categoryName || attendee.categoryId);
      }
    });
    return Array.from(map.entries());
  }, [workspace.attendees]);

  const availableCategories = useMemo(() => {
    if (!workspace.event?.categories) return [];
    
    // Sub-organisers can only see categories where they management at least one of the required zones
    if (user?.role === 'SubOrganiser') {
      const myZones = (user.responsibilities?.zoneIds || []).map(String);
      return workspace.event.categories.filter(cat => {
        const catZones = (cat.allowedZones || []).map(String);
        // Show if cat has no zones (general access) OR has any zone overlap with sub-organiser
        return catZones.length === 0 || catZones.some(z => myZones.includes(z));
      });
    }
    
    return workspace.event.categories;
  }, [workspace.event, user]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newAttendee.fullName || !newAttendee.categoryId) {
      toast.error('Name and category are required');
      return;
    }

    setAdding(true);
    try {
      await createAttendee({
        ...newAttendee,
        eventId: workspace.event?._id,
      });
      toast.success('Attendee created successfully');
      setAddModal(false);
      setNewAttendee(initialAttendee);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create attendee');
    } finally {
      setAdding(false);
    }
  };

  const handleMarkAttendance = async (attendee) => {
    const matchedZone = zones.find((zone) => (attendee.allowedZones || []).includes(zone.id) || (attendee.allowedZones || []).includes(zone.name));
    if (!matchedZone) {
      toast.error('This attendee does not match one of your assigned zones.');
      return;
    }

    try {
      await scanSubEntry({ qrToken: attendee.qrToken, zoneId: matchedZone.id || matchedZone.name });
      toast.success('Attendance marked.');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to mark attendance.');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Attendees</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{workspace.event?.name || 'Assigned event'}</h1>
            <p className="mt-2 text-sm text-slate-500">Search and manage attendees only inside your assigned zones.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => setAddModal(true)}>
              Add Attendee
            </Button>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
              Showing {zoneFilteredAttendees.length} of {workspace.total || 0} attendees in scope
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, email, phone" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900" />
          <select value={filters.zone} onChange={(event) => setFilters((current) => ({ ...current, zone: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
            <option value="">All assigned zones</option>
            {zones.map((zone) => <option key={zone.id || zone.name} value={zone.id || zone.name}>{zone.name}</option>)}
          </select>
          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
            <option value="">All categories</option>
            {categoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="invited">Invited</option>
            <option value="checked-in">Checked in</option>
            <option value="not-checked-in">Not checked in</option>
          </select>
          <select value={filters.verificationStatus} onChange={(event) => setFilters((current) => ({ ...current, verificationStatus: event.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900">
            <option value="">All verification</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <AttendeeTable attendees={zoneFilteredAttendees} loading={loading} onView={setSelected} onMarkAttendance={handleMarkAttendance} canEdit={false} />
        {loadError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {loadError}
          </div>
        )}
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add manual attendee">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
            <input
              required
              value={newAttendee.fullName}
              onChange={(e) => setNewAttendee({ ...newAttendee, fullName: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Attendee full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
              <input
                type="email"
                required
                value={newAttendee.email}
                onChange={(e) => setNewAttendee({ ...newAttendee, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input
                value={newAttendee.phone}
                onChange={(e) => setNewAttendee({ ...newAttendee, phone: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="+234..."
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Category *</label>
            <select
              required
              value={newAttendee.categoryId}
              onChange={(e) => setNewAttendee({ ...newAttendee, categoryId: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="">Select a category</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {user?.role === 'SubOrganiser' && availableCategories.length === 0 && (
              <p className="mt-1 text-[10px] text-red-500 italic">No categories available for your zones.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notification</label>
            <select
              value={newAttendee.notificationChannel}
              onChange={(e) => setNewAttendee({ ...newAttendee, notificationChannel: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="none">No notification (Pending)</option>
              <option value="email_sms">Send Invite (Email + SMS)</option>
              <option value="email">Email Only</option>
              <option value="sms">SMS Only</option>
            </select>
          </div>
          <div className="pt-4">
            <Button type="submit" className="w-full" loading={adding}>
              Create Attendee
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Attendee details">
        {selected && (
          <div className="space-y-4 text-sm text-slate-600">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {selected.photo ? (
                <img
                  src={selected.photo.startsWith('http') ? selected.photo : `${process.env.REACT_APP_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000'}${selected.photo.startsWith('/') ? selected.photo : `/${selected.photo}`}`}
                  alt={selected.fullName || 'Attendee'}
                  className="h-72 w-full object-cover"
                />
              ) : (
                <div className="flex h-48 items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  No verification photo uploaded
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{selected.fullName || '-'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Category</p>
                <p className="mt-1">{selected.categoryName || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Confirmation</p>
                <p className="mt-1">{selected.confirmationStatus || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</p>
                <p className="mt-1">{selected.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Phone</p>
                <p className="mt-1">{selected.phone || '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Allowed zones</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(selected.allowedZones || []).map((zone) => <span key={zone} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{zone}</span>)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgAttendees;
