import React, { useEffect, useState } from 'react';
import { getMyEvents } from '../../api/events';
import { exportAttendees, getAttendee, getAttendees, inviteAttendee, verifyPhoto } from '../../api/attendees';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const confirmColors = { confirmed: 'green', invited: 'blue', pending: 'yellow', rejected: 'red' };
const photoColors = { verified: 'green', pending: 'yellow', rejected: 'red' };
const pageSize = 12;

const OrganiserAttendees = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState([]);
  const [selectedAttendee, setSelectedAttendee] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getMyEvents().then((r) => {
      const evs = r.data?.data?.events || [];
      setEvents(evs);
      if (evs.length > 0) setSelectedEvent(evs[0]._id);
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
      .then((r) => {
        setAttendees(r.data?.data?.attendees || []);
        setTotal(r.data?.data?.total || 0);
        setPages(r.data?.data?.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent, statusFilter, categoryFilter, search, page]);

  const selectedEventData = events.find((event) => event._id === selectedEvent);

  const handleInvite = async (attendeeId) => {
    try {
      await inviteAttendee(attendeeId);
      toast.success('Invite sent again');
      setAttendees((current) =>
        current.map((attendee) =>
          attendee._id === attendeeId ? { ...attendee, confirmationStatus: 'invited' } : attendee
        )
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    }
  };

  const handleVerify = async (id, status) => {
    const reason = status === 'rejected' ? window.prompt('Rejection reason:') : undefined;
    try {
      await verifyPhoto(id, { status, rejectionReason: reason });
      toast.success(`Photo ${status}`);
      setAttendees((current) =>
        current.map((attendee) =>
          attendee._id === id ? { ...attendee, photoVerificationStatus: status } : attendee
        )
      );
      if (selectedAttendee?._id === id) {
        setSelectedAttendee((current) => current ? { ...current, photoVerificationStatus: status } : current);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Photo update failed');
    }
  };

  const handleView = async (id) => {
    try {
      const response = await getAttendee(id);
      setSelectedAttendee(response.data?.data?.attendee || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load attendee details');
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
      link.download = `attendees-${selectedEvent}.csv`;
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
            <h1 className="text-2xl font-bold text-gray-900">Attendee Management</h1>
            <p className="text-gray-500 text-sm">View, filter, inspect, and export attendee records for your event.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExport} loading={exporting}>Export CSV</Button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <select value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {events.map((event) => <option key={event._id} value={event._id}>{event.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="invited">Invited</option>
            <option value="confirmed">Confirmed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">All Categories</option>
            {(selectedEventData?.categories || []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm xl:col-span-2"
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Attendee List</h2>
              <p className="text-xs text-gray-500">{total} results across {pages} page{pages === 1 ? '' : 's'}</p>
            </div>
            {loading && <p className="text-xs text-gray-400">Refreshing...</p>}
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Photo</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <Tr key={attendee._id}>
                  <Td><p className="font-medium text-gray-900">{attendee.fullName || '-'}</p></Td>
                  <Td>{attendee.email || '-'}</Td>
                  <Td>{attendee.categoryName || '-'}</Td>
                  <Td><Badge color={confirmColors[attendee.confirmationStatus] || 'gray'}>{attendee.confirmationStatus}</Badge></Td>
                  <Td><Badge color={photoColors[attendee.photoVerificationStatus] || 'gray'}>{attendee.photoVerificationStatus}</Badge></Td>
                  <Td>
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => handleView(attendee._id)} className="text-gray-700 hover:underline">View</button>
                      {['pending', 'invited'].includes(attendee.confirmationStatus) && (
                        <button onClick={() => handleInvite(attendee._id)} className="text-blue-600 hover:underline">Resend Invite</button>
                      )}
                      {attendee.photo && attendee.photoVerificationStatus === 'pending' && (
                        <>
                          <button onClick={() => handleVerify(attendee._id, 'verified')} className="text-green-600 hover:underline">Verify</button>
                          <button onClick={() => handleVerify(attendee._id, 'rejected')} className="text-red-600 hover:underline">Reject</button>
                        </>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {!loading && attendees.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-sm text-gray-500">No attendees match the current filters.</td>
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

      <Modal open={!!selectedAttendee} onClose={() => setSelectedAttendee(null)} title="Attendee Details">
        {selectedAttendee && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Full Name</p>
                <p className="font-medium text-gray-900">{selectedAttendee.fullName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{selectedAttendee.email || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{selectedAttendee.phone || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Ticket Category</p>
                <p className="font-medium text-gray-900">{selectedAttendee.categoryName || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Confirmation Status</p>
                <Badge color={confirmColors[selectedAttendee.confirmationStatus] || 'gray'}>{selectedAttendee.confirmationStatus}</Badge>
              </div>
              <div>
                <p className="text-gray-500">Photo Status</p>
                <Badge color={photoColors[selectedAttendee.photoVerificationStatus] || 'gray'}>{selectedAttendee.photoVerificationStatus}</Badge>
              </div>
            </div>

            {selectedAttendee.photo && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Submitted Photo</p>
                <img
                  src={`http://localhost:5000/${selectedAttendee.photo}`}
                  alt={selectedAttendee.fullName}
                  className="w-40 h-40 rounded-xl object-cover border border-gray-200"
                />
              </div>
            )}

            <div>
              <p className="text-sm text-gray-500 mb-2">Zone Access</p>
              <div className="flex flex-wrap gap-2">
                {(selectedAttendee.allowedZones || []).length > 0 ? (
                  selectedAttendee.allowedZones.map((zone) => (
                    <span key={zone} className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{zone}</span>
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

export default OrganiserAttendees;
