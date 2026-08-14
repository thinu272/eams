import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  getSubDashboard,
  createSubTicket,
  updateSubTicket,
  deleteSubTicket,
  regenerateTicketCode,
} from '../../api/sub';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { listSubOrganisers } from '../../api/organiser';
import PermissionGuard from '../../components/auth/PermissionGuard';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  UsersIcon,
  CheckBadgeIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  BanknotesIcon,
  UserPlusIcon,
  PhotoIcon,
  EnvelopeIcon,
  ArrowUpTrayIcon,
  QrCodeIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

/* ───────────────────── Helpers ───────────────────── */

const MetricCard = ({ title, value, subtitle, icon: Icon }) => (
  <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">{value}</p>
        {subtitle && <p className="mt-1.5 text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  </Card>
);

const CapabilityCard = ({
  permission,
  title,
  description,
  linkTo,
  linkLabel,
  icon: Icon,
  tone = 'blue',
  enabledTitle,
  enabledDesc,
}) => {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <PermissionGuard permission={permission} fallback={null}>
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">{enabledTitle}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{enabledDesc}</p>
            </div>
            <div className="mt-3 flex justify-end">
              <Link to={linkTo}>
                <Button variant="outline" size="sm" className="border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50">
                  {linkLabel}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </PermissionGuard>
  );
};

const formatTime = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const emptyCategory = {
  name: '',
  description: '',
  price: 0,
  capacity: 0,
  allowedZones: [],
  isPrivate: true,
  maxUsage: null,
  assignedSubOrganisers: [],
};

const getCurrency = (payload) =>
  payload?.event?.settings?.currency ||
  payload?.event?.currency ||
  payload?.settings?.currency ||
  payload?.currency ||
  localStorage.getItem('lastEventCurrency') ||
  'LKR';

/* ───────────────────── Main Component ───────────────────── */

const SubOrgDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );
  const [categoryModal, setCategoryModal] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const { user } = useAuth();
  const { permissions } = usePermissions();

  const load = (eventId) => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getSubDashboard({ eventId }),
      listSubOrganisers({ eventId }).catch(() => ({
        data: { data: { users: [] } },
      })),
    ])
      .then(([subRes, teamRes]) => {
        const dashboardData = subRes.data?.data || null;
        setData(dashboardData);
        setTeamMembers(teamRes.data?.data?.users || []);
        setLoadError('');
        const dashboardCurrency = getCurrency(dashboardData);
        if (dashboardCurrency) {
          localStorage.setItem('lastEventCurrency', dashboardCurrency);
        }

        if (
          dashboardData?.event?._id &&
          String(dashboardData.event._id) !== String(eventId)
        ) {
          setCurrentEventId(String(dashboardData.event._id));
          localStorage.setItem(
            'lastSelectedEventId',
            String(dashboardData.event._id)
          );
        }
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 404 || status === 403) {
          localStorage.removeItem('lastSelectedEventId');
          setCurrentEventId('');
        }
        const message =
          error.response?.data?.message ||
          'Unable to load sub-organiser workspace.';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      load(newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => {
      window.removeEventListener('entrynex:event-select', handleEventSelect);
    };
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    if (!currentEventId) {
      setLoading(false);
      return;
    }
    load(currentEventId);

    const interval = setInterval(() => {
      load(currentEventId);
    }, 15000);

    return () => clearInterval(interval);
  }, [currentEventId]);

  const saveCategory = async () => {
    if (!categoryModal?.name?.trim()) {
      return toast.error('Category name is required');
    }
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

  const confirmDeleteCategory = async () => {
    if (!deleteConfirm?.id) return;
    try {
      await deleteSubTicket(deleteConfirm.id, { eventId: currentEventId });
      toast.success('Category deleted');
      setDeleteConfirm(null);
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

  const currency = getCurrency(data);
  const zones = data?.zones || [];
  const categories = data?.categories || [];
  const activity = data?.activity || [];
  const currentUserId = String(user?._id || '');

  const getEventStatus = () => {
    const event = data?.event;
    if (!event) return 'Unknown';
    const status = event.status || event.eventStatus || event.state || event.publishedStatus;
    if (!status) {
      if (event.isPublished === true || event.published === true) return 'Published';
      if (event.isPublished === false || event.published === false) return 'Draft';
    }
    return status || 'Published';
  };

  const eventStatus = getEventStatus();

  const isPublished = () => {
    const status = eventStatus.toLowerCase();
    return ['published', 'ongoing', 'live', 'active'].includes(status);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 animate-pulse" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Sub-Organiser Workspace
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-medium text-slate-500">
                    Scoped
                  </span>
                </div>
                <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
                  {data?.event?.name || 'Assigned Event'}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isPublished()
                          ? 'bg-emerald-500'
                          : eventStatus.toLowerCase() === 'draft'
                          ? 'bg-amber-400'
                          : 'bg-slate-400'
                      }`}
                    />
                    {eventStatus}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate max-w-[180px]">
                      {data?.event?.venue?.name || 'Venue TBD'}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 min-w-[100px] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Zones</p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900">{loading ? '—' : zones.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 min-w-[100px] text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Categories</p>
                  <p className="mt-0.5 text-xl font-bold text-slate-900">{loading ? '—' : categories.length}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* KPI cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Attendees in Scope"
            value={loading ? '—' : data?.metrics?.totalAttendees ?? 0}
            subtitle="Assigned to your zones"
            icon={UsersIcon}
          />
          <MetricCard
            title="Checked-In"
            value={loading ? '—' : data?.metrics?.checkedInCount ?? 0}
            subtitle={
              data?.metrics?.totalAttendees
                ? `${Math.min(
                    100,
                    Math.round(
                      ((data?.metrics?.checkedInCount || 0) / (data?.metrics?.totalAttendees || 1)) * 100
                    )
                  )}% of scoped attendees`
                : 'No attendees yet'
            }
            icon={CheckBadgeIcon}
          />
          <MetricCard
            title="Pending Verification"
            value={loading ? '—' : data?.metrics?.pendingVerifications ?? 0}
            subtitle="Photo reviews waiting"
            icon={ClockIcon}
          />
          <MetricCard
            title="Assigned Zones"
            value={loading ? '—' : data?.metrics?.zoneCount ?? zones.length}
            subtitle="Your operational scope"
            icon={MapPinIcon}
          />
        </section>

        {/* Quick control cards */}
        <section className="grid gap-4 xl:grid-cols-3">
          {[
            {
              title: 'Zone Control',
              sub: 'Areas & movement',
              count1: zones.length || 0,
              label1: 'Zones',
              count2: data?.metrics?.checkedInCount || 0,
              label2: 'Checked-in',
              to: '/suborg/zones',
            },
            {
              title: 'Ticket Control',
              sub: 'Categories & sales',
              count1: categories.length || 0,
              label1: 'Categories',
              count2: categories.reduce((s, c) => s + (c.sold || 0), 0),
              label2: 'Sold',
              to: null,
            },
            {
              title: 'Activity',
              sub: 'Recent operations',
              count1: activity.length || 0,
              label1: 'Actions',
              count2: data?.metrics?.pendingVerifications || 0,
              label2: 'Pending',
              to: '/suborg/logs',
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50/80 border border-blue-100/70 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600/80">{item.label1}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '—' : item.count1}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label2}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? '—' : item.count2}</p>
                </div>
              </div>
              {item.to && (
                <div className="mt-4 flex justify-end">
                  <Link to={item.to}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
                    >
                      Open
                    </Button>
                  </Link>
                </div>
              )}
            </Card>
          ))}
        </section>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          {/* ──────────── Left column ──────────── */}
          <div className="space-y-5">
            <PermissionGuard permission="canViewZones" fallback={null}>
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <MapPinIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Assigned zones</h2>
                      <p className="text-sm text-slate-500">Capacity and operational visibility for your scope</p>
                    </div>
                  </div>
                  <Link to="/suborg/zones" className="text-sm font-semibold text-blue-600 hover:text-blue-700 shrink-0">
                    Open zones
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {zones.map((zone) => (
                    <div
                      key={zone.id || zone.name}
                      className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:border-sky-200 hover:bg-sky-50/40"
                    >
                      {zone.color && (
                        <div
                          className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
                          style={{ backgroundColor: zone.color }}
                        />
                      )}
                      <div className={zone.color ? 'pl-2' : ''}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 truncate">{zone.name}</h3>
                          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                            Cap {zone.capacity || 0}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                          {zone.description || 'Use entry and zone scans here only.'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!loading && zones.length === 0 && (
                    <div className="sm:col-span-2 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                        <MapPinIcon className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No zones assigned yet</p>
                      <p className="mt-1 text-xs text-slate-500 max-w-xs">
                        Ask the main organiser to assign at least one zone to your account.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </PermissionGuard>

            <CapabilityCard
              permission="canCollectCash"
              title="Cash Payments"
              description="Manage cash at entrance and confirm payments"
              linkTo="/suborg/cash-payments"
              linkLabel="Manage payments"
              icon={BanknotesIcon}
              tone="emerald"
              enabledTitle="Cash collection enabled"
              enabledDesc="You can view and confirm cash payments at the venue"
            />

            <CapabilityCard
              permission="canAddAttendees"
              title="Add Attendees"
              description="Register guests directly to the event"
              linkTo="/suborg/attendees"
              linkLabel="Manage attendees"
              icon={UserPlusIcon}
              tone="blue"
              enabledTitle="Attendee registration enabled"
              enabledDesc="You can add new attendees directly to the event"
            />

            <CapabilityCard
              permission="canVerifyPhotos"
              title="Photo Verification"
              description="Approve attendee photo uploads"
              linkTo="/suborg/verification"
              linkLabel="View queue"
              icon={PhotoIcon}
              tone="purple"
              enabledTitle="Photo verification enabled"
              enabledDesc="You can approve attendee photo uploads"
            />

            <CapabilityCard
              permission="canInviteAttendees"
              title="Send Invitations"
              description="Resend confirmation emails to attendees"
              linkTo="/suborg/invites"
              linkLabel="Manage invitations"
              icon={EnvelopeIcon}
              tone="cyan"
              enabledTitle="Invitation management enabled"
              enabledDesc="You can resend confirmation emails"
            />

            <CapabilityCard
              permission="canBulkUpload"
              title="Excel Bulk Imports"
              description="Upload spreadsheets for bulk registration"
              linkTo="/suborg/upload"
              linkLabel="Manage bulk upload"
              icon={ArrowUpTrayIcon}
              tone="amber"
              enabledTitle="Bulk import enabled"
              enabledDesc="You can upload Excel files for bulk registration"
            />

            <CapabilityCard
              permission="canGateScanAccess"
              title="Gate Scan Access"
              description="Scan check-ins at entry points"
              linkTo="/suborg/scan"
              linkLabel="Go to scanner"
              icon={QrCodeIcon}
              tone="rose"
              enabledTitle="Gate scan access enabled"
              enabledDesc="You can scan tickets at entry points"
            />
          </div>

          {/* ──────────── Right column ──────────── */}
          <div className="space-y-5">
            <PermissionGuard permission="canViewTickets" fallback={null}>
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <TicketIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Ticket Management</h2>
                      <p className="text-sm text-slate-500">Categories delegated to you or created by you</p>
                    </div>
                  </div>
                  <PermissionGuard permission="canEditTickets">
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-500 shrink-0"
                      onClick={() =>
                        setCategoryModal({
                          ...emptyCategory,
                          id: '',
                          allowedZones: zones.map((z) => z.id || z.name),
                        })
                      }
                    >
                      + Add Ticket
                    </Button>
                  </PermissionGuard>
                </div>

                <div className="mt-5 space-y-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:border-indigo-100 hover:bg-indigo-50/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-900 truncate">{cat.name}</h3>
                            {cat.isPrivate && <Badge color="indigo">Private</Badge>}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {cat.description || 'No description provided.'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-medium text-slate-500">
                            <span>
                              {cat.currency || currency} {Number(cat.price || 0).toLocaleString()}
                            </span>
                            <span>
                              Sold: {cat.sold || 0} / {cat.capacity || 0}
                            </span>
                            {cat.accessCode && (
                              <span className="font-mono text-indigo-600">Code: {cat.accessCode}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          {String(cat.createdBy || '') === currentUserId ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => setCategoryModal(cat)}>
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-rose-200 text-rose-700 hover:bg-rose-50"
                                onClick={() => setDeleteConfirm({ id: cat.id, label: cat.name })}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                              {cat.isPrivate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="Regenerate access code"
                                  onClick={() => handleRegenerateCode(cat.id)}
                                >
                                  <ArrowPathIcon className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!loading && categories.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-10 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <TicketIcon className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No ticket categories yet</p>
                      <p className="mt-1 text-xs text-slate-500 max-w-xs">
                        Create a private ticket category or wait for the organiser to assign one to you.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </PermissionGuard>

            {/* Recent Activity */}
            <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
                  <p className="text-sm text-slate-500">Latest actions in your scope</p>
                </div>
                <Link to="/suborg/logs" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                  View all
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {activity.slice(0, 8).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3"
                  >
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">
                        {item.message || item.action || 'Action performed'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{formatTime(item.createdAt || item.timestamp)}</p>
                    </div>
                  </div>
                ))}

                {!loading && activity.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-500">No recent activity</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ──────────── Category Modal ──────────── */}
      <Modal
        open={!!categoryModal}
        onClose={() => setCategoryModal(null)}
        title={categoryModal?.id ? 'Edit Ticket Category' : 'Create Ticket Category'}
      >
        {categoryModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name *</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={categoryModal.name}
                onChange={(e) => setCategoryModal({ ...categoryModal, name: e.target.value })}
                placeholder="e.g. VIP Guest, Staff, Press"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={categoryModal.description}
                onChange={(e) => setCategoryModal({ ...categoryModal, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Price ({currency})</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={categoryModal.price}
                  onChange={(e) => setCategoryModal({ ...categoryModal, price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Capacity</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={categoryModal.capacity}
                  onChange={(e) => setCategoryModal({ ...categoryModal, capacity: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isPrivate"
                type="checkbox"
                checked={!!categoryModal.isPrivate}
                onChange={(e) => setCategoryModal({ ...categoryModal, isPrivate: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isPrivate" className="text-sm text-slate-700">
                Private category (requires access code)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setCategoryModal(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={saveCategory} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500">
                {isSaving ? 'Saving…' : categoryModal.id ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ──────────── Delete Confirmation ──────────── */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Category"
      >
        {deleteConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete <strong>{deleteConfirm.label}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-500 text-white"
                onClick={confirmDeleteCategory}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgDashboard;