import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { BuildingOffice2Icon, CreditCardIcon, ShieldCheckIcon, TicketIcon, UsersIcon, CheckBadgeIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import LoadingSkeleton from '../../components/shared/LoadingSkeleton';
import AdminSettingsPanel from './AdminSettingsPanel';
import toast from 'react-hot-toast';
import {
  createSuperAdminEvent,
  createSuperAdminOrganiser,
  createSuperAdminUser,
  deleteSuperAdminEvent,
  deleteSuperAdminOrganiser,
  deleteSuperAdminUser,
  exportSuperAdminReport,
  getSuperAdminWorkspace,
  resendSuperAdminNotification,
  searchSuperAdmin,
  updateSuperAdminEvent,
  updateSuperAdminOrganiser,
  updateSuperAdminSettings,
  updateSuperAdminUser,
  resendSuperAdminUserCredentials,
  updateSuperAdminUserStatus,
} from '../../api/superAdmin';

const SECTION_LABELS = {
  overview: 'Overview',
  events: 'Events',
  organisations: 'Organisations / Organisers',
  users: 'Users',
  tickets: 'Tickets',
  verification: 'Verification',
  'entry-logs': 'Entry Logs',
  'zone-activity': 'Zone Activity',
  notifications: 'Notifications',
  reports: 'Reports',
  settings: 'System Settings',
};

const statusTone = { Active: 'green', Inactive: 'red', Live: 'green', Upcoming: 'blue', Completed: 'gray', Allowed: 'green', Denied: 'red', pending: 'amber', rejected: 'red', verified: 'green' };

const downloadBlob = (blob, fallbackName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const fmt = (value) => (value ? format(new Date(value), 'dd MMM yyyy, HH:mm') : '-');
const money = (value, currency = 'LKR') => `${currency} ${Number(value || 0).toLocaleString()}`;
const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-3xl border-slate-200">
    <div className="flex items-start justify-between">
      <div><p className="text-sm text-slate-500">{title}</p><p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>
      <div className="rounded-2xl bg-slate-100 p-3 text-slate-600"><Icon className="h-6 w-6" /></div>
    </div>
  </Card>
);
const Field = ({ label, children }) => <label className="space-y-2"><span className="text-sm font-medium text-slate-700">{label}</span>{children}</label>;
const Input = (props) => <input {...props} className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 ${props.className || ''}`} />;
const Select = (props) => <select {...props} className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ${props.className || ''}`} />;

const SectionFilters = ({ section, params, updateQuery, organiserOptions = [] }) => {
  if (section === 'overview' || section === 'settings') return null;
  return (
    <Card className="rounded-[28px] border-slate-200">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input placeholder="Search" value={params.get('search') || ''} onChange={(e) => updateQuery('search', e.target.value)} />
        {section === 'events' && (
          <>
            <Select value={params.get('status') || ''} onChange={(e) => updateQuery('status', e.target.value)}>
              <option value="">All statuses</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option>
            </Select>
            <Select value={params.get('organiser') || ''} onChange={(e) => updateQuery('organiser', e.target.value)}>
              <option value="">All organisers</option>
              {organiserOptions.map((option) => <option key={option._id} value={option._id}>{option.name}</option>)}
            </Select>
          </>
        )}
        {(section === 'organisations' || section === 'users') && (
          <Select value={params.get('status') || ''} onChange={(e) => updateQuery('status', e.target.value)}>
            <option value="">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
          </Select>
        )}
        {section === 'users' && (
          <Select value={params.get('role') || ''} onChange={(e) => updateQuery('role', e.target.value)}>
            <option value="">All roles</option>{['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Attendee'].map((role) => <option key={role} value={role}>{role}</option>)}
          </Select>
        )}
        {section === 'verification' && (
          <Select value={params.get('status') || ''} onChange={(e) => updateQuery('status', e.target.value)}>
            <option value="">All verification states</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
          </Select>
        )}
        {(section === 'entry-logs' || section === 'zone-activity' || section === 'reports') && (
          <>
            <Input type="date" value={params.get('from') || ''} onChange={(e) => updateQuery('from', e.target.value)} />
            <Input type="date" value={params.get('to') || ''} onChange={(e) => updateQuery('to', e.target.value)} />
          </>
        )}
      </div>
    </Card>
  );
};

const SectionContent = ({ section, workspace, params, updateQuery, openModal, loadWorkspace, deleteOrganiser, deleteUser }) => {
  const overview = workspace?.overview;
  const eventRows = workspace?.events?.rows || [];
  const organiserRows = workspace?.organisations?.rows || [];
  const userRows = workspace?.users?.rows || [];
  const ticketRows = workspace?.tickets?.rows || [];
  const verification = workspace?.verification;
  const entryRows = workspace?.entryLogs?.rows || [];
  const zoneActivity = workspace?.zoneActivity;
  const notificationRows = workspace?.notifications?.rows || [];
  const reports = workspace?.reports;
  const organiserOptions = workspace?.events?.filters?.organiserOptions || [];

  return (
    <>
      <SectionFilters section={section} params={params} updateQuery={updateQuery} organiserOptions={organiserOptions} />
      {section === 'overview' && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Total Events" value={overview?.metrics?.totalEvents || 0} subtitle="All events in the platform" icon={TicketIcon} />
            <MetricCard title="Total Users" value={overview?.metrics?.totalUsers || 0} subtitle="Across every role" icon={UsersIcon} />
            <MetricCard title="Tickets Sold" value={overview?.metrics?.totalTicketsSold || 0} subtitle="System-wide issued tickets" icon={CreditCardIcon} />
            <MetricCard title="Total Revenue" value={money(overview?.metrics?.totalRevenue, workspace?.settings?.currency)} subtitle="Confirmed order value" icon={BuildingOffice2Icon} />
            <MetricCard title="Active Events" value={overview?.metrics?.activeEvents || 0} subtitle="Live events running now" icon={ShieldCheckIcon} />
            <MetricCard title="Verification Rate" value={`${overview?.metrics?.verificationRate || 0}%`} subtitle="Attendees with verified photos" icon={CheckBadgeIcon} />
            <MetricCard title="Avg Ticket Price" value={money(overview?.metrics?.avgTicketPrice, workspace?.settings?.currency)} subtitle="Mean price per sold ticket" icon={CurrencyDollarIcon} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.7fr,1fr]">
            <Card className="rounded-[28px] border-slate-200">
              <CardHeader title="Ticket Sales Over Time" subtitle="Global ticket demand over the last 30 days" />
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={overview?.ticketSalesOverTime || []}>
                    <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} /><stop offset="95%" stopColor="#0f766e" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="ticketsSold" stroke="#0f766e" strokeWidth={2.5} fill="url(#salesFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="rounded-[28px] border-slate-200">
              <CardHeader title="Latest System Activity" subtitle="Recent scans and platform actions" />
              <div className="space-y-3">{(overview?.activity || []).map((item) => <div key={item._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">{item.title}</p><span className="text-xs text-slate-400">{fmt(item.createdAt)}</span></div><p className="mt-1 text-sm text-slate-500">{item.subtitle}</p></div>)}</div>
            </Card>
          </div>
        </>
      )}
      {section === 'events' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <Table><thead><Tr><Th>Event</Th><Th>Organiser</Th><Th>Date</Th><Th>Status</Th><Th>Tickets</Th><Th>Actions</Th></Tr></thead><tbody>
            {eventRows.map((row) => <Tr key={row._id}><Td><div><p className="font-medium text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.venue}</p></div></Td><Td>{row.organiser?.name || 'Unassigned'}</Td><Td>{fmt(row.date)}</Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td><Td>{row.ticketsSold} / {row.ticketCapacity}</Td><Td><div className="flex gap-2"><Button variant="outline" onClick={() => openModal('event', 'edit', row)}>Edit</Button><Button variant="outline" className="text-rose-500" onClick={async () => { await deleteSuperAdminEvent(row._id); toast.success('Event deleted'); loadWorkspace(); }}>Delete</Button></div></Td></Tr>)}
          </tbody></Table>
        </Card>
      )}
      {section === 'organisations' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <Table><thead><Tr><Th>Organiser</Th><Th>Status</Th><Th>Events</Th><Th>Tickets Sold</Th><Th>Live Events</Th><Th>Actions</Th></Tr></thead><tbody>
            {organiserRows.map((row) => <Tr key={row._id}><Td><div><p className="font-medium text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.email}</p></div></Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td><Td>{row.stats.eventsCreated}</Td><Td>{row.stats.ticketsSold}</Td><Td>{row.stats.liveEvents}</Td><Td><div className="flex gap-2">
              <Button variant="outline" onClick={() => openModal('organiser', 'edit', row)}>Manage</Button>
              <Button variant="outline" onClick={async () => { await resendSuperAdminUserCredentials(row._id); toast.success('Login details email sent'); }}>Resend login</Button>
              <Button variant="outline" onClick={async () => { await updateSuperAdminUserStatus(row._id, row.status === 'Active' ? 'Inactive' : 'Active'); toast.success('Organiser status updated'); loadWorkspace(); }}>{row.status === 'Active' ? 'Disable' : 'Activate'}</Button>
              <Button variant="outline" className="text-rose-500" onClick={() => deleteOrganiser(row)}>Delete</Button>
            </div></Td></Tr>)}
          </tbody></Table>
        </Card>
      )}
      {section === 'users' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <Table><thead><Tr><Th>User</Th><Th>Role</Th><Th>Status</Th><Th>Assigned Events</Th><Th>Last Login</Th><Th>Actions</Th></Tr></thead><tbody>
            {userRows.map((row) => <Tr key={row._id}><Td><div><p className="font-medium text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.email}</p></div></Td><Td>{row.role}</Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td><Td>{row.assignedEvents.map((event) => event.name).join(', ') || '-'}</Td><Td>{fmt(row.lastLogin)}</Td><Td><div className="flex gap-2"><Button variant="outline" onClick={() => openModal('user', 'edit', row)}>Edit</Button><Button variant="outline" onClick={async () => { await resendSuperAdminUserCredentials(row._id); toast.success('Login details email sent'); }}>Resend login</Button><Button variant="outline" onClick={async () => { await updateSuperAdminUserStatus(row._id, row.status === 'Active' ? 'Inactive' : 'Active'); toast.success('User status updated'); loadWorkspace(); }}>{row.status === 'Active' ? 'Disable' : 'Activate'}</Button><Button variant="outline" className="text-rose-500" onClick={() => deleteUser(row)}>Delete</Button></div></Td></Tr>)}
          </tbody></Table>
        </Card>
      )}
      {section === 'tickets' && (
        <div className="grid gap-5 xl:grid-cols-[1.2fr,1fr]">
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <Table><thead><Tr><Th>Ticket</Th><Th>Event</Th><Th>Attendee</Th><Th>Category</Th><Th>Status</Th></Tr></thead><tbody>
              {ticketRows.map((row) => <Tr key={row._id}><Td>{row.ticketNumber}</Td><Td>{row.event}</Td><Td><div><p>{row.attendee}</p><p className="text-xs text-slate-500">{row.attendeeEmail}</p></div></Td><Td>{row.categoryName}</Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td></Tr>)}
            </tbody></Table>
          </Card>
          <Card className="rounded-[28px] border-slate-200">
            <CardHeader title="Anomaly Detection" subtitle="Overbooking and assignment gaps" />
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Unassigned tickets</p><p className="mt-1 text-2xl font-semibold">{workspace?.tickets?.anomalySummary?.unassignedTickets || 0}</p></div>
              {(workspace?.tickets?.anomalySummary?.overbookedEvents || []).map((item) => <div key={item.event} className="rounded-2xl border border-slate-200 p-4"><p className="font-medium text-slate-900">{item.event}</p><p className="mt-1 text-sm text-slate-500">{item.categories.join(', ')}</p></div>)}
            </div>
          </Card>
        </div>
      )}
      {section === 'verification' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <MetricCard title="Pending" value={verification?.summary?.pending || 0} subtitle="Awaiting photo review" icon={ShieldCheckIcon} />
            <MetricCard title="Rejected" value={verification?.summary?.rejected || 0} subtitle="Need resubmission" icon={ShieldCheckIcon} />
            <MetricCard title="Verified" value={verification?.summary?.verified || 0} subtitle="Ready for access" icon={ShieldCheckIcon} />
          </div>
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <Table><thead><Tr><Th>Attendee</Th><Th>Event</Th><Th>Status</Th><Th>Rejection</Th><Th>Verified By</Th><Th>Updated</Th></Tr></thead><tbody>
              {(verification?.rows || []).map((row) => <Tr key={row._id}><Td><div><p>{row.attendee}</p><p className="text-xs text-slate-500">{row.email}</p></div></Td><Td>{row.event}</Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td><Td>{row.rejectionReason || '-'}</Td><Td>{row.verifiedBy || '-'}</Td><Td>{fmt(row.updatedAt)}</Td></Tr>)}
            </tbody></Table>
          </Card>
        </div>
      )}
      {section === 'entry-logs' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <Table><thead><Tr><Th>Attendee</Th><Th>Event</Th><Th>Gate</Th><Th>Time</Th><Th>Status</Th><Th>Action</Th></Tr></thead><tbody>
            {entryRows.map((row) => <Tr key={row._id}><Td>{row.attendee}</Td><Td>{row.event}</Td><Td>{row.gate}</Td><Td>{fmt(row.time)}</Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td><Td>{row.action}</Td></Tr>)}
          </tbody></Table>
        </Card>
      )}
      {section === 'zone-activity' && (
        <div className="grid gap-6 xl:grid-cols-[1fr,1.1fr]">
          <Card className="rounded-[28px] border-slate-200">
            <CardHeader title="Zone Occupancy" subtitle="Live occupancy and movement totals" />
            <div className="space-y-3">{(zoneActivity?.occupancy || []).map((row) => <div key={`${row.event}-${row.zoneName}`} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><p className="font-medium text-slate-900">{row.zoneName}</p><p className="text-sm text-slate-500">{row.event}</p></div><p className="text-2xl font-semibold text-slate-900">{row.occupancy}</p></div><p className="mt-2 text-xs text-slate-500">Entries {row.entries} • Exits {row.exits} • Denied {row.denied}</p></div>)}</div>
          </Card>
          <Card className="rounded-[28px] border-slate-200" padding={false}>
            <Table><thead><Tr><Th>Attendee</Th><Th>Event</Th><Th>Zone</Th><Th>Action</Th><Th>Status</Th><Th>Time</Th></Tr></thead><tbody>
              {(zoneActivity?.movements || []).map((row) => <Tr key={row._id}><Td>{row.attendee}</Td><Td>{row.event}</Td><Td>{row.zoneName}</Td><Td>{row.action}</Td><Td><Badge variant={statusTone[row.status] || 'gray'}>{row.status}</Badge></Td><Td>{fmt(row.timestamp)}</Td></Tr>)}
            </tbody></Table>
          </Card>
        </div>
      )}
      {section === 'notifications' && (
        <Card className="rounded-[28px] border-slate-200" padding={false}>
          <Table><thead><Tr><Th>Recipient</Th><Th>Message</Th><Th>Type</Th><Th>Channel</Th><Th>Event</Th><Th>Created</Th><Th>Action</Th></Tr></thead><tbody>
            {notificationRows.map((row) => <Tr key={row._id}><Td><div><p>{row.user}</p><p className="text-xs text-slate-500">{row.email}</p></div></Td><Td><div><p className="font-medium text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.message}</p></div></Td><Td>{row.type}</Td><Td>{row.channel}</Td><Td>{row.eventName || '-'}</Td><Td>{fmt(row.createdAt)}</Td><Td><Button variant="outline" onClick={async () => { await resendSuperAdminNotification(row._id); toast.success('Notification marked for resend'); }}>Resend</Button></Td></Tr>)}
          </tbody></Table>
        </Card>
      )}
      {section === 'reports' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="rounded-[28px] border-slate-200"><CardHeader title="Revenue Reports" subtitle="Revenue and ticket sales by event" /><div className="space-y-3">{(reports?.revenue || []).map((row) => <div key={row._id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="font-medium text-slate-900">{row.eventName}</p><p className="text-sm font-semibold text-slate-700">{money(row.revenue, workspace?.settings?.currency)}</p></div><p className="mt-1 text-xs text-slate-500">{row.ticketsSold} tickets • {row.orders} orders</p></div>)}</div></Card>
          <Card className="rounded-[28px] border-slate-200"><CardHeader title="Attendance Reports" subtitle="Allowed vs denied entries per event" /><div className="space-y-3">{(reports?.attendance || []).map((row) => <div key={row._id} className="rounded-2xl border border-slate-200 p-4"><p className="font-medium text-slate-900">{row.eventName}</p><p className="mt-1 text-xs text-slate-500">Allowed {row.allowedEntries} • Denied {row.deniedEntries}</p></div>)}</div></Card>
          <Card className="rounded-[28px] border-slate-200"><CardHeader title="Organiser Analytics" subtitle="Top organisers by event throughput" /><div className="space-y-3">{(reports?.organisers || []).map((row) => <div key={row.organiser} className="rounded-2xl border border-slate-200 p-4"><p className="font-medium text-slate-900">{row.organiser}</p><p className="mt-1 text-xs text-slate-500">{row.events} events • {row.ticketsSold} tickets sold</p></div>)}</div></Card>
        </div>
      )}
      {section === 'settings' && (
        <AdminSettingsPanel />
      )}
    </>
  );
};

const EntityModal = ({ modal, closeModal, form, setForm, saving, saveEntity, organiserOptions }) => {
  if (!modal.type) return null;
  return (
    <Modal open onClose={closeModal} title={`${modal.mode === 'create' ? 'Create' : 'Edit'} ${modal.type}`} size="lg">
      <form className="space-y-4" onSubmit={saveEntity}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name"><Input value={form.name || ''} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></Field>
          {modal.type !== 'event' && (
            <Field label="Email Address">
              <Input value={form.email || ''} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </Field>
          )}
          {modal.type === 'event' ? (
            <>
              <Field label="Description">
                <textarea 
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  rows="3"
                  value={form.description || ''} 
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} 
                />
              </Field>
              <Field label="Event Type">
                <Select value={form.eventType || 'cricket'} onChange={(e) => setForm((prev) => ({ ...prev, eventType: e.target.value }))}>
                  <option value="cricket">Cricket Match</option>
                  <option value="concert">Concert</option>
                  <option value="conference">Conference</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Start date"><Input type="datetime-local" value={form.startDate || ''} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} /></Field>
              <Field label="End date"><Input type="datetime-local" value={form.endDate || ''} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} /></Field>
              <Field label="Venue"><Input value={form.venueName || ''} onChange={(e) => setForm((prev) => ({ ...prev, venueName: e.target.value }))} /></Field>
              <Field label="Status">
                <Select value={form.status || 'draft'} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Field>
              <Field label="Assigned organiser"><Select value={form.organiserId || ''} onChange={(e) => setForm((prev) => ({ ...prev, organiserId: e.target.value }))}><option value="">Unassigned</option>{organiserOptions.map((option) => <option key={option._id} value={option._id}>{option.name}</option>)}</Select></Field>
              
              <div className="col-span-2 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment & Currency</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Currency">
                    <Select value={form.currency || 'LKR'} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}>
                      <option value="LKR">LKR (Rs.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </Select>
                  </Field>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.paymentCard !== false} onChange={(e) => setForm(prev => ({ ...prev, paymentCard: e.target.checked }))} />
                      <span className="text-sm text-slate-700">Card Payment</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.paymentBank !== false} onChange={(e) => setForm(prev => ({ ...prev, paymentBank: e.target.checked }))} />
                      <span className="text-sm text-slate-700">Bank Transfer</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.paymentCash !== false} onChange={(e) => setForm(prev => ({ ...prev, paymentCash: e.target.checked }))} />
                      <span className="text-sm text-slate-700">Cash Payment</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="col-span-2 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Event Controls</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.requirePhotoVerification !== false} onChange={(e) => setForm(prev => ({ ...prev, requirePhotoVerification: e.target.checked }))} />
                    <span className="text-sm text-slate-700">Photo Verification</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.allowSelfConfirmation !== false} onChange={(e) => setForm(prev => ({ ...prev, allowSelfConfirmation: e.target.checked }))} />
                    <span className="text-sm text-slate-700">Self Confirmation</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.rfidEnabled !== false} onChange={(e) => setForm(prev => ({ ...prev, rfidEnabled: e.target.checked }))} />
                    <span className="text-sm text-slate-700">RFID Enabled</span>
                  </label>
                </div>
              </div>

              <div className="col-span-2 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Communication Channels</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 cursor-pointer opacity-60">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={true} disabled />
                    <span className="text-sm text-slate-700">Email (Required)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={form.communicationSms ?? false} onChange={(e) => setForm(prev => ({ ...prev, communicationSms: e.target.checked }))} />
                    <span className="text-sm text-slate-700">SMS Notifications</span>
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              <Field label="Phone"><Input value={form.phone || ''} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} required /></Field>
              <Field label="Password"><Input type="password" value={form.password || ''} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} /></Field>
              <Field label="Role"><Select value={form.role || ''} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}>{(modal.type === 'organiser' ? ['MainOrganiser', 'SubOrganiser'] : ['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Attendee']).map((role) => <option key={role} value={role}>{role}</option>)}</Select></Field>
            </>
          )}
        </div>
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={closeModal}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
      </form>
    </Modal>
  );
};

const AdminDashboard = () => {
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'overview';
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState({ type: '', mode: 'create', item: null });
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState({ events: [], users: [] });

  const updateQuery = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value); else next.delete(key);
    return next;
  });

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const response = await getSuperAdminWorkspace(Object.fromEntries(params.entries()));
      setWorkspace(response.data?.data || null);
    } catch {
      toast.error('Failed to load super admin workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadWorkspace(); }, [params.toString()]);

  useEffect(() => {
    const handleSearch = async (event) => {
      const q = String(event.detail || '').trim();
      if (!q) return setSearchResults({ events: [], users: [] });
      updateQuery('search', q);
      try {
        const response = await searchSuperAdmin(q);
        setSearchResults(response.data?.data || { events: [], users: [] });
      } catch {
        setSearchResults({ events: [], users: [] });
      }
    };
    window.addEventListener('entrynex:search', handleSearch);
    return () => window.removeEventListener('entrynex:search', handleSearch);
  }, []);

  const openModal = (type, mode = 'create', item = null) => {
    setModal({ type, mode, item });
    if (type === 'event') setForm({ 
      name: item?.name || '', 
      startDate: item?.date ? new Date(item.date).toISOString().slice(0, 16) : '', 
      endDate: item?.endDate ? new Date(item.endDate).toISOString().slice(0, 16) : '', 
      organiserId: item?.organiser?._id || '', 
      venueName: item?.venue || '', 
      status: item?.lifecycleStatus || 'draft', 
      description: item?.description || '',
      eventType: item?.eventType || 'cricket',
      requirePhotoVerification: item?.settings?.requirePhotoVerification ?? true,
      allowSelfConfirmation: item?.settings?.allowSelfConfirmation ?? true,
      rfidEnabled: item?.settings?.rfidEnabled ?? true,
      currency: item?.settings?.currency || 'LKR',
      paymentCard: item?.settings?.paymentMethods?.card ?? true,
      paymentBank: item?.settings?.paymentMethods?.bank_transfer ?? true,
      paymentCash: item?.settings?.paymentMethods?.cash ?? true,
      communicationEmail: item?.settings?.communicationChannels?.email ?? true,
      communicationSms: item?.settings?.communicationChannels?.sms ?? false
    });
    if (type === 'organiser' || type === 'user') setForm({ name: item?.name || '', email: item?.email || '', phone: item?.phone || '', password: '', role: item?.role || (type === 'organiser' ? 'MainOrganiser' : 'Staff'), status: item?.status || 'Active' });
  };
  const closeModal = () => { setModal({ type: '', mode: 'create', item: null }); setForm({}); };

  const saveEntity = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (modal.type === 'event' && modal.mode === 'create') await createSuperAdminEvent(form);
      if (modal.type === 'event' && modal.mode === 'edit') await updateSuperAdminEvent(modal.item._id, form);
      if (modal.type === 'organiser' && modal.mode === 'create') await createSuperAdminOrganiser(form);
      if (modal.type === 'organiser' && modal.mode === 'edit') await updateSuperAdminOrganiser(modal.item._id, form);
      if (modal.type === 'user' && modal.mode === 'create') await createSuperAdminUser(form);
      if (modal.type === 'user' && modal.mode === 'edit') await updateSuperAdminUser(modal.item._id, form);
      toast.success(`${modal.type} ${modal.mode === 'create' ? 'created' : 'updated'}`);
      closeModal();
      loadWorkspace();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${modal.mode} ${modal.type}`);
    } finally {
      setSaving(false);
    }
  };

  const exportReport = async (type) => {
    try {
      const response = await exportSuperAdminReport({ type, ...Object.fromEntries(params.entries()) });
      downloadBlob(response.data, `${type}.csv`);
      toast.success('Report exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const searchSummary = useMemo(() => {
    if (!params.get('search')) return null;
    return [...(searchResults.events || []).slice(0, 3), ...(searchResults.users || []).slice(0, 3)];
  }, [params, searchResults]);

  if (loading && !workspace) return <DashboardLayout><LoadingSkeleton /></DashboardLayout>;

  const handleDeleteOrganiser = async (row) => {
    if (!window.confirm(`Delete organiser ${row.name}?`)) return;
    try {
      await deleteSuperAdminOrganiser(row._id);
      toast.success('Organiser deleted');
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete organiser');
    }
  };

  const handleDeleteUser = async (row) => {
    if (!window.confirm(`Delete user ${row.name}?`)) return;
    try {
      await deleteSuperAdminUser(row._id);
      toast.success('User deleted');
      loadWorkspace();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Super Admin</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{SECTION_LABELS[section]}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">Platform-level control across events, organisers, users, verification, access activity, and system configuration.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {section === 'events' && <Button onClick={() => openModal('event')}>Create event</Button>}
              {section === 'organisations' && <Button onClick={() => openModal('organiser')}>Create organiser</Button>}
              {section === 'users' && <Button onClick={() => openModal('user')}>Create user</Button>}
              {section === 'reports' && <><Button onClick={() => exportReport('revenue')}>Revenue CSV</Button><Button variant="outline" onClick={() => exportReport('attendance')}>Attendance CSV</Button></>}
            </div>
          </div>
          {searchSummary?.length > 0 && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Global search matches</p><div className="mt-3 flex flex-wrap gap-2">{searchSummary.map((item) => <span key={`${item._id}-${item.email || item.slug || ''}`} className="rounded-full bg-white px-3 py-1 text-sm text-slate-600 ring-1 ring-slate-200">{item.name} {item.email ? `• ${item.email}` : ''}</span>)}</div></div>}
        </Card>

        <SectionContent
          section={section}
          workspace={workspace}
          params={params}
          updateQuery={updateQuery}
          openModal={openModal}
          loadWorkspace={loadWorkspace}
          exportReport={exportReport}
          deleteOrganiser={handleDeleteOrganiser}
          deleteUser={handleDeleteUser}
        />

        <EntityModal modal={modal} closeModal={closeModal} form={form} setForm={setForm} saving={saving} saveEntity={saveEntity} organiserOptions={workspace?.events?.filters?.organiserOptions || []} />
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
