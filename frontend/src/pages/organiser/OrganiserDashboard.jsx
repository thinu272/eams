import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import toast from 'react-hot-toast';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import { getMyEvents } from '../../api/events';
import {
  getOrganiserWorkspace,
  updateOrganiserAttendee,
  deleteOrganiserAttendee,
  inviteOrganiserAttendee,
  uploadOrganiserBulk,
  downloadOrganiserTemplate,
  createTicketCategory,
  updateTicketCategory,
  deleteTicketCategory,
  createSubOrganiser,
  updateSubOrganiser,
  updateVerificationStatus,
  resendInvite,
  cancelInvite,
  createZone,
  updateZone,
  deleteZone,
  assignZoneCategories,
  exportOrganiserEventData,
  resendOrganiserNotification,
  updateOrganiserSettings,
  updateOrganiserEventCustomization,
} from '../../api/organiser';

const statusColor = {
  pending: 'amber',
  confirmed: 'green',
  rejected: 'red',
  invited: 'blue',
  verified: 'green',
  PENDING: 'amber',
  ACCEPTED: 'green',
  DECLINED: 'red',
};

const emptyAttendee = { fullName: '', email: '', phone: '', nationalId: '', categoryId: '', notes: '' };
const emptyCategory = { name: '', description: '', price: 0, capacity: 0, allowedZones: [], benefits: [] };
const emptySubOrg = { 
  name: '', 
  email: '', 
  phone: '', 
  password: '', 
  role: 'SubOrganiser',
  permissions: { 
    canAddAttendees: true, 
    canVerifyPhotos: true, 
    canInviteAttendees: true, 
    canBulkUpload: false, 
    canEntryAccess: false 
  },
  responsibilities: {
    zoneIds: [],
    verificationAccess: false,
    entryAccess: false
  }
};
const emptyZone = { name: '', description: '', capacity: 0, color: '#0F766E' };

const COLORS = ['#0F766E', '#14B8A6', '#2DD4BF', '#99F6E4', '#CCFBF1'];
const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const OrganiserDashboard = () => {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('search') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [attendeeModal, setAttendeeModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [subOrgModal, setSubOrgModal] = useState(false);
  const [zoneModal, setZoneModal] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [subOrgForm, setSubOrgForm] = useState(emptySubOrg);
  const [zoneAssignments, setZoneAssignments] = useState({});
  const [settingsForm, setSettingsForm] = useState(null);
  const [customizationForm, setCustomizationForm] = useState(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [logoImageFile, setLogoImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);

  const activeSection = params.get('section') || 'overview';

  const loadWorkspace = async (selectedEventId = eventId) => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const response = await getOrganiserWorkspace({
        eventId: selectedEventId,
        search: params.get('search') || undefined,
        status: params.get('status') || undefined,
        category: params.get('category') || undefined,
      });
      const nextData = response.data?.data || null;
      setWorkspace(nextData);
      const rawSettings = nextData?.settings || {};
      setSettingsForm({
        ...rawSettings,
        emailTemplates: rawSettings.emailTemplates || {},
        smsTemplates: rawSettings.smsTemplates || {},
      });
      setCustomizationForm({
        basicInfo: {
          name: nextData?.event?.name || '',
          description: nextData?.event?.description || '',
          eventType: nextData?.event?.eventType || 'other',
          venue: {
            name: nextData?.event?.venue?.name || '',
            address: nextData?.event?.venue?.address || '',
            city: nextData?.event?.venue?.city || '',
            country: nextData?.event?.venue?.country || '',
            mapUrl: nextData?.event?.venue?.mapUrl || '',
          },
          currency: nextData?.settings?.currency || 'LKR',
        },
        branding: {
          themeColor: nextData?.event?.branding?.themeColor || '#2563EB',
          logoImage: nextData?.event?.branding?.logoImage || nextData?.event?.logoImage || '',
          bannerImage: nextData?.event?.branding?.bannerImage || nextData?.event?.bannerImage || '',
          coverImage: nextData?.event?.coverImage || '',
        },
        confirmationFlow: {
          inviteSystemEnabled: nextData?.settings?.inviteSystemEnabled ?? true,
          manualApprovalEnabled: nextData?.settings?.manualApprovalEnabled ?? false,
          autoConfirmEnabled: nextData?.settings?.autoConfirmEnabled ?? false,
        },
        paymentMethods: {
          card: nextData?.settings?.paymentMethods?.card ?? true,
          bank_transfer: nextData?.settings?.paymentMethods?.bank_transfer ?? true,
          cash: nextData?.settings?.paymentMethods?.cash ?? true,
        },
        accessRules: {
          whoCanEnter: (nextData?.settings?.accessRules?.whoCanEnter || []).join(', '),
          entryWindowStart: nextData?.settings?.accessRules?.entryWindowStart || '',
          entryWindowEnd: nextData?.settings?.accessRules?.entryWindowEnd || '',
          restrictedZones: (nextData?.settings?.accessRules?.restrictedZones || []).join(', '),
        },
        status: nextData?.event?.status || 'draft',
      });
      const zoneMap = {};
      (nextData?.event?.zones || []).forEach((zone) => {
        zoneMap[zone.id] = (nextData?.tickets || []).filter((ticket) => (ticket.allowedZones || []).includes(zone.id)).map((ticket) => ticket.id);
      });
      setZoneAssignments(zoneMap);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load organiser workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMyEvents().then((res) => {
      const list = res.data?.data?.events || [];
      setEvents(list);
      const firstEventId = eventId || list[0]?._id || '';
      if (firstEventId) {
        setEventId(firstEventId);
        localStorage.setItem('lastSelectedEventId', firstEventId);
      }
    });
  }, []);

  useEffect(() => {
    if (eventId) loadWorkspace(eventId);
  }, [eventId, params.toString()]);

  useEffect(() => {
    const onSearch = (event) => {
      const nextSearch = String(event.detail || '');
      setSearch(nextSearch);
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (nextSearch) next.set('search', nextSearch);
        else next.delete('search');
        return next;
      });
    };

    const onEvent = (event) => {
      const nextEventId = String(event.detail || '');
      if (!nextEventId) return;
      setEventId(nextEventId);
      localStorage.setItem('lastSelectedEventId', nextEventId);
    };

    window.addEventListener('entrynex:search', onSearch);
    window.addEventListener('entrynex:event-select', onEvent);
    return () => {
      window.removeEventListener('entrynex:search', onSearch);
      window.removeEventListener('entrynex:event-select', onEvent);
    };
  }, [setParams]);

  useEffect(() => {
    if (!eventId) return undefined;
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000');
    socket.emit('join_dashboard', { eventId });
    const refresh = () => loadWorkspace(eventId);
    socket.on('entry_update', refresh);
    socket.on('zone_update', refresh);
    return () => socket.disconnect();
  }, [eventId]);

  const setQuery = (key, value) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const selectedEvent = workspace?.event;
  const categories = workspace?.tickets || [];
  const attendees = workspace?.attendees?.rows || [];
  const verificationQueue = workspace?.verificationQueue || [];
  const invites = workspace?.invites || [];
  const zoneLogs = workspace?.zoneLogs || [];
  const notifications = workspace?.notifications || [];
  const stats = workspace?.overview || {};
  const teamMembers = workspace?.teamMembers || workspace?.subOrganisers || [];
  const groupedTeamMembers = useMemo(() => {
    const groups = new Map();
    const directMembers = [];

    teamMembers.forEach((member) => {
      if (member.role === 'SubOrganiser') {
        groups.set(String(member._id), { lead: member, members: [] });
      }
    });

    teamMembers.forEach((member) => {
      if (member.role === 'SubOrganiser') return;
      const ownerId = member.createdBy?._id || member.createdBy;
      if (ownerId && groups.has(String(ownerId))) {
        groups.get(String(ownerId)).members.push(member);
      } else {
        directMembers.push(member);
      }
    });

    return {
      groups: Array.from(groups.values()),
      directMembers,
    };
  }, [teamMembers]);
  const attendeeCategoryOptions = useMemo(() => categories.map((item) => ({ value: item.id, label: item.name })), [categories]);

  const saveAttendee = async () => {
    await updateOrganiserAttendee(attendeeModal._id, { ...attendeeModal, eventId });
    toast.success('Attendee updated');
    setAttendeeModal(null);
    loadWorkspace();
  };

  const removeAttendee = async (id) => {
    await deleteOrganiserAttendee(id, eventId);
    toast.success('Attendee removed');
    loadWorkspace();
  };

  const handleBulkUpload = async (file) => {
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('file', file);
    await uploadOrganiserBulk(formData);
    toast.success('Bulk upload complete');
    loadWorkspace();
  };

  const saveCategory = async () => {
    const payload = { ...categoryModal, eventId };
    if (categoryModal.id) await updateTicketCategory(categoryModal.id, payload);
    else await createTicketCategory(payload);
    toast.success(categoryModal.id ? 'Category updated' : 'Category created');
    setCategoryModal(null);
    loadWorkspace();
  };

  const saveSubOrganiser = async () => {
    if (!eventId) {
      toast.error('Select an event before creating a sub-organiser');
      return;
    }
    if (!subOrgForm.name.trim() || !subOrgForm.email.trim() || !subOrgForm.phone.trim()) {
      toast.error('Name, email, and phone are required');
      return;
    }

    try {
      await createSubOrganiser({ ...subOrgForm, eventId });
      toast.success('Team member created');
      setSubOrgModal(false);
      setSubOrgForm(emptySubOrg);
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create team member');
    }
  };

  const handleEditTeamMember = (member) => {
    setSubOrgForm({
      ...emptySubOrg,
      ...member,
      role: member.role || 'SubOrganiser',
      permissions: { ...emptySubOrg.permissions, ...(member.permissions || {}) },
      responsibilities: { ...emptySubOrg.responsibilities, ...(member.responsibilities || {}) },
      _id: member._id
    });
    setSubOrgModal(true);
  };

  const saveTeamMemberAccess = async () => {
    try {
      if (subOrgForm._id) {
        await updateSubOrganiser(subOrgForm._id, { ...subOrgForm, eventId });
        toast.success('Team member updated');
      } else {
        await saveSubOrganiser();
        return;
      }
      setSubOrgModal(false);
      setSubOrgForm(emptySubOrg);
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  const saveZone = async () => {
    const payload = { ...zoneModal, eventId };
    if (zoneModal.id) await updateZone(zoneModal.id, payload);
    else await createZone(payload);
    toast.success(zoneModal.id ? 'Zone updated' : 'Zone created');
    setZoneModal(null);
    loadWorkspace();
  };

  const saveCustomization = async () => {
    if (!customizationForm) return;
    try {
      const formData = new FormData();
      formData.append('eventId', eventId);
      formData.append('basicInfo', JSON.stringify(customizationForm.basicInfo));
      formData.append('branding', JSON.stringify(customizationForm.branding));
      formData.append('confirmationFlow', JSON.stringify(customizationForm.confirmationFlow));
      formData.append('accessRules', JSON.stringify({
        whoCanEnter: customizationForm.accessRules.whoCanEnter.split(',').map((item) => item.trim()).filter(Boolean),
        entryWindowStart: customizationForm.accessRules.entryWindowStart,
        entryWindowEnd: customizationForm.accessRules.entryWindowEnd,
        restrictedZones: customizationForm.accessRules.restrictedZones.split(',').map((item) => item.trim()).filter(Boolean),
      }));
      formData.append('paymentMethods', JSON.stringify(customizationForm.paymentMethods));
      formData.append('status', customizationForm.status);

      if (coverImageFile) formData.append('coverImage', coverImageFile);
      if (logoImageFile) formData.append('logoImage', logoImageFile);
      if (bannerImageFile) formData.append('bannerImage', bannerImageFile);

      await updateOrganiserEventCustomization(formData);
      toast.success('Event customization updated');
      setCoverImageFile(null);
      setLogoImageFile(null);
      setBannerImageFile(null);
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update event customization');
    }
  };

  if (loading && !workspace) {
    return <DashboardLayout><LoadingSkeleton /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-teal-700 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">Main Organiser Workspace</p>
              <h1 className="mt-2 text-3xl font-bold">{selectedEvent?.name || 'Assigned Event'}</h1>
              <p className="mt-2 text-sm text-white/75">{selectedEvent?.venue?.name || 'Venue'} · {selectedEvent?.status || 'draft'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">Control Scope</p>
              <p className="mt-2 text-lg font-black">{teamMembers.length || 0} team members</p>
              <p className="mt-1 text-sm text-white/70">{selectedEvent?.zones?.length || 0} zones · {categories.length || 0} ticket categories</p>
            </div>
          </div>
        </section>

        {(activeSection === 'overview' || activeSection === '') && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Total Tickets', stats.totalTickets],
                ['Tickets Sold', stats.ticketsSold],
                ['Total Revenue', `${selectedEvent?.settings?.currency || 'LKR'} ${Number(stats.totalRevenue || 0).toLocaleString()}`],
                ['Checked-In Count', stats.checkedInCount],
              ].map(([label, value]) => (
                <Card key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-900">{value || 0}</p></Card>
              ))}
            </section>
            <section className="grid gap-6 xl:grid-cols-3">
              <Card>
                <CardHeader title="Ticket Control" subtitle="See ticket setup and sales at a glance" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Categories</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{categories.length || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Sold</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{stats.ticketsSold || 0}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Open ticket management</p>
                    <p className="text-xs text-slate-500">Update categories, capacity, and zone access.</p>
                  </div>
                  <Button variant="outline" onClick={() => setQuery('section', 'tickets')}>Open</Button>
                </div>
              </Card>
              <Card>
                <CardHeader title="Zone Control" subtitle="Monitor event areas and movement" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Zones</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{selectedEvent?.zones?.length || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Zone Logs</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{zoneLogs.length || 0}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Open zone control</p>
                    <p className="text-xs text-slate-500">Manage areas, ticket access, and movement history.</p>
                  </div>
                  <Button variant="outline" onClick={() => setQuery('section', 'zones')}>Open</Button>
                </div>
              </Card>
              <Card>
                <CardHeader title="Team Control" subtitle="Supervise sub-organisers and event staff" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Team Members</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{teamMembers.length || 0}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Verification Queue</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{verificationQueue.length || 0}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {teamMembers.slice(0, 2).map((member) => (
                    <div key={member._id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                      <div>
                        <p className="font-semibold text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.role} · {member.status}</p>
                      </div>
                      <button className="text-sm font-semibold text-blue-600 hover:underline" onClick={() => handleEditTeamMember(member)}>Control</button>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                      No team members added yet.
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" onClick={() => setQuery('section', 'suborganisers')}>Open Team</Button>
                </div>
              </Card>
            </section>
            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Card>
                <CardHeader title="Check-ins Over Time" subtitle="Live event flow for your selected event" />
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={workspace?.charts?.checkinsOverTime || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="label" stroke="#64748B" />
                      <YAxis stroke="#64748B" allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#0F766E" strokeWidth={3} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardHeader title="Revenue by Category" subtitle="Distribution across ticket tiers" />
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={workspace?.charts?.revenueByCategory || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(workspace?.charts?.revenueByCategory || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${selectedEvent?.settings?.currency || 'LKR'} ${value.toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardHeader title="Activity Feed" subtitle="Last five operations" />
                <div className="space-y-3">
                  {(workspace?.activityFeed || []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </>
        )}

        {activeSection === 'customization' && customizationForm && (
          <Card>
            <CardHeader
              title="Event Customization"
              subtitle="Update the public-facing event details, branding, and confirmation flow."
              action={<Button onClick={saveCustomization}>Save Customization</Button>}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Event name</span>
                  <input
                    value={customizationForm.basicInfo.name}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, name: e.target.value } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Description</span>
                  <textarea
                    rows="5"
                    value={customizationForm.basicInfo.description}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, description: e.target.value } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Event type</span>
                  <select
                    value={customizationForm.basicInfo.eventType}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, eventType: e.target.value } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <option value="cricket">Cricket</option>
                    <option value="concert">Concert</option>
                    <option value="conference">Conference</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Currency</span>
                  <select
                    value={customizationForm.basicInfo.currency}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, currency: e.target.value } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 bg-white"
                  >
                    <option value="LKR">LKR (Sri Lankan Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="GBP">GBP (British Pound)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="AUD">AUD (Australian Dollar)</option>
                    <option value="AED">AED (UAE Dirham)</option>
                    <option value="SGD">SGD (Singapore Dollar)</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Theme color</span>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={customizationForm.branding.themeColor}
                      onChange={(e) => setCustomizationForm((current) => ({ ...current, branding: { ...current.branding, themeColor: e.target.value } }))}
                      className="h-12 w-20 rounded-xl border border-slate-200 p-1 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={customizationForm.branding.themeColor}
                      onChange={(e) => setCustomizationForm((current) => ({ ...current, branding: { ...current.branding, themeColor: e.target.value } }))}
                      className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 uppercase"
                      placeholder="#2563EB"
                    />
                  </div>
                </label>
                <div className="space-y-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Event Logo</span>
                  {customizationForm.branding.logoImage && !logoImageFile && (
                    <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
                      <img src={customizationForm.branding.logoImage.startsWith('http') ? customizationForm.branding.logoImage : `http://localhost:5000${customizationForm.branding.logoImage}`} alt="logo" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoImageFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cover Image (Card View)</span>
                  {customizationForm.branding.coverImage && !coverImageFile && (
                    <div className="h-24 w-full max-w-xs overflow-hidden rounded-xl border border-slate-200">
                      <img src={customizationForm.branding.coverImage.startsWith('http') ? customizationForm.branding.coverImage : `http://localhost:5000${customizationForm.branding.coverImage}`} alt="cover" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div className="space-y-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Hero Banner Image</span>
                  {customizationForm.branding.bannerImage && !bannerImageFile && (
                    <div className="h-32 w-full overflow-hidden rounded-2xl border border-slate-200">
                      <img src={customizationForm.branding.bannerImage.startsWith('http') ? customizationForm.branding.bannerImage : `http://localhost:5000${customizationForm.branding.bannerImage}`} alt="banner" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBannerImageFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Venue name</span>
                  <input
                    value={customizationForm.basicInfo.venue.name}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, venue: { ...current.basicInfo.venue, name: e.target.value } } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Venue address</span>
                  <input
                    value={customizationForm.basicInfo.venue.address}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, venue: { ...current.basicInfo.venue, address: e.target.value } } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-500">City</span>
                    <input
                      value={customizationForm.basicInfo.venue.city}
                      onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, venue: { ...current.basicInfo.venue, city: e.target.value } } }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-500">Country</span>
                    <input
                      value={customizationForm.basicInfo.venue.country}
                      onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, venue: { ...current.basicInfo.venue, country: e.target.value } } }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Map URL</span>
                  <input
                    value={customizationForm.basicInfo.venue.mapUrl}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, basicInfo: { ...current.basicInfo, venue: { ...current.basicInfo.venue, mapUrl: e.target.value } } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                  />
                </label>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Confirmation Flow</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    {[
                      ['inviteSystemEnabled', 'Invite system enabled'],
                      ['manualApprovalEnabled', 'Manual approval required'],
                      ['autoConfirmEnabled', 'Auto confirm attendees'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!customizationForm.confirmationFlow[key]}
                          onChange={(e) => setCustomizationForm((current) => ({ ...current, confirmationFlow: { ...current.confirmationFlow, [key]: e.target.checked } }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-sm font-bold text-blue-900">Visibility Status</p>
                  <div className="mt-3 space-y-3 text-sm text-blue-700">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        checked={customizationForm.status === 'published'}
                        onChange={(e) => setCustomizationForm((current) => ({ 
                          ...current, 
                          status: e.target.checked ? 'published' : 'draft' 
                        }))}
                      />
                      <span className="font-semibold">Publish Match (Make visible to public)</span>
                    </label>
                    <p className="text-xs text-blue-600/70 ml-7">
                      When published, this event will appear on the public homepage and users can browse tickets.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-slate-900">Payment Methods</p>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Choose which payment options are available for this match.</p>
                  <div className="space-y-3 text-sm text-slate-700">
                    {[
                      ['card', 'Credit/Debit Card (Online)'],
                      ['bank_transfer', 'Bank Transfer (Offline)'],
                      ['cash', 'Cash (At Venue/Counter)'],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!customizationForm.paymentMethods[key]}
                          onChange={(e) => setCustomizationForm((current) => ({ 
                            ...current, 
                            paymentMethods: { ...current.paymentMethods, [key]: e.target.checked } 
                          }))}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Who can enter</span>
                  <input
                    value={customizationForm.accessRules.whoCanEnter}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, accessRules: { ...current.accessRules, whoCanEnter: e.target.value } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    placeholder="VIP, General, Staff"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-500">Entry window start</span>
                    <input
                      value={customizationForm.accessRules.entryWindowStart}
                      onChange={(e) => setCustomizationForm((current) => ({ ...current, accessRules: { ...current.accessRules, entryWindowStart: e.target.value } }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      placeholder="08:00"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-slate-500">Entry window end</span>
                    <input
                      value={customizationForm.accessRules.entryWindowEnd}
                      onChange={(e) => setCustomizationForm((current) => ({ ...current, accessRules: { ...current.accessRules, entryWindowEnd: e.target.value } }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                      placeholder="10:30"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Restricted zones</span>
                  <input
                    value={customizationForm.accessRules.restrictedZones}
                    onChange={(e) => setCustomizationForm((current) => ({ ...current, accessRules: { ...current.accessRules, restrictedZones: e.target.value } }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3"
                    placeholder="media-center, vip-lounge"
                  />
                </label>
              </div>
            </div>
          </Card>
        )}

        {activeSection === 'attendees' && (
          <Card>
            <CardHeader
              title="Attendee Management"
              subtitle="Search, filter, edit, delete, resend, and bulk import attendees"
              action={<div className="flex gap-2"><Button variant="outline" onClick={async () => {
                const res = await downloadOrganiserTemplate({ eventId });
                downloadBlob(res.data, `attendees-template-${eventId}.xlsx`);
              }}>Download Template</Button><label className="inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"><input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && handleBulkUpload(e.target.files[0])} />Upload Excel</label></div>}
            />
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <input value={search} onChange={(e) => { setSearch(e.target.value); setQuery('search', e.target.value); }} placeholder="Search by name, email, phone" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <select value={status} onChange={(e) => { setStatus(e.target.value); setQuery('status', e.target.value); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setQuery('category', e.target.value); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select>
            </div>
            <Table>
              <thead><tr><Th>Name</Th><Th>Category</Th><Th>Status</Th><Th>Photo</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {attendees.map((attendee) => (
                  <Tr key={attendee._id}>
                    <Td><div><p className="font-semibold">{attendee.fullName}</p><p className="text-xs text-slate-500">{attendee.email || attendee.phone || '-'}</p></div></Td>
                    <Td>{attendee.categoryName || '-'}</Td>
                    <Td><Badge color={statusColor[attendee.confirmationStatus] || 'gray'}>{attendee.confirmationStatus}</Badge></Td>
                    <Td><Badge color={statusColor[attendee.photoVerificationStatus] || 'gray'}>{attendee.photoVerificationStatus}</Badge></Td>
                    <Td className="space-x-2"><button className="text-blue-600" onClick={() => setAttendeeModal({ ...emptyAttendee, ...attendee })}>Edit</button><button className="text-rose-600" onClick={() => removeAttendee(attendee._id)}>Delete</button><button className="text-teal-700" onClick={() => inviteOrganiserAttendee(attendee._id, eventId).then(() => { toast.success('Invite resent'); loadWorkspace(); })}>Resend Invite</button></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {activeSection === 'tickets' && (
          <Card>
            <CardHeader title="Ticket Management" subtitle="Manage categories, capacity, pricing, and assignments" action={<Button onClick={() => setCategoryModal({ ...emptyCategory })}>Add Category</Button>} />
            <Table>
              <thead><tr><Th>Name</Th><Th>Price</Th><Th>Capacity</Th><Th>Sold</Th><Th>Assigned / Unassigned</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {categories.map((ticket) => (
                  <Tr key={ticket.id}>
                    <Td>{ticket.name}</Td><Td>{selectedEvent?.settings?.currency || 'LKR'} {Number(ticket.price || 0).toLocaleString()}</Td><Td>{ticket.capacity}</Td><Td>{ticket.soldCount}</Td><Td>{ticket.assignedCount} / {ticket.unassignedCount}</Td>
                    <Td className="space-x-2"><button className="text-blue-600" onClick={() => setCategoryModal(ticket)}>Edit</button><button className="text-rose-600" onClick={() => deleteTicketCategory(ticket.id, eventId).then(() => { toast.success('Category deleted'); loadWorkspace(); })}>Delete</button></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {activeSection === 'suborganisers' && (
          <Card>
            <CardHeader title="Team Management" subtitle="Create and permission event team members" action={<Button onClick={() => { setSubOrgForm(emptySubOrg); setSubOrgModal(true); }}>Create Team Member</Button>} />
            <div className="space-y-6">
              {groupedTeamMembers.groups.map(({ lead, members }) => (
                <div key={lead._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Sub Organiser</p>
                      <h3 className="mt-2 text-xl font-black text-slate-900">{lead.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{lead.email} · {lead.phone}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge color={lead.status === 'Active' ? 'green' : 'gray'}>{lead.status}</Badge>
                        <Badge color="blue">{members.length} members</Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" onClick={() => handleEditTeamMember(lead)}>Control Sub Organiser</Button>
                      <Button variant="outline" onClick={() => updateSubOrganiser(lead._id, { eventId, status: lead.status === 'Active' ? 'Inactive' : 'Active' }).then(() => { toast.success('Status updated'); loadWorkspace(); })}>Toggle Status</Button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <Table>
                      <thead><tr><Th>Member</Th><Th>Role</Th><Th>Scope</Th><Th>Zones / Gates</Th><Th>Actions</Th></tr></thead>
                      <tbody>
                        {members.map((user) => (
                          <Tr key={user._id}>
                            <Td><div className="font-semibold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email} · {user.phone}</div></Td>
                            <Td><div className="text-xs font-bold uppercase tracking-wider text-blue-600">{user.role}</div><Badge color={user.status === 'Active' ? 'green' : 'gray'}>{user.status}</Badge></Td>
                            <Td>
                              <div className="flex flex-wrap gap-1">
                                {(user.assignedGates || []).length > 0 && <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700">Entry</span>}
                                {(user.assignedZones || user.responsibilities?.zoneIds || []).length > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Zone</span>}
                                {!(user.assignedGates || []).length && !(user.assignedZones || user.responsibilities?.zoneIds || []).length && <span className="text-xs text-slate-400">General</span>}
                              </div>
                            </Td>
                            <Td className="text-xs text-slate-600">{[...(user.assignedGates || []), ...(user.assignedZones || user.responsibilities?.zoneIds || [])].join(', ') || 'General event scope'}</Td>
                            <Td>
                              <div className="flex flex-col gap-1">
                                <button className="text-left text-xs font-semibold text-blue-600 hover:underline" onClick={() => handleEditTeamMember(user)}>Edit Access</button>
                                <button className="text-left text-xs font-semibold text-slate-600 hover:underline" onClick={() => updateSubOrganiser(user._id, { eventId, status: user.status === 'Active' ? 'Inactive' : 'Active' }).then(() => { toast.success('Status updated'); loadWorkspace(); })}>Toggle Status</button>
                              </div>
                            </Td>
                          </Tr>
                        ))}
                        {members.length === 0 && (
                          <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-500">No team members assigned under this sub organiser yet.</td></tr>
                        )}
                      </tbody>
                    </Table>
                  </div>
                </div>
              ))}

              {groupedTeamMembers.directMembers.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="text-lg font-black text-slate-900">Direct Event Team</h3>
                  <p className="mt-1 text-sm text-slate-500">Members assigned directly by the Main Organiser.</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    <Table>
                      <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Scope</Th><Th>Actions</Th></tr></thead>
                      <tbody>
                        {groupedTeamMembers.directMembers.map((user) => (
                          <Tr key={user._id}>
                            <Td><div className="font-semibold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></Td>
                            <Td>{user.role}</Td>
                            <Td><Badge color={user.status === 'Active' ? 'green' : 'gray'}>{user.status}</Badge></Td>
                            <Td className="text-xs text-slate-600">{[...(user.assignedGates || []), ...(user.assignedZones || user.responsibilities?.zoneIds || [])].join(', ') || 'General event scope'}</Td>
                            <Td><button className="text-left text-xs font-semibold text-blue-600 hover:underline" onClick={() => handleEditTeamMember(user)}>Control</button></Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeSection === 'verification' && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {verificationQueue.map((attendee) => (
              <Card key={attendee._id}>
                <div className="h-48 overflow-hidden rounded-2xl bg-slate-100">{attendee.photo ? <img src={attendee.photo} alt={attendee.fullName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No photo</div>}</div>
                <h3 className="mt-4 font-semibold text-slate-900">{attendee.fullName}</h3>
                <p className="text-sm text-slate-500">{attendee.email || attendee.phone || '-'}</p>
                <div className="mt-4 flex gap-2"><Button className="flex-1" onClick={() => updateVerificationStatus(attendee._id, { eventId, status: 'verified' }).then(() => { toast.success('Photo approved'); loadWorkspace(); })}>Approve</Button><Button variant="danger" className="flex-1" onClick={() => setRejecting(attendee)}>Reject</Button></div>
              </Card>
            ))}
          </div>
        )}

        {activeSection === 'invites' && (
          <Card>
            <CardHeader title="Invite Management" subtitle="Track pending, accepted, and declined invitations" />
            <Table>
              <thead><tr><Th>Attendee</Th><Th>Category</Th><Th>Status</Th><Th>History</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {invites.map((invite) => (
                  <Tr key={invite._id}>
                    <Td>{invite.attendee?.fullName || 'Unassigned'}<div className="text-xs text-slate-500">{invite.attendee?.email || '-'}</div></Td>
                    <Td>{invite.categoryName}</Td>
                    <Td><Badge color={statusColor[invite.inviteStatus] || 'gray'}>{invite.inviteStatus}</Badge></Td>
                    <Td className="text-xs text-slate-500">{invite.inviteHistory.map((item) => `${item.type} ${formatDistanceToNow(new Date(item.at), { addSuffix: true })}`).join(' · ') || 'No history'}</Td>
                    <Td className="space-x-2"><button className="text-blue-600" onClick={() => resendInvite(invite._id, eventId).then(() => { toast.success('Invite resent'); loadWorkspace(); })}>Resend</button><button className="text-rose-600" onClick={() => cancelInvite(invite._id, eventId).then(() => { toast.success('Invite cancelled'); loadWorkspace(); })}>Cancel</button></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {activeSection === 'logs' && (
          <Card>
            <CardHeader title="Entry Logs" subtitle="Real-time event access activity" />
            <Table>
              <thead><tr><Th>Name</Th><Th>Time</Th><Th>Gate</Th><Th>Status</Th></tr></thead>
              <tbody>
                {(workspace?.entryLogs || []).map((log) => (
                  <Tr key={log._id}><Td>{log.attendee?.fullName || log.snapshot?.fullName || '-'}</Td><Td>{new Date(log.timestamp).toLocaleString()}</Td><Td>{log.gateName || log.zoneName || '-'}</Td><Td><Badge color={log.accessGranted ? 'green' : 'red'}>{log.accessGranted ? 'Allowed' : 'Denied'}</Badge></Td></Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {activeSection === 'zones' && (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader title="Zone Access Control" subtitle="Create zones and assign them to ticket categories" action={<Button onClick={() => setZoneModal({ ...emptyZone })}>Add Zone</Button>} />
              <div className="space-y-4">
                {(selectedEvent?.zones || []).map((zone) => (
                  <div key={zone.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between"><div><p className="font-semibold">{zone.name}</p><p className="text-sm text-slate-500">{zone.description || 'No description'}</p></div><div className="space-x-2"><button className="text-blue-600" onClick={() => setZoneModal(zone)}>Edit</button><button className="text-rose-600" onClick={() => deleteZone(zone.id, eventId).then(() => { toast.success('Zone deleted'); loadWorkspace(); })}>Delete</button></div></div>
                    <div className="mt-3 flex flex-wrap gap-2">{categories.map((ticket) => <label key={ticket.id} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs"><input type="checkbox" checked={(zoneAssignments[zone.id] || []).includes(ticket.id)} onChange={(e) => {
                      const next = e.target.checked ? [...new Set([...(zoneAssignments[zone.id] || []), ticket.id])] : (zoneAssignments[zone.id] || []).filter((item) => item !== ticket.id);
                      setZoneAssignments((current) => ({ ...current, [zone.id]: next }));
                      assignZoneCategories(zone.id, { eventId, categoryIds: next }).then(() => toast.success('Zone assignments updated'));
                    }} />{ticket.name}</label>)}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Zone Logs" subtitle="Entry and exit history across event zones" />
              <Table>
                <thead><tr><Th>Attendee</Th><Th>Zone</Th><Th>Action</Th><Th>Time</Th></tr></thead>
                <tbody>
                  {zoneLogs.map((log) => <Tr key={log._id}><Td>{log.attendeeId?.fullName || '-'}</Td><Td>{log.zoneName}</Td><Td><Badge color={log.action === 'ENTRY' ? 'blue' : 'gray'}>{log.action}</Badge></Td><Td>{new Date(log.timestamp).toLocaleString()}</Td></Tr>)}
                </tbody>
              </Table>
            </Card>
          </div>
        )}

        {activeSection === 'reports' && (
          <div className="grid gap-6 md:grid-cols-2">
            {(workspace?.reports?.available || []).map((report) => (
              <Card key={report.id}>
                <CardHeader title={report.label} subtitle="Export CSV for quick operational analysis" />
                <Button onClick={() => exportOrganiserEventData(eventId, { type: report.exportType }).then((res) => downloadBlob(res.data, `${report.id}-${eventId}.csv`))}>Export CSV</Button>
              </Card>
            ))}
          </div>
        )}

        {activeSection === 'notifications' && (
          <Card>
            <CardHeader title="Notifications" subtitle="Email and SMS activity for organiser workflows" />
            <Table>
              <thead><tr><Th>Title</Th><Th>Message</Th><Th>Channel</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {notifications.map((item) => <Tr key={item._id}><Td>{item.title}</Td><Td>{item.message}</Td><Td>{item.metadata?.channel || 'email_sms'}</Td><Td><button className="text-blue-600" onClick={() => resendOrganiserNotification(item._id, eventId).then(() => toast.success('Notification re-queued'))}>Resend</button></Td></Tr>)}
              </tbody>
            </Table>
          </Card>
        )}

        {activeSection === 'settings' && settingsForm && (
          <Card>
            <CardHeader title="Event Settings" subtitle="Manage event details, templates, and organiser limits" action={<Button onClick={() => updateOrganiserSettings({ eventId, name: selectedEvent?.name, venue: selectedEvent?.venue, settings: settingsForm }).then(() => toast.success('Settings updated'))}>Save</Button>} />
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm"><span className="text-slate-500">Invite email template</span><textarea rows="5" value={settingsForm.emailTemplates?.invite || ''} onChange={(e) => setSettingsForm((current) => ({ ...current, emailTemplates: { ...(current.emailTemplates || {}), invite: e.target.value } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
              <label className="space-y-2 text-sm"><span className="text-slate-500">Invite SMS template</span><textarea rows="5" value={settingsForm.smsTemplates?.invite || ''} onChange={(e) => setSettingsForm((current) => ({ ...current, smsTemplates: { ...(current.smsTemplates || {}), invite: e.target.value } }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
              <label className="space-y-2 text-sm"><span className="text-slate-500">Invite limit per attendee</span><input type="number" value={settingsForm.inviteLimitPerAttendee || 3} onChange={(e) => setSettingsForm((current) => ({ ...current, inviteLimitPerAttendee: Number(e.target.value) }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
              <label className="space-y-2 text-sm"><span className="text-slate-500">Max tickets per order</span><input type="number" value={settingsForm.maxTicketsPerOrder || 10} onChange={(e) => setSettingsForm((current) => ({ ...current, maxTicketsPerOrder: Number(e.target.value) }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
            </div>
          </Card>
        )}
      </div>

      <Modal open={!!attendeeModal} onClose={() => setAttendeeModal(null)} title="Edit Attendee">
        {attendeeModal && <div className="space-y-3"><input value={attendeeModal.fullName} onChange={(e) => setAttendeeModal((current) => ({ ...current, fullName: e.target.value }))} className="w-full rounded-xl border px-4 py-2" placeholder="Full name" /><input value={attendeeModal.email || ''} onChange={(e) => setAttendeeModal((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-xl border px-4 py-2" placeholder="Email" /><input value={attendeeModal.phone || ''} onChange={(e) => setAttendeeModal((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-xl border px-4 py-2" placeholder="Phone" /><select value={attendeeModal.categoryId || ''} onChange={(e) => setAttendeeModal((current) => ({ ...current, categoryId: e.target.value }))} className="w-full rounded-xl border px-4 py-2">{attendeeCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Button onClick={saveAttendee}>Save Changes</Button></div>}
      </Modal>

      <Modal open={!!categoryModal} onClose={() => setCategoryModal(null)} title={categoryModal?.id ? 'Edit Category' : 'Add Category'}>
        {categoryModal && <div className="space-y-3"><input value={categoryModal.name || ''} onChange={(e) => setCategoryModal((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl border px-4 py-2" placeholder="Category name" />
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">{selectedEvent?.settings?.currency || 'LKR'}</span>
            <input type="number" value={categoryModal.price || 0} onChange={(e) => setCategoryModal((current) => ({ ...current, price: Number(e.target.value) }))} className="w-full rounded-xl border pl-16 pr-4 py-2" placeholder="Price" />
          </div>
          <input type="number" value={categoryModal.capacity || 0} onChange={(e) => setCategoryModal((current) => ({ ...current, capacity: Number(e.target.value) }))} className="w-full rounded-xl border px-4 py-2" placeholder="Capacity" /><Button onClick={saveCategory}>Save Category</Button></div>}
      </Modal>

      <Modal open={subOrgModal} onClose={() => setSubOrgModal(false)} title={subOrgForm._id ? 'Manage Team Member Access' : 'Create Team Member'}>
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 block">
              <span className="text-xs font-bold uppercase text-slate-500">Name</span>
              <input value={subOrgForm.name} onChange={(e) => setSubOrgForm((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Full name" />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-bold uppercase text-slate-500">Role</span>
              <select value={subOrgForm.role} onChange={(e) => setSubOrgForm((current) => ({ ...current, role: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm">
                <option value="SubOrganiser">Sub-Organiser</option>
                <option value="Staff">Staff</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Auditor">Auditor</option>
              </select>
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-bold uppercase text-slate-500">Email</span>
              <input value={subOrgForm.email} onChange={(e) => setSubOrgForm((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Email address" />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-bold uppercase text-slate-500">Phone</span>
              <input value={subOrgForm.phone} onChange={(e) => setSubOrgForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Phone number" />
            </label>
            {!subOrgForm._id && (
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-xs font-bold uppercase text-slate-500">Temporary Password</span>
                <input value={subOrgForm.password} onChange={(e) => setSubOrgForm((current) => ({ ...current, password: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Set initial password" />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-500">Zone Access</span>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(selectedEvent?.zones || []).map((zone) => (
                <label key={zone.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={(subOrgForm.responsibilities?.zoneIds || []).includes(zone.id || zone.name)}
                    onChange={(e) => {
                      const zid = zone.id || zone.name;
                      const next = e.target.checked 
                        ? [...new Set([...(subOrgForm.responsibilities?.zoneIds || []), zid])]
                        : (subOrgForm.responsibilities?.zoneIds || []).filter(item => item !== zid);
                      setSubOrgForm(curr => ({ ...curr, responsibilities: { ...curr.responsibilities, zoneIds: next } }));
                    }}
                  />
                  {zone.name}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-500">Permissions</span>
            <div className="mt-3 space-y-2">
              {Object.keys(subOrgForm.permissions).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={!!subOrgForm.permissions[key]} 
                    onChange={(e) => setSubOrgForm((current) => ({ ...current, permissions: { ...current.permissions, [key]: e.target.checked } }))} 
                  />
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button className="w-full" onClick={saveTeamMemberAccess}>
              {subOrgForm._id ? 'Update Access' : 'Create Team Member'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!zoneModal} onClose={() => setZoneModal(null)} title={zoneModal?.id ? 'Edit Zone' : 'Create Zone'}>
        {zoneModal && <div className="space-y-3"><input value={zoneModal.name || ''} onChange={(e) => setZoneModal((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl border px-4 py-2" placeholder="Zone name" /><input value={zoneModal.description || ''} onChange={(e) => setZoneModal((current) => ({ ...current, description: e.target.value }))} className="w-full rounded-xl border px-4 py-2" placeholder="Description" /><input type="number" value={zoneModal.capacity || 0} onChange={(e) => setZoneModal((current) => ({ ...current, capacity: Number(e.target.value) }))} className="w-full rounded-xl border px-4 py-2" placeholder="Capacity" /><Button onClick={saveZone}>Save Zone</Button></div>}
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject Photo">
        {rejecting && <div className="space-y-3"><textarea rows="4" value={rejecting.reason || ''} onChange={(e) => setRejecting((current) => ({ ...current, reason: e.target.value }))} className="w-full rounded-xl border px-4 py-3" placeholder="Reason for rejection" /><Button variant="danger" onClick={() => updateVerificationStatus(rejecting._id, { eventId, status: 'rejected', reason: rejecting.reason || '' }).then(() => { toast.success('Photo rejected'); setRejecting(null); loadWorkspace(); })}>Reject Photo</Button></div>}
      </Modal>
    </DashboardLayout>
  );
};

export default OrganiserDashboard;
