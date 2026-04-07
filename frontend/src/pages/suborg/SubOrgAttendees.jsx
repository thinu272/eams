import React, { useEffect, useMemo, useState } from 'react';
import { getMyEvents } from '../../api/events';
import {
  createAttendee,
  exportAttendees,
  getAttendee,
  getAttendees,
  inviteAttendee,
} from '../../api/attendees';
import { useAuth } from '../../context/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const phoneRegex = /^\+947\d{8}$/;
const pageSize = 10;

const confirmationColors = {
  confirmed: 'green',
  invited: 'blue',
  pending: 'yellow',
  rejected: 'red',
};

const photoColors = {
  verified: 'green',
  pending: 'yellow',
  rejected: 'red',
};

const buildAssetUrl = (photoPath) => {
  if (!photoPath) return '';
  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) return photoPath;
  const base = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
  return `${base}/${photoPath}`;
};

const defaultForm = {
  fullName: '',
  nationalId: '',
  phone: '',
  email: '',
  categoryId: '',
  notificationChannel: 'sms',
};

const SubOrgAttendees = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) {
        setSelectedEvent(myEvents[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedEvent, statusFilter, categoryFilter, search]);

  useEffect(() => {
    if (!selectedEvent) return;

    setLoading(true);
    getAttendees({
      eventId: selectedEvent,
      status: statusFilter || undefined,
      categoryId: categoryFilter || undefined,
      search: search || undefined,
      page,
      limit: pageSize,
    })
      .then((response) => {
        setAttendees(response.data?.data?.attendees || []);
        setTotal(response.data?.data?.total || 0);
        setPages(response.data?.data?.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent, statusFilter, categoryFilter, search, page]);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const canInvite = user?.permissions?.canInviteAttendees !== false;
  const canAdd = user?.permissions?.canAddAttendees !== false;

  const statusCounts = useMemo(() => {
    return attendees.reduce(
      (accumulator, attendee) => {
        accumulator[attendee.confirmationStatus] = (accumulator[attendee.confirmationStatus] || 0) + 1;
        return accumulator;
      },
      { confirmed: 0, invited: 0, pending: 0, rejected: 0 }
    );
  }, [attendees]);

  const resetForm = () => setForm(defaultForm);

  const loadAttendeeDetails = async (id) => {
    try {
      const response = await getAttendee(id);
      setSelectedAttendee(response.data?.data?.attendee || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load attendee details');
    }
  };

  const handleAddAttendee = async (event) => {
    event.preventDefault();

    if (!selectedEvent) {
      toast.error('Select an event first');
      return;
    }
    if (!form.categoryId) {
      toast.error('Select a ticket category');
      return;
    }
    if ((form.notificationChannel === 'sms' || form.notificationChannel === 'both') && !phoneRegex.test(form.phone.trim())) {
      toast.error('Use Sri Lanka phone format: +947XXXXXXXX');
      return;
    }
    if ((form.notificationChannel === 'email' || form.notificationChannel === 'both') && !form.email.trim()) {
      toast.error('Email is required when sending email invites');
      return;
    }

    setAdding(true);
    try {
      await createAttendee({
        eventId: selectedEvent,
        fullName: form.fullName.trim(),
        nationalId: form.nationalId.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        categoryId: form.categoryId,
        notificationChannel: form.notificationChannel,
      });
      toast.success('Attendee added successfully');
      resetForm();
      setShowAdd(false);
      setPage(1);
      const response = await getAttendees({ eventId: selectedEvent, page: 1, limit: pageSize });
      setAttendees(response.data?.data?.attendees || []);
      setTotal(response.data?.data?.total || 0);
      setPages(response.data?.data?.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add attendee');
    } finally {
      setAdding(false);
    }
  };

  const handleInvite = async (id) => {
    try {
      await inviteAttendee(id, { notificationChannel: 'both' });
      toast.success('Confirmation invite sent');
      setAttendees((current) =>
        current.map((attendee) =>
          attendee._id === id ? { ...attendee, confirmationStatus: 'invited' } : attendee
        )
      );
      if (selectedAttendee?._id === id) {
        setSelectedAttendee((current) => (current ? { ...current, confirmationStatus: 'invited' } : current));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invite');
    }
  };

  const handleExport = async () => {
    if (!selectedEvent) return;
    setExporting(true);
    try {
      const response = await exportAttendees({
        eventId: selectedEvent,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sub-organiser-attendees-${selectedEvent}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('Attendee list exported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendee Desk</h1>
            <p className="text-sm text-gray-500">Add attendees, resend invites, search records, and review attendee details for your assigned event.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              Export CSV
            </Button>
            {canAdd && <Button onClick={() => setShowAdd(true)}>Add Attendee</Button>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Current results</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{statusCounts.confirmed || 0}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Invited</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{statusCounts.invited || 0}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Needs photo review</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{attendees.filter((attendee) => attendee.photoVerificationStatus === 'pending' && attendee.photo).length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={selectedEvent}
              onChange={(event) => setSelectedEvent(event.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="invited">Invited</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {(selectedEventData?.categories || []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or NIC"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm xl:col-span-2"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Attendee List</h2>
              <p className="text-sm text-gray-500">Use status indicators to spot pending invites and unresolved photo checks fast.</p>
            </div>
            {loading && <p className="text-xs text-gray-400">Refreshing...</p>}
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>NIC</Th>
                <Th>Phone</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Photo</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <Tr key={attendee._id}>
                  <Td>
                    <div>
                      <p className="font-medium text-gray-900">{attendee.fullName || '-'}</p>
                      <p className="text-xs text-gray-500">{attendee.email || 'No email provided'}</p>
                    </div>
                  </Td>
                  <Td>{attendee.nationalId || '-'}</Td>
                  <Td>{attendee.phone || '-'}</Td>
                  <Td>{attendee.categoryName || '-'}</Td>
                  <Td>
                    <Badge color={confirmationColors[attendee.confirmationStatus] || 'gray'}>
                      {attendee.confirmationStatus}
                    </Badge>
                  </Td>
                  <Td>
                    {attendee.photo ? (
                      <Badge color={photoColors[attendee.photoVerificationStatus] || 'gray'}>
                        {attendee.photoVerificationStatus}
                      </Badge>
                    ) : (
                      <Badge color="gray">no photo</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <button onClick={() => loadAttendeeDetails(attendee._id)} className="font-medium text-gray-700 hover:underline">
                        View
                      </button>
                      {canInvite && ['pending', 'invited'].includes(attendee.confirmationStatus) && (
                        <button onClick={() => handleInvite(attendee._id)} className="font-medium text-blue-600 hover:underline">
                          Resend Invite
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {!loading && attendees.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-sm text-gray-500">
                    No attendees match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>
                Previous
              </Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((current) => Math.min(current + 1, pages))}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Attendee" size="lg">
        <form onSubmit={handleAddAttendee} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
              <input
                required
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="Attendee name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">NIC</label>
              <input
                value={form.nationalId}
                onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="National identity card number"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="+947XXXXXXXX"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="Optional unless sending email invite"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category *</label>
              <select
                required
                value={form.categoryId}
                onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select category</option>
                {(selectedEventData?.categories || []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Send invite via</label>
              <select
                value={form.notificationChannel}
                onChange={(event) => setForm((current) => ({ ...current, notificationChannel: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="both">Email + SMS</option>
                <option value="none">Do not send now</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            Attendees added here are protected by sub-organiser permissions. Only users with the allowed attendee permissions will see and use this section.
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={adding}>Save Attendee</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                setShowAdd(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selectedAttendee} onClose={() => setSelectedAttendee(null)} title="Attendee Details" size="lg">
        {selectedAttendee && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-gray-900">{selectedAttendee.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="font-medium text-gray-900">{selectedAttendee.categoryName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">NIC</p>
                <p className="font-medium text-gray-900">{selectedAttendee.nationalId || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{selectedAttendee.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{selectedAttendee.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Invite status</p>
                <Badge color={confirmationColors[selectedAttendee.confirmationStatus] || 'gray'}>
                  {selectedAttendee.confirmationStatus}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Photo status</p>
                {selectedAttendee.photo ? (
                  <Badge color={photoColors[selectedAttendee.photoVerificationStatus] || 'gray'}>
                    {selectedAttendee.photoVerificationStatus}
                  </Badge>
                ) : (
                  <Badge color="gray">no photo</Badge>
                )}
              </div>
            </div>

            {selectedAttendee.photo && (
              <div>
                <p className="mb-2 text-sm text-gray-500">Uploaded photo</p>
                <img
                  src={buildAssetUrl(selectedAttendee.photo)}
                  alt={selectedAttendee.fullName || 'Attendee'}
                  className="h-56 w-56 rounded-2xl border border-gray-200 object-cover"
                />
              </div>
            )}

            <div>
              <p className="mb-2 text-sm text-gray-500">Zone access</p>
              <div className="flex flex-wrap gap-2">
                {(selectedAttendee.allowedZones || []).length > 0 ? (
                  selectedAttendee.allowedZones.map((zone) => (
                    <span key={zone} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {zone}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">No zones assigned</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default SubOrgAttendees;
