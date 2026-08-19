 import React, { useEffect, useMemo, useState } from 'react';
import OrganiserLayout from '../../layouts/OrganiserLayout';
import { getOrganiserAttendeesScoped, inviteOrganiserAttendee } from '../../api/organiser';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import { getAttendee } from '../../api/attendees';
import { getOrganiserEntryLogs } from '../../api/organiser';

const OrganiserAttendees = () => {
  const [attendees, setAttendees] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', category: '', photoStatus: '' });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [searchValue, setSearchValue] = useState('');

  const load = () => {
    getOrganiserAttendeesScoped({
      search: filters.search || undefined,
      status: filters.status || undefined,
      category: filters.category || undefined,
      photoStatus: filters.photoStatus || undefined,
      limit: 100,
    }).then((res) => setAttendees(res.data?.data?.attendees || []));
  };

  useEffect(() => { load(); }, [filters]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchValue }));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchValue]);

  const categories = useMemo(() => {
    const set = new Set(attendees.map((a) => a.categoryName).filter(Boolean));
    return Array.from(set);
  }, [attendees]);

  const sendInvite = async (id) => {
    try {
      await inviteOrganiserAttendee(id);
      toast.success('Invite sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    }
  };

  const openDetails = async (attendee) => {
    setSelected(attendee);
    const res = await getAttendee(attendee._id);
    setDetail(res.data?.data?.attendee || null);
    const logsRes = await getOrganiserEntryLogs({ attendeeId: attendee._id, limit: 20 });
    setLogs(logsRes.data?.data?.logs || []);
  };

  return (
    <OrganiserLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Attendees</h1>
            <p className="text-sm text-slate-500">Manage confirmations and photo status.</p>
          </div>
          <Link to="/suborganiser/verify-photos"><Button variant="outline">Verify Photos</Button></Link>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <input
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            placeholder="Search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="invited">Invited</option>
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={filters.photoStatus} onChange={(e) => setFilters((f) => ({ ...f, photoStatus: e.target.value }))}>
            <option value="">All Photo Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left">Photo</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">National ID</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Photo Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a._id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden">
                      {a.photo && <img src={a.photo} alt="" className="h-full w-full object-cover" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">{a.fullName || a.email}</td>
                  <td className="px-4 py-3">{a.nationalId || '-'}</td>
                  <td className="px-4 py-3">{a.categoryName}</td>
                  <td className="px-4 py-3"><Badge color={a.confirmationStatus === 'confirmed' ? 'green' : 'blue'}>{a.confirmationStatus}</Badge></td>
                  <td className="px-4 py-3"><Badge color={a.photoVerificationStatus === 'verified' ? 'green' : a.photoVerificationStatus === 'rejected' ? 'red' : 'yellow'}>{a.photoVerificationStatus}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDetails(a)}>View</Button>
                      <Button size="sm" variant="outline" onClick={() => sendInvite(a._id)}>Send Invite</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {attendees.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">No attendees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!selected} onClose={() => { setSelected(null); setDetail(null); }} title="Attendee Details">
        {detail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-xl bg-slate-100 overflow-hidden">
                {detail.photo && <img src={detail.photo} alt="" className="h-full w-full object-cover" />}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{detail.fullName || detail.email}</p>
                <p className="text-sm text-slate-500">{detail.categoryName}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-600">
              <div>National ID: {detail.nationalId || '-'}</div>
              <div>Email: {detail.email || '-'}</div>
              <div>Phone: {detail.phone || '-'}</div>
              <div>Confirmation: {detail.confirmationStatus}</div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Entry Logs</h4>
              <div className="mt-2 space-y-2">
                {logs.map((log) => (
                  <div key={log._id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {log.action} - {log.gateName || log.zoneName || '-'} - {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-xs text-slate-400">No logs for this attendee.</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400">Loading attendee...</div>
        )}
      </Modal>
    </OrganiserLayout>
  );
};

export default OrganiserAttendees;
