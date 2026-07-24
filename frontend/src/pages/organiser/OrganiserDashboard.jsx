

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getSocketUrl, getAssetUrl } from '../../utils/backend';
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
import { useAuth } from '../../context/AuthContext';
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
  getCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
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
  createSponsorPackage,
  updateSponsorPackage,
  deleteSponsorPackage,
  createSponsor,
  deleteSponsor,
} from '../../api/organiser';
import PaymentsDashboard from './PaymentsDashboard';
import { TicketIcon, FireIcon, BanknotesIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';

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
const emptyCategory = { 
  name: '', 
  description: '', 
  price: 0, 
  capacity: 0, 
  allowedZones: [], 
  benefits: [],
  isPrivate: false,
  maxUsage: null,
  assignedSubOrganisers: [],
  isVisible: true
};
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
  assignedZones: [],
};
const emptyZone = { name: '', description: '', capacity: 0, color: '#0F766E' };
const emptyCustomRole = {
  name: '',
  description: '',
  permissions: {
    canViewDashboard: false,
    canManageEvents: false,
    canManageTickets: false,
    canViewAttendees: false,
    canEditAttendees: false,
    canVerifyPhotos: false,
    canScanEntry: false,
    canManageZones: false,
    canInviteAttendees: false,
    canBulkUpload: false,
    canViewReports: false,
    canViewLogs: false,
    canManageSponsors: false,
    canViewTransactions: false,
    canManageSettings: false,
  },
  zoneIds: []
};

const emptySponsorPackage = {
  name: '',
  level: 'Custom',
  description: '',
  capacity: 1,
  price: 0,
  benefits: [],
  contactNumber: '',
  isVisible: true,
  expiryDate: '',
};

const emptySponsor = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  packageId: '',
  notes: '',
};

const COLORS = ['#0F766E', '#14B8A6', '#2DD4BF', '#99F6E4', '#CCFBF1'];
const getEventObjectId = (event) => event?._id || event?.id || '';

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

const clampPage = (value, pages = 1) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), Math.max(pages, 1));
};

const Pagination = ({ page = 1, pages = 1, total, pageKey = 'page', updateQuery }) => {
  if (!pages || pages <= 1) return null;

  const currentPage = clampPage(page, pages);
  const visiblePages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(pages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i += 1) visiblePages.push(i);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Page {currentPage} of {pages}{Number.isFinite(total) ? ` · ${total} rows` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => updateQuery(pageKey, currentPage - 1)}>
          Prev
        </Button>
        {visiblePages.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => updateQuery(pageKey, item)}
            className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${
              item === currentPage ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item}
          </button>
        ))}
        <Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => updateQuery(pageKey, currentPage + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
};

const OrganiserDashboard = () => {
  const { user } = useAuth();
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
  const [teamSearch, setTeamSearch] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState('');
  const [teamStatusFilter, setTeamStatusFilter] = useState('');
  const [zoneAssignments, setZoneAssignments] = useState({});
  const [settingsForm, setSettingsForm] = useState(null);
  const [customizationForm, setCustomizationForm] = useState(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [logoImageFile, setLogoImageFile] = useState(null);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  
  const [customRoles, setCustomRoles] = useState([]);
  const [customRoleModal, setCustomRoleModal] = useState(null);
  const [customRolesLoading, setCustomRolesLoading] = useState(false);
  const [activeTeamTab, setActiveTeamTab] = useState('members');
  const [sponsorPackageModal, setSponsorPackageModal] = useState(null);
  const [sponsorModal, setSponsorModal] = useState(null);

  const activeSection = params.get('section') || 'overview';

  const rememberSelectedEvent = (nextEventId) => {
    if (!nextEventId) {
      localStorage.removeItem('lastSelectedEventId');
      setEventId('');
      return '';
    }

    setEventId(nextEventId);
    localStorage.setItem('lastSelectedEventId', nextEventId);
    return nextEventId;
  };

  const getValidEventId = (preferredId) => {
    const eventIds = events.map(getEventObjectId).filter(Boolean);
    const candidate = preferredId && preferredId !== 'undefined' ? preferredId : '';
    const current = eventId && eventId !== 'undefined' ? eventId : '';
    const nextEventId = eventIds.includes(candidate)
      ? candidate
      : eventIds.includes(current)
        ? current
        : eventIds[0] || candidate || current;

    if (nextEventId && nextEventId !== eventId) {
      rememberSelectedEvent(nextEventId);
    }

    return nextEventId;
  };

  const loadCustomRoles = async (selectedEventId = eventId) => {
    if (!selectedEventId) return;
    setCustomRolesLoading(true);
    try {
      const res = await getCustomRoles({ eventId: selectedEventId });
      setCustomRoles(res.data?.data?.roles || []);
    } catch (err) {
      console.error('Failed to load custom roles:', err);
    } finally {
      setCustomRolesLoading(false);
    }
  };

  const loadWorkspace = async (selectedEventId = eventId) => {
    if (!selectedEventId) return;
    setLoading(true);
    loadCustomRoles(selectedEventId);
    try {
      const response = await getOrganiserWorkspace({
        eventId: selectedEventId,
        search: params.get('search') || undefined,
        status: params.get('status') || undefined,
        category: params.get('category') || undefined,
        page: params.get('page') || undefined,
        invitesPage: params.get('invitesPage') || undefined,
        entryLogsPage: params.get('entryLogsPage') || undefined,
        notificationsPage: params.get('notificationsPage') || undefined,
        zoneLogsPage: params.get('zoneLogsPage') || undefined,
        teamPage: params.get('teamPage') || undefined,
        verificationPage: params.get('verificationPage') || undefined,
        limit: params.get('limit') || undefined,
      });
      const nextData = response.data?.data || null;
      setWorkspace(nextData);
      const loadedEventId = getEventObjectId(nextData?.event);
      if (loadedEventId && loadedEventId !== selectedEventId) {
        rememberSelectedEvent(loadedEventId);
      }
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
          eventType: nextData?.event?.eventType || '',
          customEventType: nextData?.event?.customEventType || '',
          venue: {
            name: nextData?.event?.venue?.name || '',
            address: nextData?.event?.venue?.address || '',
            city: nextData?.event?.venue?.city || '',
            country: nextData?.event?.venue?.country || '',
            mapUrl: nextData?.event?.venue?.mapUrl || '',
          },
          currency: nextData?.settings?.currency || 'LKR',
        },
        matchDetails: nextData?.event?.matchDetails || { teamA: '', teamB: '', matchType: '', series: '' },
        concertDetails: nextData?.event?.concertDetails || { mainArtist: '', supportingBands: [], genre: '', tourName: '' },
        conferenceDetails: nextData?.event?.conferenceDetails || { theme: '', speakers: [], scheduleUrl: '' },
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
        communicationChannels: {
          email: nextData?.settings?.communicationChannels?.email ?? true,
          sms: nextData?.settings?.communicationChannels?.sms ?? false,
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
      if (error.response?.status === 404) {
        const fallbackEventId = events
          .map(getEventObjectId)
          .find((id) => id && id !== selectedEventId);
        if (fallbackEventId) {
          rememberSelectedEvent(fallbackEventId);
          return;
        }
        rememberSelectedEvent('');
      }
      toast.error(error.response?.data?.message || 'Failed to load organiser workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMyEvents().then((res) => {
      const list = res.data?.data?.events || [];
      setEvents(list);
      const storedEventId = localStorage.getItem('lastSelectedEventId') || eventId;
      const storedEventExists = list.some((event) => getEventObjectId(event) === storedEventId);
      const firstEventId = storedEventExists ? storedEventId : getEventObjectId(list[0]);
      if (firstEventId) {
        rememberSelectedEvent(firstEventId);
      } else {
        rememberSelectedEvent('');
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
      const nextEventId = event.detail ? String(event.detail) : '';
      if (!nextEventId || nextEventId === 'undefined') return;
      rememberSelectedEvent(nextEventId);
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
    const socket = io(getSocketUrl(), {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const joinDashboardRoom = () => {
      socket.emit('join_dashboard', { eventId });
    };

    socket.on('connect', joinDashboardRoom);
    socket.on('connect_error', (error) => {
      console.error('OrganiserDashboard socket connection error:', error);
    });

    joinDashboardRoom();

    const refresh = () => loadWorkspace(eventId);
    socket.on('entry_update', refresh);
    socket.on('zone_update', refresh);
    socket.on('payment_approved', refresh);
    socket.on('payment_rejected', refresh);
    socket.on('payment_info_request', refresh);
    socket.on('cash_payment_confirmed', refresh);
    socket.on('event_update', refresh);
    return () => socket.disconnect();
  }, [eventId]);

  const setQuery = (key, value) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (['search', 'status', 'category', 'limit'].includes(key)) {
        ['page', 'invitesPage', 'entryLogsPage', 'notificationsPage', 'zoneLogsPage', 'teamPage', 'verificationPage', 'ticketsPage', 'sponsorPackagesPage', 'sponsorsPage', 'customRolesPage', 'activityFeedPage'].forEach((pageKey) => next.delete(pageKey));
      }
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
  const sponsorPackages = selectedEvent?.sponsorPackages || [];
  const sponsors = workspace?.sponsors || [];
  const totalTicketsCount = Number(stats.totalTickets || 0);
  const ticketsSoldCount = Number(stats.ticketsSold || 0);
  const confirmedAttendeesCount = Number(stats.confirmedAttendees || 0);
  const checkedInCount = Number(stats.checkedInCount || 0);
  const clampPercent = (value) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const soldProgress = totalTicketsCount > 0 ? clampPercent((ticketsSoldCount / totalTicketsCount) * 100) : 0;
  const checkInProgressBase = confirmedAttendeesCount > 0 ? confirmedAttendeesCount : ticketsSoldCount;
  const checkInProgress = checkInProgressBase > 0 ? clampPercent((checkedInCount / checkInProgressBase) * 100) : 0;
  const pageSize = Math.min(Math.max(parseInt(params.get('limit') || '10', 10) || 10, 1), 50);
  const paginateLocal = (rows, pageKey) => {
    const pages = Math.ceil((rows?.length || 0) / pageSize) || 1;
    const page = clampPage(params.get(pageKey), pages);
    return {
      rows: (rows || []).slice((page - 1) * pageSize, page * pageSize),
      page,
      pages,
      total: rows?.length || 0,
      pageKey,
    };
  };
  const ticketPage = paginateLocal(categories, 'ticketsPage');
  const sponsorPackagePage = paginateLocal(sponsorPackages, 'sponsorPackagesPage');
  const sponsorPage = paginateLocal(sponsors, 'sponsorsPage');
  const customRolePage = paginateLocal(customRoles, 'customRolesPage');
  const activityFeedPage = paginateLocal(workspace?.activityFeed || [], 'activityFeedPage');
  const canViewPrivateTicketCode = (ticket) => {
    if (!ticket?.isPrivate) return false;
    if (user?.role === 'MainOrganiser') return true;
    const ticketCreatorId = String(ticket?.createdBy?._id || ticket?.createdBy || '');
    const currentUserId = String(user?._id || '');
    return !!ticketCreatorId && !!currentUserId && ticketCreatorId === currentUserId;
  };
  const getTicketCreatorLabel = (ticket) => {
    const creatorId = String(ticket?.createdBy?._id || ticket?.createdBy || '');
    if (!creatorId) return 'Unknown';
    if (creatorId === String(user?._id || '')) return `${user?.name || 'You'} (You)`;
    const teamMember = teamMembers.find((member) => String(member?._id || '') === creatorId);
    if (teamMember?.name) return teamMember.name;
    return 'Unknown';
  };

  const teamCounts = useMemo(() => {
    const counts = { SubOrganiser: 0, Staff: 0, Volunteer: 0, Auditor: 0, None: 0, total: teamMembers.length };
    teamMembers.forEach(m => {
      if (counts[m.role] !== undefined) {
        counts[m.role]++;
      }
    });
    return counts;
  }, [teamMembers]);

  const filteredTeamMembers = useMemo(() => {
    return teamMembers.filter((member) => {
      const searchStr = teamSearch.toLowerCase();
      const nameMatch = !teamSearch || 
        member.name?.toLowerCase().includes(searchStr) || 
        member.email?.toLowerCase().includes(searchStr) || 
        member.phone?.includes(teamSearch);
      const roleMatch = !teamRoleFilter || member.role === teamRoleFilter;
      const statusMatch = !teamStatusFilter || member.status === teamStatusFilter;
      return nameMatch && roleMatch && statusMatch;
    });
  }, [teamMembers, teamSearch, teamRoleFilter, teamStatusFilter]);

  const groupedTeamMembers = useMemo(() => {
    const groups = new Map();
    const directMembers = [];

    // Filtered sub-organisers
    filteredTeamMembers.forEach((member) => {
      if (member.role === 'SubOrganiser') {
        groups.set(String(member._id), { lead: member, members: [] });
      }
    });

    // Children and direct members
    filteredTeamMembers.forEach((member) => {
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
  }, [filteredTeamMembers]);
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
  const toggleAttendeeDisabled = async (attendee) => {
    await updateOrganiserAttendee(attendee._id, {
      eventId,
      isDisabled: !attendee.isDisabled,
    });
    toast.success(attendee.isDisabled ? 'Ticket enabled' : 'Ticket disabled');
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
    const zones = Array.from(new Set([
      ...(member.assignedZones || []),
      ...(member.responsibilities?.zoneIds || [])
    ]));
    setSubOrgForm({
      ...emptySubOrg,
      ...member,
      role: member.role || 'SubOrganiser',
      permissions: { ...emptySubOrg.permissions, ...(member.permissions || {}) },
      assignedZones: zones,
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

  const saveCustomRole = async () => {
    if (!eventId) {
      toast.error('Select an event first');
      return;
    }
    if (!customRoleModal.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      const payload = {
        ...customRoleModal,
        eventId,
      };
      if (customRoleModal._id) {
        await updateCustomRole(customRoleModal._id, payload);
        toast.success('Custom role updated successfully');
      } else {
        await createCustomRole(payload);
        toast.success('Custom role created successfully');
      }
      setCustomRoleModal(null);
      loadCustomRoles(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save custom role');
    }
  };

  const handleDeleteCustomRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this custom role?')) return;
    try {
      await deleteCustomRole(roleId, eventId);
      toast.success('Custom role deleted successfully');
      loadCustomRoles(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete custom role');
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
    const activeEventId = getValidEventId(getEventObjectId(workspace?.event));
    if (!activeEventId) {
      toast.error('Select an event before saving customization');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('eventId', activeEventId);
      formData.append('basicInfo', JSON.stringify(customizationForm.basicInfo));
      formData.append('branding', JSON.stringify(customizationForm.branding));
      formData.append('confirmationFlow', JSON.stringify(customizationForm.confirmationFlow));
      formData.append('communicationChannels', JSON.stringify(customizationForm.communicationChannels));
      formData.append('accessRules', JSON.stringify({
        whoCanEnter: customizationForm.accessRules.whoCanEnter.split(',').map((item) => item.trim()).filter(Boolean),
        entryWindowStart: customizationForm.accessRules.entryWindowStart,
        entryWindowEnd: customizationForm.accessRules.entryWindowEnd,
        restrictedZones: customizationForm.accessRules.restrictedZones.split(',').map((item) => item.trim()).filter(Boolean),
      }));
      formData.append('status', customizationForm.status);
      
      if (customizationForm.basicInfo.eventType === 'cricket') {
        formData.append('matchDetails', JSON.stringify(customizationForm.matchDetails));
      } else if (customizationForm.basicInfo.eventType === 'concert') {
        formData.append('concertDetails', JSON.stringify(customizationForm.concertDetails));
      } else if (customizationForm.basicInfo.eventType === 'conference') {
        formData.append('conferenceDetails', JSON.stringify(customizationForm.conferenceDetails));
      }

      if (coverImageFile) formData.append('coverImage', coverImageFile);
      if (logoImageFile) formData.append('logoImage', logoImageFile);
      if (bannerImageFile) formData.append('bannerImage', bannerImageFile);

      // Removal flags — only sent when no new file is chosen
      if (removeCover && !coverImageFile) formData.append('removeCoverImage', 'true');
      if (removeLogo && !logoImageFile) formData.append('removeLogoImage', 'true');
      if (removeBanner && !bannerImageFile) formData.append('removeBannerImage', 'true');

      await updateOrganiserEventCustomization(formData);
      toast.success('Event customization updated');
      setCoverImageFile(null);
      setLogoImageFile(null);
      setBannerImageFile(null);
      setRemoveCover(false);
      setRemoveLogo(false);
      setRemoveBanner(false);
      loadWorkspace(activeEventId);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update event customization');
    }
  };

  const saveSponsorPackage = async () => {
    if (!eventId) {
      toast.error('Select an event before saving sponsor package');
      return;
    }
    if (!sponsorPackageModal?.name?.trim()) {
      toast.error('Sponsor package name is required');
      return;
    }
    try {
      const payload = {
        ...sponsorPackageModal,
        eventId,
        capacity: Number(sponsorPackageModal.capacity || 1),
        price: Number(sponsorPackageModal.price || 0),
        benefits: (sponsorPackageModal.benefits || []).filter(Boolean),
      };
      if (sponsorPackageModal.id) {
        await updateSponsorPackage(sponsorPackageModal.id, payload, { eventId });
        toast.success('Sponsor package updated');
      } else {
        await createSponsorPackage(payload, { eventId });
        toast.success('Sponsor package created');
      }
      setSponsorPackageModal(null);
      loadWorkspace(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save sponsor package');
    }
  };

  const saveSponsor = async () => {
    if (!eventId) {
      toast.error('Select an event before creating sponsor');
      return;
    }
    if (!sponsorModal?.companyName?.trim() || !sponsorModal?.contactPerson?.trim() || !sponsorModal?.email?.trim() || !sponsorModal?.packageId) {
      toast.error('Company, contact person, email, and package are required');
      return;
    }
    try {
      const payload = {
        ...sponsorModal,
        eventId,
      };
      await createSponsor(payload, { eventId });
      toast.success('Sponsor created');
      setSponsorModal(null);
      loadWorkspace(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create sponsor');
    }
  };

  const removeSponsorPackage = async (packageId) => {
    if (!window.confirm('Delete this sponsor package?')) return;
    try {
      await deleteSponsorPackage(packageId, eventId);
      toast.success('Sponsor package deleted');
      loadWorkspace(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete sponsor package');
    }
  };

  const removeSponsor = async (id) => {
    if (!window.confirm('Delete this sponsor?')) return;
    try {
      await deleteSponsor(id, eventId);
      toast.success('Sponsor deleted');
      loadWorkspace(eventId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete sponsor');
    }
  };

  if (loading && !workspace) {
    return <DashboardLayout><LoadingSkeleton /></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-20">
        <section className="relative overflow-hidden rounded-[40px] bg-brand-dark p-8 lg:p-12 text-white shadow-2xl">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-brand-main/20 rounded-full blur-[120px]"></div>
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="animate-fade-in">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-main">Organiser Workspace</p>
              <h1 className="mt-4 text-4xl lg:text-6xl font-black tracking-tight leading-none">{selectedEvent?.name || 'Assigned Event'}</h1>
              <div className="mt-6 flex flex-wrap gap-4 text-sm font-medium">
                <span className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-sm">
                  <div className={`h-2 w-2 rounded-full ${selectedEvent?.status === 'published' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-400'}`}></div>
                  {selectedEvent?.status || 'draft'}
                </span>
                <span className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 backdrop-blur-sm">
                   {selectedEvent?.venue?.name || 'Venue'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:gap-6 animate-fade-in [animation-delay:200ms]">
               <div className="glass-dark border-white/5 px-6 py-5 rounded-3xl min-w-[160px]">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Team Strength</p>
                  <p className="mt-2 text-3xl font-black text-brand-main">{teamMembers.length || 0}</p>
                  <p className="mt-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">Active Members</p>
               </div>
               <div className="glass-dark border-white/5 px-6 py-5 rounded-3xl min-w-[160px]">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Structure</p>
                  <p className="mt-2 text-3xl font-black text-brand-main">{categories.length || 0}</p>
                  <p className="mt-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">Ticket Classes</p>
               </div>
            </div>
          </div>
        </section>

        {(activeSection === 'overview' || activeSection === '') && (
          <>
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Total Tickets', stats.totalTickets, TicketIcon],
                ['Tickets Sold', stats.ticketsSold, FireIcon],
                ['Total Revenue', `${selectedEvent?.settings?.currency || 'LKR'} ${Number(stats.totalRevenue || 0).toLocaleString()}`, BanknotesIcon],
                ['Checked-In', stats.checkedInCount, CheckBadgeIcon],
              ].map(([label, value, Icon], idx) => (
                <div key={label} className="card-premium animate-fade-in" style={{ animationDelay: `${(idx + 1) * 100}ms` }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{label}</p>
                    <Icon className="h-5 w-5 text-brand-main/50" />
                  </div>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{value || 0}</p>
                  <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-main rounded-full animate-shimmer" style={{ width: `${label === 'Total Tickets' ? (totalTicketsCount > 0 ? 100 : 0) : label === 'Tickets Sold' ? soldProgress : label === 'Checked-In' ? checkInProgress : soldProgress}%` }}></div>
                  </div>
                </div>
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
                    readOnly
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
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
                  <input
                    value={customizationForm.basicInfo.eventType || customizationForm.basicInfo.customEventType || 'Not set'}
                    readOnly
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
                  />
                </label>

                {customizationForm.basicInfo.eventType === 'cricket' && (
                  <div className="space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cricket Match Details</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span>Team A</span>
                        <input value={customizationForm.matchDetails.teamA} onChange={(e) => setCustomizationForm(prev => ({ ...prev, matchDetails: { ...prev.matchDetails, teamA: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Team B</span>
                        <input value={customizationForm.matchDetails.teamB} onChange={(e) => setCustomizationForm(prev => ({ ...prev, matchDetails: { ...prev.matchDetails, teamB: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Match Type</span>
                        <input value={customizationForm.matchDetails.matchType} onChange={(e) => setCustomizationForm(prev => ({ ...prev, matchDetails: { ...prev.matchDetails, matchType: e.target.value } }))} placeholder="T20, ODI" className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Series</span>
                        <input value={customizationForm.matchDetails.series} onChange={(e) => setCustomizationForm(prev => ({ ...prev, matchDetails: { ...prev.matchDetails, series: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                    </div>
                  </div>
                )}

                {customizationForm.basicInfo.eventType === 'concert' && (
                  <div className="space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Concert Details</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span>Main Artist</span>
                        <input value={customizationForm.concertDetails.mainArtist} onChange={(e) => setCustomizationForm(prev => ({ ...prev, concertDetails: { ...prev.concertDetails, mainArtist: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Supporting Bands (Comma separated)</span>
                        <input value={customizationForm.concertDetails.supportingBands?.join(', ')} onChange={(e) => setCustomizationForm(prev => ({ ...prev, concertDetails: { ...prev.concertDetails, supportingBands: e.target.value.split(',').map(s => s.trim()) } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Genre</span>
                        <input value={customizationForm.concertDetails.genre} onChange={(e) => setCustomizationForm(prev => ({ ...prev, concertDetails: { ...prev.concertDetails, genre: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Tour Name</span>
                        <input value={customizationForm.concertDetails.tourName} onChange={(e) => setCustomizationForm(prev => ({ ...prev, concertDetails: { ...prev.concertDetails, tourName: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                    </div>
                  </div>
                )}

                {customizationForm.basicInfo.eventType === 'conference' && (
                  <div className="space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-200">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Conference Details</p>
                    <div className="grid gap-4 sm:grid-cols-1">
                      <label className="space-y-1 text-sm">
                        <span>Theme</span>
                        <input value={customizationForm.conferenceDetails.theme} onChange={(e) => setCustomizationForm(prev => ({ ...prev, conferenceDetails: { ...prev.conferenceDetails, theme: e.target.value } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Speakers (Comma separated)</span>
                        <input value={customizationForm.conferenceDetails.speakers?.join(', ')} onChange={(e) => setCustomizationForm(prev => ({ ...prev, conferenceDetails: { ...prev.conferenceDetails, speakers: e.target.value.split(',').map(s => s.trim()) } }))} className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span>Schedule URL</span>
                        <input value={customizationForm.conferenceDetails.scheduleUrl} onChange={(e) => setCustomizationForm(prev => ({ ...prev, conferenceDetails: { ...prev.conferenceDetails, scheduleUrl: e.target.value } }))} placeholder="https://..." className="w-full rounded-xl border border-slate-200 px-4 py-2" />
                      </label>
                    </div>
                  </div>
                )}

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
                {/* ── Logo Image ── */}
                {(() => {
                  const logoSrc = logoImageFile
                    ? URL.createObjectURL(logoImageFile)
                    : (customizationForm.branding.logoImage && !removeLogo)
                      ? (customizationForm.branding.logoImage.startsWith('http') ? customizationForm.branding.logoImage : getAssetUrl(customizationForm.branding.logoImage))
                      : null;
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Event Logo</p>
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center">
                          {logoSrc ? (
                            <img src={logoSrc} alt="logo preview" className="h-full w-full object-contain" />
                          ) : (
                            <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                          <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-brand-main/10 px-4 py-2 text-xs font-bold text-brand-main hover:bg-brand-main/20 transition-colors w-fit">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            {logoSrc ? 'Change Image' : 'Upload Image'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] || null; setLogoImageFile(f); if (f) setRemoveLogo(false); }} />
                          </label>
                          {logoSrc && (
                            <button
                              type="button"
                              onClick={() => { setRemoveLogo(true); setLogoImageFile(null); }}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors w-fit"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Remove Logo
                            </button>
                          )}
                          {logoImageFile && <p className="text-[10px] text-slate-500 truncate max-w-[180px]">Selected: {logoImageFile.name}</p>}
                          {removeLogo && !logoImageFile && <p className="text-[10px] text-red-500 font-semibold">Logo will be removed on save</p>}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Cover Image ── */}
                {(() => {
                  const coverSrc = coverImageFile
                    ? URL.createObjectURL(coverImageFile)
                    : (customizationForm.branding.coverImage && !removeCover)
                      ? (customizationForm.branding.coverImage.startsWith('http') ? customizationForm.branding.coverImage : getAssetUrl(customizationForm.branding.coverImage))
                      : null;
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Cover Image <span className="normal-case font-normal text-slate-400">(Card View)</span></p>
                      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center">
                        {coverSrc ? (
                          <img src={coverSrc} alt="cover preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-300">
                            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-xs">No cover image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-brand-main/10 px-4 py-2 text-xs font-bold text-brand-main hover:bg-brand-main/20 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          {coverSrc ? 'Change Image' : 'Upload Image'}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] || null; setCoverImageFile(f); if (f) setRemoveCover(false); }} />
                        </label>
                        {coverSrc && (
                          <button
                            type="button"
                            onClick={() => { setRemoveCover(true); setCoverImageFile(null); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Remove Image
                          </button>
                        )}
                      </div>
                      {coverImageFile && <p className="text-[10px] text-slate-500 truncate">Selected: {coverImageFile.name}</p>}
                      {removeCover && !coverImageFile && <p className="text-[10px] text-red-500 font-semibold">Cover image will be removed on save</p>}
                    </div>
                  );
                })()}

                {/* ── Banner Image ── */}
                {(() => {
                  const bannerSrc = bannerImageFile
                    ? URL.createObjectURL(bannerImageFile)
                    : (customizationForm.branding.bannerImage && !removeBanner)
                      ? (customizationForm.branding.bannerImage.startsWith('http') ? customizationForm.branding.bannerImage : getAssetUrl(customizationForm.branding.bannerImage))
                      : null;
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Hero Banner Image</p>
                      <div className="relative h-40 w-full overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center">
                        {bannerSrc ? (
                          <img src={bannerSrc} alt="banner preview" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-300">
                            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className="text-xs">No banner image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-brand-main/10 px-4 py-2 text-xs font-bold text-brand-main hover:bg-brand-main/20 transition-colors">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          {bannerSrc ? 'Change Image' : 'Upload Image'}
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] || null; setBannerImageFile(f); if (f) setRemoveBanner(false); }} />
                        </label>
                        {bannerSrc && (
                          <button
                            type="button"
                            onClick={() => { setRemoveBanner(true); setBannerImageFile(null); }}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Remove Banner
                          </button>
                        )}
                      </div>
                      {bannerImageFile && <p className="text-[10px] text-slate-500 truncate">Selected: {bannerImageFile.name}</p>}
                      {removeBanner && !bannerImageFile && <p className="text-[10px] text-red-500 font-semibold">Banner image will be removed on save</p>}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-4">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-500">Venue name</span>
                  <input
                    value={customizationForm.basicInfo.venue.name}
                    readOnly
                    className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
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

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">Communication Channels</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-600">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!customizationForm.communicationChannels?.email}
                        onChange={(e) => setCustomizationForm((current) => ({ ...current, communicationChannels: { ...current.communicationChannels, email: e.target.checked } }))}
                      />
                      Email notifications
                    </label>
                    <div className="flex items-center gap-3 opacity-60">
                      <input
                        type="checkbox"
                        checked={!!customizationForm.communicationChannels?.sms}
                        disabled={true}
                        className="cursor-not-allowed"
                      />
                      <div className="flex flex-col">
                        <span>SMS notifications (Twilio)</span>
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Admin-only setting</span>
                      </div>
                    </div>
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
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <input value={search} onChange={(e) => { setSearch(e.target.value); setQuery('search', e.target.value); }} placeholder="Search by name, email, phone" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
              <select value={status} onChange={(e) => { setStatus(e.target.value); setQuery('status', e.target.value); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select>
              <select value={category} onChange={(e) => { setCategory(e.target.value); setQuery('category', e.target.value); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select>
              <select value={params.get('limit') || '10'} onChange={(e) => setQuery('limit', e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
              </select>
            </div>
            <Table>
              <thead><tr><Th>Name</Th><Th>Category</Th><Th>Status</Th><Th>Photo</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {attendees.map((attendee) => {
                  const isBulkUploadAttendee = attendee?.addedVia === 'bulk_upload';
                  return (
                  <Tr key={attendee._id}>
                    <Td><div><p className="font-semibold">{attendee.fullName}</p><p className="text-xs text-slate-500">{attendee.email || attendee.phone || '-'}</p></div></Td>
                    <Td>{attendee.categoryName || '-'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Badge color={statusColor[attendee.confirmationStatus] || 'gray'}>{attendee.confirmationStatus}</Badge>
                        {attendee.isDisabled && <Badge color="red">disabled</Badge>}
                      </div>
                    </Td>
                    <Td><Badge color={statusColor[attendee.photoVerificationStatus] || 'gray'}>{attendee.photoVerificationStatus}</Badge></Td>
                    <Td className="space-x-2">
                      <button className="text-blue-600" onClick={() => setAttendeeModal({ ...emptyAttendee, ...attendee })}>Edit</button>
                      <button className="text-amber-700" onClick={() => toggleAttendeeDisabled(attendee)}>
                        {attendee.isDisabled ? 'Enable' : 'Disable'}
                      </button>
                      {isBulkUploadAttendee && (
                        <button className="text-rose-600" onClick={() => removeAttendee(attendee._id)}>Delete</button>
                      )}
                      <button className="text-teal-700" onClick={() => inviteOrganiserAttendee(attendee._id, eventId).then(() => { toast.success('Invite resent'); loadWorkspace(); })}>Resend Invite</button>
                    </Td>
                  </Tr>
                )})}
              </tbody>
            </Table>
            <Pagination
              page={workspace?.attendees?.page}
              pages={workspace?.attendees?.pages}
              total={workspace?.attendees?.total}
              pageKey="page"
              updateQuery={setQuery}
            />
          </Card>
        )}

        {activeSection === 'tickets' && (
          <Card>
            <CardHeader title="Ticket Management" subtitle="Manage categories, capacity, pricing, and assignments" action={<Button onClick={() => setCategoryModal({ ...emptyCategory })}>Add Category</Button>} />
            <Table>
              <thead><tr><Th>Name</Th><Th>Price</Th><Th>Capacity</Th><Th>Sold</Th><Th>Assigned / Unassigned</Th><Th>Created By</Th><Th>Private Code</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {ticketPage.rows.map((ticket) => (
                  <Tr key={ticket.id}>
                    <Td>{ticket.name}</Td><Td>{selectedEvent?.settings?.currency || 'LKR'} {Number(ticket.price || 0).toLocaleString()}</Td><Td>{ticket.capacity}</Td><Td>{ticket.soldCount}</Td><Td>{ticket.assignedCount} / {ticket.unassignedCount}</Td>
                    <Td>{getTicketCreatorLabel(ticket)}</Td>
                    <Td>
                      {ticket.isPrivate
                        ? (canViewPrivateTicketCode(ticket) ? (ticket.accessCode || 'AUTO-GENERATED') : 'Hidden')
                        : '-'}
                    </Td>
                    <Td className="space-x-2"><button className="text-blue-600" onClick={() => setCategoryModal(ticket)}>Edit</button><button className="text-rose-600" onClick={() => deleteTicketCategory(ticket.id, eventId).then(() => { toast.success('Category deleted'); loadWorkspace(); })}>Delete</button></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...ticketPage} updateQuery={setQuery} />
          </Card>
        )}

        {activeSection === 'sponsor-packages' && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader
                title="Sponsor Packages"
                subtitle="Create and manage sponsor packages for this event"
                action={<Button onClick={() => setSponsorPackageModal({ ...emptySponsorPackage })}>Add Sponsor Package</Button>}
              />
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Level</Th>
                    <Th>Price</Th>
                    <Th>Capacity</Th>
                    <Th>Visible</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {sponsorPackages.length === 0 ? (
                    <Tr><Td colSpan={6} className="text-center text-slate-500">No sponsor packages configured yet.</Td></Tr>
                  ) : sponsorPackagePage.rows.map((pkg) => (
                    <Tr key={pkg.id}>
                      <Td>{pkg.name}</Td>
                      <Td>{pkg.level || 'Custom'}</Td>
                      <Td>{selectedEvent?.settings?.currency || 'LKR'} {Number(pkg.price || 0).toLocaleString()}</Td>
                      <Td>{pkg.capacity}</Td>
                      <Td>{pkg.isVisible ? 'Yes' : 'No'}</Td>
                      <Td className="space-x-2">
                        <button className="text-blue-600" onClick={() => setSponsorPackageModal(pkg)}>Edit</button>
                        <button className="text-rose-600" onClick={() => removeSponsorPackage(pkg.id)}>Delete</button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination {...sponsorPackagePage} updateQuery={setQuery} />
            </Card>
          </div>
        )}

        {activeSection === 'sponsors' && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader
                title="Manage Sponsors"
                subtitle="Onboard sponsors and assign sponsor packages"
                action={<Button onClick={() => setSponsorModal({ ...emptySponsor, packageId: sponsorPackages?.[0]?.id || '' })}>Add Sponsor</Button>}
              />
              <Table>
                <thead>
                  <tr>
                    <Th>Company</Th>
                    <Th>Contact</Th>
                    <Th>Email</Th>
                    <Th>Phone</Th>
                    <Th>Package</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.length === 0 ? (
                    <Tr><Td colSpan={6} className="text-center text-slate-500">No sponsors assigned yet.</Td></Tr>
                  ) : sponsorPage.rows.map((sponsor) => (
                    <Tr key={sponsor._id}>
                      <Td>{sponsor.companyName}</Td>
                      <Td>{sponsor.contactPerson}</Td>
                      <Td>{sponsor.email}</Td>
                      <Td>{sponsor.phone}</Td>
                      <Td>{sponsorPackages.find((pkg) => pkg.id === sponsor.packageId)?.name || sponsor.packageId}</Td>
                      <Td className="space-x-2"><button className="text-rose-600" onClick={() => removeSponsor(sponsor._id)}>Delete</button></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination {...sponsorPage} updateQuery={setQuery} />
            </Card>
          </div>
        )}

        {activeSection === 'suborganisers' && (
          <div className="space-y-6 animate-fade-in">
            {/* Team Overview Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { label: 'Total Strength', value: teamCounts.total, color: 'text-slate-900', bg: 'bg-slate-100/70 border-slate-200/60' },
                { label: 'Sub-Organisers', value: teamCounts.SubOrganiser, color: 'text-indigo-600', bg: 'bg-indigo-50/30 border-indigo-100' },
                { label: 'Staff', value: teamCounts.Staff, color: 'text-blue-600', bg: 'bg-blue-50/30 border-blue-100' },
                { label: 'Volunteers', value: teamCounts.Volunteer, color: 'text-cyan-600', bg: 'bg-cyan-50/30 border-cyan-100' },
                { label: 'Auditors', value: teamCounts.Auditor, color: 'text-teal-600', bg: 'bg-teal-50/30 border-teal-100' },
                { label: 'None (Custom)', value: teamCounts.None, color: 'text-slate-600', bg: 'bg-slate-50/30 border-slate-100' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                  <p className={`mt-2 text-3xl font-black ${color}`}>{value || 0}</p>
                </div>
              ))}
            </div>

            {/* Tabs for switching between Team Members and Custom Roles */}
            <div className="flex border-b border-slate-200 bg-white p-2 rounded-2xl shadow-sm gap-2">
              <button 
                onClick={() => setActiveTeamTab('members')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTeamTab === 'members' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Team Members
              </button>
              <button 
                onClick={() => setActiveTeamTab('roles')}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTeamTab === 'roles' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Custom Roles & Permissions
              </button>
            </div>

            {activeTeamTab === 'members' && (
              <>
                {/* Smart Role Guidance Card */}
                <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-white p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">ℹ</div>
                    <div>
                      <h4 className="font-bold text-slate-900">Understanding Team Roles & Scopes</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Scopes determine if a user can approve tickets, scan entries, or edit event zones.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                    <span className="px-2.5 py-1 rounded-full bg-white border border-slate-100"><strong className="text-indigo-600">Sub-Organiser:</strong> Full Admin Access</span>
                    <span className="px-2.5 py-1 rounded-full bg-white border border-slate-100"><strong className="text-blue-600">Staff:</strong> Operations & Verification</span>
                    <span className="px-2.5 py-1 rounded-full bg-white border border-slate-100"><strong className="text-cyan-600">Volunteer:</strong> Scanner Only</span>
                    <span className="px-2.5 py-1 rounded-full bg-white border border-slate-100"><strong className="text-teal-600">Auditor:</strong> Read-Only Audit logs</span>
                  </div>
                </div>

                {/* Filters and Search Bar */}
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Team Control Centre</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Audit roles, assign entry scopes, and delegate ticket categories</p>
                    </div>
                    <Button onClick={() => { setSubOrgForm(emptySubOrg); setSubOrgModal(true); }}>Create Team Member</Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <input 
                      value={teamSearch} 
                      onChange={(e) => setTeamSearch(e.target.value)} 
                      placeholder="Search by name, email, phone..." 
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                    />
                    <select 
                      value={teamRoleFilter} 
                      onChange={(e) => setTeamRoleFilter(e.target.value)} 
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white"
                    >
                      <option value="">All Roles</option>
                      <option value="SubOrganiser">Sub-Organisers</option>
                      <option value="Staff">Staff</option>
                      <option value="Volunteer">Volunteers</option>
                      <option value="Auditor">Auditors</option>
                      <option value="None">None (Custom Role)</option>
                    </select>
                    <select 
                      value={teamStatusFilter} 
                      onChange={(e) => setTeamStatusFilter(e.target.value)} 
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Main Render List */}
                {filteredTeamMembers.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
                    <p className="text-slate-500 font-medium">No team members match your active filters.</p>
                    {(teamSearch || teamRoleFilter || teamStatusFilter) && (
                      <button onClick={() => { setTeamSearch(''); setTeamRoleFilter(''); setTeamStatusFilter(''); }} className="mt-3 text-sm font-bold text-blue-600 hover:underline">Reset Filters</button>
                    )}
                  </div>
                ) : (teamSearch || teamRoleFilter || teamStatusFilter) ? (
                  // Search Results Unified List
                  <Card>
                    <CardHeader title="Search Results" subtitle={`Found ${filteredTeamMembers.length} matching team members`} />
                    <div className="overflow-hidden rounded-2xl border border-slate-100">
                      <Table>
                        <thead><tr><Th>Team Member</Th><Th>Role</Th><Th>Status</Th><Th>Scope</Th><Th>Actions</Th></tr></thead>
                        <tbody>
                          {filteredTeamMembers.map((user) => {
                            const ownerName = user.role !== 'SubOrganiser' && teamMembers.find(m => m._id === (user.createdBy?._id || user.createdBy))?.name;
                            return (
                              <Tr key={user._id}>
                                <Td>
                                  <div className="font-semibold text-slate-900">{user.name}</div>
                                  <div className="text-xs text-slate-500">{user.email} · {user.phone}</div>
                                  {ownerName && <div className="text-[10px] text-indigo-500 font-semibold mt-0.5">Lead: {ownerName}</div>}
                                </Td>
                                <Td><span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${user.role === 'SubOrganiser' ? 'bg-indigo-100 text-indigo-700' : user.role === 'Staff' ? 'bg-blue-100 text-blue-700' : user.role === 'Volunteer' ? 'bg-cyan-100 text-cyan-700' : user.role === 'None' ? 'bg-slate-100 text-slate-700' : 'bg-teal-100 text-teal-700'}`}>{user.customRole?.name || user.role}</span></Td>
                                <Td><Badge color={user.status === 'Active' ? 'green' : 'gray'}>{user.status}</Badge></Td>
                                <Td className="text-xs text-slate-600">{[...(user.assignedGates || []), ...(user.assignedZones || [])].join(', ') || 'General Scope'}</Td>
                                <Td>
                                  <div className="flex gap-2">
                                    <button className="text-xs font-semibold text-blue-600 hover:underline" onClick={() => handleEditTeamMember(user)}>Edit</button>
                                    <button className="text-xs font-semibold text-slate-600 hover:underline" onClick={() => updateSubOrganiser(user._id, { eventId, status: user.status === 'Active' ? 'Inactive' : 'Active' }).then(() => { toast.success('Status updated'); loadWorkspace(); })}>Toggle</button>
                                  </div>
                                </Td>
                              </Tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  </Card>
                ) : (
                  // Grouped Hierarchical View
                  <div className="space-y-6">
                    {groupedTeamMembers.groups.map(({ lead, members }) => (
                      <div key={lead._id} className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6 space-y-4 hover:shadow-md transition-all">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-500 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">Sub-Organiser Node</span>
                            <h3 className="mt-3 text-2xl font-black text-slate-900">{lead.name}</h3>
                            <p className="mt-1 text-sm text-slate-500">{lead.email} · {lead.phone}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge color={lead.status === 'Active' ? 'green' : 'gray'}>{lead.status}</Badge>
                              <Badge color="indigo">{members.length} Assigned Members</Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => handleEditTeamMember(lead)}>Edit Node</Button>
                            <Button variant="outline" onClick={() => updateSubOrganiser(lead._id, { eventId, status: lead.status === 'Active' ? 'Inactive' : 'Active' }).then(() => { toast.success('Status updated'); loadWorkspace(); })}>Toggle Status</Button>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <Table>
                            <thead><tr><Th>Team Member</Th><Th>Role</Th><Th>Scope</Th><Th>Zones / Gates</Th><Th>Actions</Th></tr></thead>
                            <tbody>
                              {members.map((user) => (
                                <Tr key={user._id}>
                                  <Td><div className="font-semibold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email} · {user.phone}</div></Td>
                                  <Td>
                                    <div className="flex flex-col gap-1 items-start">
                                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${user.role === 'Staff' ? 'bg-blue-100 text-blue-700' : user.role === 'Volunteer' ? 'bg-cyan-100 text-cyan-700' : user.role === 'None' ? 'bg-slate-100 text-slate-700' : 'bg-teal-100 text-teal-700'}`}>{user.customRole?.name || user.role}</span>
                                      <Badge color={user.status === 'Active' ? 'green' : 'gray'} size="xs">{user.status}</Badge>
                                    </div>
                                  </Td>
                                  <Td>
                                    <div className="flex flex-wrap gap-1">
                                      {(user.assignedGates || []).length > 0 && <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700">Entry</span>}
                                      {(user.assignedZones || []).length > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Zone</span>}
                                      {!(user.assignedGates || []).length && !(user.assignedZones || []).length && <span className="text-xs text-slate-400">General</span>}
                                    </div>
                                  </Td>
                                  <Td className="text-xs text-slate-600">{(() => { const gates = (user.assignedGates || []).length > 0 ? `Gates: ${(user.assignedGates || []).join(', ')}` : ''; const zones = (user.assignedZones || []).length > 0 ? `Zones: ${(user.assignedZones || []).join(', ')}` : 'No Zone Access Assigned'; return [gates, zones].filter(Boolean).join(' | '); })()}</Td>
                                  <Td>
                                    <div className="flex flex-col gap-1.5">
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
                      <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-4 hover:shadow-md transition-all">
                        <div>
                          <h3 className="text-xl font-black text-slate-900">Direct Event Team</h3>
                          <p className="mt-1 text-sm text-slate-500">Members assigned directly by the Main Organiser.</p>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <Table>
                            <thead><tr><Th>Team Member</Th><Th>Role</Th><Th>Status</Th><Th>Scope</Th><Th>Actions</Th></tr></thead>
                            <tbody>
                              {groupedTeamMembers.directMembers.map((user) => (
                                <Tr key={user._id}>
                                  <Td><div className="font-semibold text-slate-900">{user.name}</div><div className="text-xs text-slate-500">{user.email} · {user.phone}</div></Td>
                                  <Td>
                                    <div className="flex flex-col gap-1 items-start">
                                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${user.role === 'Staff' ? 'bg-blue-100 text-blue-700' : user.role === 'Volunteer' ? 'bg-cyan-100 text-cyan-700' : user.role === 'None' ? 'bg-slate-100 text-slate-700' : 'bg-teal-100 text-teal-700'}`}>{user.customRole?.name || user.role}</span>
                                      <Badge color={user.status === 'Active' ? 'green' : 'gray'} size="xs">{user.status}</Badge>
                                    </div>
                                  </Td>
                                  <Td>
                                    <div className="flex flex-wrap gap-1">
                                      {(user.assignedGates || []).length > 0 && <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700">Entry</span>}
                                      {(user.assignedZones || []).length > 0 && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Zone</span>}
                                      {!(user.assignedGates || []).length && !(user.assignedZones || []).length && <span className="text-xs text-slate-400">General</span>}
                                    </div>
                                  </Td>
                                  <Td className="text-xs text-slate-600">{(() => { const gates = (user.assignedGates || []).length > 0 ? `Gates: ${(user.assignedGates || []).join(', ')}` : ''; const zones = (user.assignedZones || []).length > 0 ? `Zones: ${(user.assignedZones || []).join(', ')}` : 'No Zone Access Assigned'; return [gates, zones].filter(Boolean).join(' | '); })()}</Td>
                                  <Td>
                                    <div className="flex flex-col gap-1.5">
                                      <button className="text-left text-xs font-semibold text-blue-600 hover:underline" onClick={() => handleEditTeamMember(user)}>Edit Access</button>
                                      <button className="text-left text-xs font-semibold text-slate-600 hover:underline" onClick={() => updateSubOrganiser(user._id, { eventId, status: user.status === 'Active' ? 'Inactive' : 'Active' }).then(() => { toast.success('Status updated'); loadWorkspace(); })}>Toggle Status</button>
                                    </div>
                                  </Td>
                                </Tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Pagination
                  page={workspace?.teamPage}
                  pages={workspace?.teamPages}
                  total={workspace?.teamTotal}
                  pageKey="teamPage"
                  updateQuery={setQuery}
                />
              </>
            )}

            {activeTeamTab === 'roles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Custom Role Registry</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Define granular access rules for your sub-organisers and staff</p>
                  </div>
                  <Button onClick={() => setCustomRoleModal({ ...emptyCustomRole })}>Create Custom Role</Button>
                </div>

                {customRolesLoading ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Loading custom roles...</div>
                ) : customRoles.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
                    <p className="text-slate-500 font-medium">No custom roles created for this event yet.</p>
                    <button onClick={() => setCustomRoleModal({ ...emptyCustomRole })} className="mt-3 text-sm font-bold text-blue-600 hover:underline">
                      Create one now
                    </button>
                  </div>
                ) : (
                  <Card>
                    <div className="overflow-hidden rounded-2xl border border-slate-100">
                      <Table>
                        <thead>
                          <tr>
                            <Th>Role Name</Th>
                            <Th>Description</Th>
                            <Th>Permissions Enabled</Th>
                            <Th>Zone Scope</Th>
                            <Th>Actions</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {customRolePage.rows.map((role) => {
                            const enabledPerms = Object.entries(role.permissions || {})
                              .filter(([_, enabled]) => !!enabled)
                              .map(([name]) => name.replace('can', ''));
                            return (
                              <Tr key={role._id}>
                                <Td>
                                  <div className="font-bold text-slate-900">{role.name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">slug: {role.slug}</div>
                                </Td>
                                <Td className="text-xs text-slate-600 max-w-xs truncate">{role.description || '-'}</Td>
                                <Td>
                                  <div className="flex flex-wrap gap-1 max-w-sm">
                                    {enabledPerms.length === 0 ? (
                                      <span className="text-[10px] text-slate-400">None</span>
                                    ) : (
                                      enabledPerms.map((p) => (
                                        <span key={p} className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded-full">
                                          {p}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </Td>
                                <Td className="text-xs text-slate-600">
                                  {(role.zoneIds || []).length === 0 
                                    ? 'Global' 
                                    : (role.zoneIds || []).map(zid => {
                                        const zoneObj = selectedEvent?.zones?.find(z => z.id === zid || z.name === zid);
                                        return zoneObj?.name || zid;
                                      }).join(', ')
                                  }
                                </Td>
                                <Td>
                                  <div className="flex gap-2.5">
                                    <button 
                                      className="text-xs font-semibold text-blue-600 hover:underline" 
                                      onClick={() => setCustomRoleModal({
                                        ...emptyCustomRole,
                                        ...role,
                                        permissions: { ...emptyCustomRole.permissions, ...(role.permissions || {}) },
                                        zoneIds: role.zoneIds || []
                                      })}
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      className="text-xs font-semibold text-rose-600 hover:underline" 
                                      onClick={() => handleDeleteCustomRole(role._id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </Td>
                              </Tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                    <Pagination {...customRolePage} updateQuery={setQuery} />
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'verification' && (
          <div>
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
            <Pagination
              page={workspace?.verificationPage}
              pages={workspace?.verificationPages}
              total={workspace?.verificationTotal}
              pageKey="verificationPage"
              updateQuery={setQuery}
            />
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
            <Pagination
              page={workspace?.invitesPage}
              pages={workspace?.invitesPages}
              pageKey="invitesPage"
              updateQuery={setQuery}
            />
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
            <Pagination
              page={workspace?.entryLogsPage}
              pages={workspace?.entryLogsPages}
              pageKey="entryLogsPage"
              updateQuery={setQuery}
            />
          </Card>
        )}

        {activeSection === 'system-logs' && (
          <Card>
            <CardHeader title="Activity Logs" subtitle="All recent operations and system events" />
            <Table>
              <thead><tr><Th>Event</Th><Th>Details</Th><Th>Time</Th></tr></thead>
              <tbody>
                {activityFeedPage.rows.map((item) => (
                  <Tr key={item.id}>
                    <Td>{item.title}</Td>
                    <Td>{item.message}</Td>
                    <Td>{new Date(item.timestamp).toLocaleString()}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...activityFeedPage} updateQuery={setQuery} />
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
              <Pagination
                page={workspace?.zoneLogsPage}
                pages={workspace?.zoneLogsPages}
                pageKey="zoneLogsPage"
                updateQuery={setQuery}
              />
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

        {activeSection === 'payments' && <PaymentsDashboard eventId={eventId} />}

        {activeSection === 'notifications' && (
          <Card>
            <CardHeader title="Notifications" subtitle="Email and SMS activity for organiser workflows" />
            <Table>
              <thead><tr><Th>Title</Th><Th>Message</Th><Th>Channel</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {notifications.map((item) => <Tr key={item._id}><Td>{item.title}</Td><Td>{item.message}</Td><Td>{item.metadata?.channel || 'email_sms'}</Td><Td><button className="text-blue-600" onClick={() => resendOrganiserNotification(item._id, eventId).then(() => toast.success('Notification re-queued'))}>Resend</button></Td></Tr>)}
              </tbody>
            </Table>
            <Pagination
              page={workspace?.notificationsPage}
              pages={workspace?.notificationsPages}
              pageKey="notificationsPage"
              updateQuery={setQuery}
            />
          </Card>
        )}

        {activeSection === 'settings' && settingsForm && (
          <Card>
            <CardHeader title="Event Settings" subtitle="Manage event details, templates, and organiser limits" action={<Button onClick={() => {
              const activeEventId = getValidEventId(getEventObjectId(selectedEvent));
              if (!activeEventId) {
                toast.error('Select an event before saving settings');
                return;
              }
              updateOrganiserSettings({ eventId: activeEventId, name: selectedEvent?.name, venue: selectedEvent?.venue, settings: settingsForm }).then(() => toast.success('Settings updated'));
            }}>Save</Button>} />
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

      <Modal open={!!categoryModal} onClose={() => setCategoryModal(null)} title={categoryModal?.id ? 'Edit Ticket Category' : 'Create New Ticket Category'} size="lg">
        {categoryModal && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 100-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Ticket Category Setup</h3>
                <p className="text-sm text-blue-700">Configure pricing, capacity, and access rules for this ticket type</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input 
                  value={categoryModal.name || ''} 
                  onChange={(e) => setCategoryModal((current) => ({ ...current, name: e.target.value }))} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="e.g. VIP Gold, General Admission"
                />
                <p className="text-xs text-slate-500 mt-1">Choose a clear, descriptive name for this ticket type</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Price ({selectedEvent?.settings?.currency || 'LKR'})
                </label>
                <input 
                  type="number" 
                  value={categoryModal.price || 0} 
                  onChange={(e) => setCategoryModal((current) => ({ ...current, price: Number(e.target.value) }))} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-slate-500 mt-1">Set to 0 for free tickets</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Capacity
                </label>
                <input 
                  type="number" 
                  value={categoryModal.capacity || 0} 
                  onChange={(e) => setCategoryModal((current) => ({ ...current, capacity: Number(e.target.value) }))} 
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                  placeholder="Unlimited"
                  min="0"
                />
                <p className="text-xs text-slate-500 mt-1">Leave empty for unlimited capacity</p>
              </div>
            </div>

            {/* Visibility Settings */}
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryModal.isVisible !== false}
                    onChange={(e) => setCategoryModal((current) => ({ ...current, isVisible: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-emerald-900">Visible to Public</span>
                    <span className="text-xs text-emerald-700 mt-1">Show this ticket category in the public event listing and allow purchases</span>
                  </div>
                </label>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!categoryModal.isPrivate}
                    onChange={(e) => setCategoryModal((current) => ({ ...current, isPrivate: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-indigo-900">Private Ticket</span>
                    <span className="text-xs text-indigo-700 mt-1">Requires a special access code to view and purchase this ticket</span>
                  </div>
                </label>

                {categoryModal.isPrivate && (
                  <div className="mt-4 rounded-lg bg-white p-4 ring-1 ring-indigo-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Access Code</span>
                      <span className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-mono font-bold text-white tracking-widest">
                        {canViewPrivateTicketCode(categoryModal)
                          ? (categoryModal.accessCode || 'AUTO-GENERATED')
                          : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Share this code with invited guests to allow access to this private ticket</p>
                  </div>
                )}
              </div>
            </div>

            {/* Management Delegation */}
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-sm font-semibold text-slate-700">Management Delegation</span>
              </div>
              <p className="text-xs text-slate-600 mb-4">Assign specific sub-organisers to manage attendees for this category</p>
              
              <div className="space-y-3">
                {teamMembers.filter(m => m.role === 'SubOrganiser').map((member) => (
                  <label key={member._id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(categoryModal.assignedSubOrganisers || []).includes(member._id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...new Set([...(categoryModal.assignedSubOrganisers || []), member._id])]
                          : (categoryModal.assignedSubOrganisers || []).filter(id => id !== member._id);
                        setCategoryModal(current => ({ ...current, assignedSubOrganisers: next }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700">{member.name}</span>
                      <span className="text-xs text-slate-500">{member.email}</span>
                    </div>
                  </label>
                ))}
                {teamMembers.filter(m => m.role === 'SubOrganiser').length === 0 && (
                  <p className="text-xs italic text-slate-400 py-3 text-center">No sub-organisers available. Add team members first.</p>
                )}
              </div>
            </div>

            <div className="border-t pt-6 flex gap-3">
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3"
                onClick={saveCategory}
              >
                {categoryModal.id ? 'Save Changes' : 'Create Ticket Category'}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 py-3"
                onClick={() => setCategoryModal(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={subOrgModal} onClose={() => setSubOrgModal(false)} title={subOrgForm._id ? 'Manage Team Member Access' : 'Create Team Member'} size="lg">
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 block">
              <span className="text-xs font-bold uppercase text-slate-500">Name</span>
              <input value={subOrgForm.name} onChange={(e) => setSubOrgForm((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Full name" />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-bold uppercase text-slate-500">Role</span>
                  <select 
                value={subOrgForm.role} 
                onChange={(e) => {
                  const role = e.target.value;
                  let permissions = { 
                    canAddAttendees: false, 
                    canVerifyPhotos: false, 
                    canInviteAttendees: false, 
                    canBulkUpload: false, 
                    canEntryAccess: false 
                  };
                  let assignedZones = subOrgForm.assignedZones || [];

                  if (role === 'SubOrganiser') {
                    permissions = {
                      canAddAttendees: true,
                      canVerifyPhotos: true,
                      canInviteAttendees: true,
                      canBulkUpload: true,
                      canEntryAccess: true
                    };
                    // full sub-organiser default
                    assignedZones = assignedZones || [];
                  } else if (role === 'Staff') {
                    permissions = {
                      canAddAttendees: true,
                      canVerifyPhotos: true,
                      canInviteAttendees: true,
                      canBulkUpload: false,
                      canEntryAccess: true
                    };
                    assignedZones = assignedZones || [];
                  } else if (role === 'Volunteer') {
                    permissions = {
                      canAddAttendees: false,
                      canVerifyPhotos: false,
                      canInviteAttendees: false,
                      canBulkUpload: false,
                      canEntryAccess: true
                    };
                    assignedZones = assignedZones || [];
                  } else if (role === 'Auditor') {
                    permissions = {
                      canAddAttendees: false,
                      canVerifyPhotos: false,
                      canInviteAttendees: false,
                      canBulkUpload: false,
                      canEntryAccess: false
                    };
                    assignedZones = assignedZones || [];
                  }

                  setSubOrgForm(curr => ({ ...curr, role, permissions, assignedZones }));
                }} 
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm bg-white"
              >
                <option value="SubOrganiser">Sub-Organiser</option>
                <option value="Staff">Staff</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Auditor">Auditor</option>
                <option value="None">None</option>
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
            {['SubOrganiser', 'Staff', 'None'].includes(subOrgForm.role) && (
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-xs font-bold uppercase text-slate-500">Custom Role Profile</span>
                <select
                  value={subOrgForm.customRole || ''}
                  onChange={(e) => {
                    const selectedRoleId = e.target.value || null;
                    if (!selectedRoleId) {
                      let permissions = {};
                      if (subOrgForm.role === 'SubOrganiser') {
                        permissions = {
                          canAddAttendees: true,
                          canVerifyPhotos: true,
                          canInviteAttendees: true,
                          canBulkUpload: true,
                          canEntryAccess: true
                        };
                      } else if (subOrgForm.role === 'Staff') {
                        permissions = {
                          canAddAttendees: true,
                          canVerifyPhotos: true,
                          canInviteAttendees: true,
                          canBulkUpload: false,
                          canEntryAccess: true
                        };
                      } else {
                        permissions = {
                          canAddAttendees: false,
                          canVerifyPhotos: false,
                          canInviteAttendees: false,
                          canBulkUpload: false,
                          canEntryAccess: false
                        };
                      }
                      setSubOrgForm(curr => ({ 
                        ...curr, 
                        customRole: null, 
                        permissions: { ...curr.permissions, ...permissions } 
                      }));
                    } else {
                      const matchedRole = customRoles.find(r => r._id === selectedRoleId);
                      if (matchedRole) {
                        setSubOrgForm(curr => ({ 
                          ...curr, 
                          customRole: selectedRoleId, 
                          permissions: { ...curr.permissions, ...(matchedRole.permissions || {}) },
                          assignedZones: matchedRole.zoneIds || curr.assignedZones || [] 
                        }));
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm bg-white"
                >
                  <option value="">Default Permissions (No Custom Role)</option>
                  {customRoles.map((role) => (
                    <option key={role._id} value={role._id}>{role.name}</option>
                  ))}
                </select>
              </label>
            )}
            {!subOrgForm._id && (
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-xs font-bold uppercase text-slate-500">Temporary Password</span>
                <input value={subOrgForm.password} onChange={(e) => setSubOrgForm((current) => ({ ...current, password: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Set initial password" />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold uppercase text-slate-500">Zone Access Scope</span>
            <p className="text-[11px] text-slate-500 mt-1 mb-3">Allow checking attendees in/out of specific zones</p>
            {(selectedEvent?.zones || []).length > 0 && (
              <div className="mb-3">
                {(() => {
                  const allZones = selectedEvent?.zones || [];
                  const allZoneIds = allZones.map(z => z.id || z.name);
                  const isAllChecked = allZoneIds.length > 0 && allZoneIds.every(zid => (subOrgForm.assignedZones || []).includes(zid));
                  return (
                    <label className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isAllChecked ? 'border-indigo-200 bg-indigo-50/20 font-semibold text-indigo-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                      <input
                        type="checkbox"
                        checked={isAllChecked}
                        onChange={(e) => {
                          const next = e.target.checked ? allZoneIds : [];
                          setSubOrgForm(curr => ({ ...curr, assignedZones: next }));
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      All Zones (Select / Deselect All)
                    </label>
                  );
                })()}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {(selectedEvent?.zones || []).map((zone) => {
                const zid = zone.id || zone.name;
                const isChecked = (subOrgForm.assignedZones || []).includes(zid);
                return (
                  <label key={zone.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isChecked ? 'border-blue-200 bg-blue-50/20 font-semibold text-blue-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const next = e.target.checked 
                          ? [...new Set([...(subOrgForm.assignedZones || []), zid])]
                          : (subOrgForm.assignedZones || []).filter(item => item !== zid);
                        setSubOrgForm(curr => ({ ...curr, assignedZones: next }));
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {zone.name}
                  </label>
                );
              })}
              {(selectedEvent?.zones || []).length === 0 && (
                <div className="sm:col-span-2 text-xs italic text-slate-400 text-center py-2">No custom zones configured yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <span className="text-xs font-bold uppercase text-slate-500 block">Permissions Scope</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { key: 'canAddAttendees', label: 'Add Attendees', desc: 'Register guests directly' },
                { key: 'canVerifyPhotos', label: 'Photo Verification', desc: 'Approve attendee photo uploads' },
                { key: 'canInviteAttendees', label: 'Send Invitations', desc: 'Resend confirmation emails' },
                { key: 'canBulkUpload', label: 'Excel Bulk Imports', desc: 'Upload large spreadsheets' },
                { key: 'canEntryAccess', label: 'Gate Scan Access', desc: 'Scan check-ins at entry' }
              ].map(({ key, label, desc }) => {
                const isChecked = !!subOrgForm.permissions?.[key];
                return (
                  <label key={key} className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-all cursor-pointer ${isChecked ? 'border-emerald-200 bg-emerald-50/20 shadow-sm' : 'border-slate-100 bg-slate-50/30 hover:border-slate-200'}`}>
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={(e) => setSubOrgForm((current) => ({ ...current, permissions: { ...current.permissions, [key]: e.target.checked } }))} 
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{label}</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">{desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <Button className="w-full py-3" onClick={saveTeamMemberAccess}>
              {subOrgForm._id ? 'Update Access' : 'Create Team Member'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!customRoleModal} onClose={() => setCustomRoleModal(null)} title={customRoleModal?._id ? 'Edit Custom Role' : 'Create Custom Role'} size="lg">
        {customRoleModal && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 block">
                <span className="text-xs font-bold uppercase text-slate-500">Role Name</span>
                <input 
                  value={customRoleModal.name || ''} 
                  onChange={(e) => setCustomRoleModal((current) => ({ ...current, name: e.target.value }))} 
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" 
                  placeholder="e.g. Operations Coordinator" 
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-bold uppercase text-slate-500">Description</span>
                <input 
                  value={customRoleModal.description || ''} 
                  onChange={(e) => setCustomRoleModal((current) => ({ ...current, description: e.target.value }))} 
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" 
                  placeholder="e.g. Manages sponsors and event settings" 
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <span className="text-xs font-bold uppercase text-slate-500">Zone Access Scope</span>
              <p className="text-[11px] text-slate-500 mt-1 mb-3">Limit this role's operations/scans to specific zones (Optional)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(selectedEvent?.zones || []).map((zone) => {
                  const zid = zone.id || zone.name;
                  const isChecked = (customRoleModal.zoneIds || []).includes(zid);
                  return (
                    <label key={zone.id} className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-all ${isChecked ? 'border-blue-200 bg-blue-50/20 font-semibold text-blue-900' : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const next = e.target.checked 
                            ? [...new Set([...(customRoleModal.zoneIds || []), zid])]
                            : (customRoleModal.zoneIds || []).filter(item => item !== zid);
                          setCustomRoleModal(curr => ({ ...curr, zoneIds: next }));
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {zone.name}
                    </label>
                  );
                })}
                {(selectedEvent?.zones || []).length === 0 && (
                  <div className="sm:col-span-2 text-xs italic text-slate-400 text-center py-2">No custom zones configured yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
              <span className="text-xs font-bold uppercase text-slate-500 block">Permissions Scope</span>
              
              {[
                {
                  category: 'Dashboard & Configuration',
                  items: [
                    { key: 'canViewDashboard', label: 'Access Dashboard', desc: 'Allows viewing dashboard and overall stats' },
                    { key: 'canManageSettings', label: 'Manage Settings', desc: 'Allows modifying event parameters and setup' },
                    { key: 'canViewLogs', label: 'Access Activity Logs', desc: 'Allows auditing organizer log history' }
                  ]
                },
                {
                  category: 'Operations',
                  items: [
                    { key: 'canManageEvents', label: 'Manage Event Details', desc: 'Allows updating venue, artist, and type information' },
                    { key: 'canManageZones', label: 'Manage Zones', desc: 'Allows creating and structuring zones' },
                    { key: 'canManageSponsors', label: 'Manage Sponsors', desc: 'Allows onboarding and allocating sponsor packages' }
                  ]
                },
                {
                  category: 'Attendee & Ticketing',
                  items: [
                    { key: 'canManageTickets', label: 'Manage Ticket Types', desc: 'Allows defining prices, capacities, and restrictions' },
                    { key: 'canViewAttendees', label: 'View Attendees', desc: 'Allows browsing registered attendees list' },
                    { key: 'canEditAttendees', label: 'Register/Edit Attendees', desc: 'Allows adding and modifying attendee registry' },
                    { key: 'canInviteAttendees', label: 'Resend Invitation Emails', desc: 'Allows sending notifications and tickets' },
                    { key: 'canBulkUpload', label: 'Excel Bulk Import', desc: 'Allows mass importing guests' }
                  ]
                },
                {
                  category: 'Access Control',
                  items: [
                    { key: 'canScanEntry', label: 'Scan Gate Entry', desc: 'Allows scanning gate QR codes' },
                    { key: 'canVerifyPhotos', label: 'Verify Photos', desc: 'Allows validating attendee photo uploads' }
                  ]
                },
                {
                  category: 'Finance & Reports',
                  items: [
                    { key: 'canViewReports', label: 'View Reports', desc: 'Allows downloading CSV/XLSX data sheets' },
                    { key: 'canViewTransactions', label: 'View Transactions', desc: 'Allows auditing orders and payouts' }
                  ]
                }
              ].map((cat) => (
                <div key={cat.category} className="space-y-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1">{cat.category}</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cat.items.map(({ key, label, desc }) => {
                      const isChecked = !!customRoleModal.permissions?.[key];
                      return (
                        <label key={key} className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer ${isChecked ? 'border-indigo-200 bg-indigo-50/10 shadow-sm' : 'border-slate-100 bg-slate-50/30 hover:border-slate-200'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => setCustomRoleModal((current) => ({ 
                              ...current, 
                              permissions: { ...current.permissions, [key]: e.target.checked } 
                            }))} 
                            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800">{label}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5 leading-normal">{desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button className="w-full py-3" onClick={saveCustomRole}>
                {customRoleModal._id ? 'Update Custom Role' : 'Create Custom Role'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!sponsorPackageModal} onClose={() => setSponsorPackageModal(null)} title={sponsorPackageModal?.id ? 'Edit Sponsor Package' : 'Create Sponsor Package'} size="lg">
        {sponsorPackageModal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-slate-500">Package Name</span>
                <input value={sponsorPackageModal.name || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Package name" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-500">Level</span>
                <select value={sponsorPackageModal.level || 'Custom'} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, level: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm bg-white">
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Custom">Custom</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm block">
                <span className="text-slate-500">Price</span>
                <input type="number" min="0" value={sponsorPackageModal.price || 0} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, price: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="0" />
              </label>
              <label className="space-y-2 text-sm block">
                <span className="text-slate-500">Capacity</span>
                <input type="number" min="1" value={sponsorPackageModal.capacity || 1} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, capacity: Number(e.target.value) }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="1" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Visible</span>
                <input type="checkbox" checked={!!sponsorPackageModal.isVisible} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, isVisible: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              </div>
              <label className="space-y-2 text-sm block">
                <span className="text-slate-500">Expiry Date</span>
                <input type="date" value={sponsorPackageModal.expiryDate || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, expiryDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" />
              </label>
            </div>
            <label className="space-y-2 text-sm block">
              <span className="text-slate-500">Contact Number</span>
              <input value={sponsorPackageModal.contactNumber || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, contactNumber: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Contact phone" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-slate-500">Benefits</span>
              <input value={(sponsorPackageModal.benefits || []).join(', ')} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, benefits: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Benefit1, Benefit2" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-slate-500">Description</span>
              <textarea value={sponsorPackageModal.description || ''} onChange={(e) => setSponsorPackageModal((current) => ({ ...current, description: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Description" rows={4} />
            </label>
            <Button onClick={saveSponsorPackage}>{sponsorPackageModal.id ? 'Save Changes' : 'Create Package'}</Button>
          </div>
        )}
      </Modal>

      <Modal open={!!sponsorModal} onClose={() => setSponsorModal(null)} title="Create Sponsor" size="lg">
        {sponsorModal && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-slate-500">Company Name</span>
                <input value={sponsorModal.companyName || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, companyName: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Company name" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-500">Contact Person</span>
                <input value={sponsorModal.contactPerson || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, contactPerson: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Full name" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-slate-500">Email</span>
                <input type="email" value={sponsorModal.email || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Email address" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-slate-500">Phone</span>
                <input value={sponsorModal.phone || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Phone number" />
              </label>
            </div>
            <label className="space-y-2 text-sm">
              <span className="text-slate-500">Sponsor Package</span>
              <select value={sponsorModal.packageId || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, packageId: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm bg-white">
                <option value="">Select package</option>
                {sponsorPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-slate-500">Notes</span>
              <textarea value={sponsorModal.notes || ''} onChange={(e) => setSponsorModal((current) => ({ ...current, notes: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm" placeholder="Notes" rows={4} />
            </label>
            <Button onClick={saveSponsor}>Create Sponsor</Button>
          </div>
        )}
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
