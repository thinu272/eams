import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { getSystemLogs } from '../../api/audit';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const logActionColor = {
  login: 'green',
  logout: 'gray',
  ticket_creation: 'indigo',
  ticket_scan: 'blue',
  event_update: 'amber',
  user_creation: 'indigo',
  qr_verification: 'green',
  sponsor_action: 'purple',
  mfa_activity: 'rose'
};

const AuditorSystemLogsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [sysLogsData, setSysLogsData] = useState({ logs: [], total: 0, pages: 1 });
  const [sysLoading, setSysLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    getMyEvents().then((response) => {
      const nextEvents = response.data?.data?.events || [];
      setEvents(nextEvents);
      const isValidEvent = nextEvents.some(e => e._id === selectedEventId);
      const fallbackEventId = (isValidEvent ? selectedEventId : nextEvents[0]?._id) || '';
      if (fallbackEventId) {
        setSelectedEventId(fallbackEventId);
        localStorage.setItem('lastSelectedEventId', fallbackEventId);
      }
    });
  }, [selectedEventId]);

  useEffect(() => {
    const handleEventSelect = (event) => {
      const nextId = event.detail || '';
      setSelectedEventId(nextId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedEventId, search, action, from, to]);

  const loadSystemLogs = async () => {
    if (!selectedEventId) return;
    setSysLoading(true);
    try {
      const response = await getSystemLogs({
        eventId: selectedEventId,
        search: search || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 15
      });
      setSysLogsData(response.data?.data || { logs: [], total: 0, pages: 1 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch activity logs');
    } finally {
      setSysLoading(false);
    }
  };

  useEffect(() => {
    loadSystemLogs();
  }, [selectedEventId, search, action, from, to, page]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-300">Auditor Telemetry</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">System Audit Logs</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
                Full read-only access to track security audits, user creations, configuration updates, and MFA events.
              </p>
            </div>
          </div>
        </section>

        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select value={selectedEventId} onChange={(event) => handleEventChange(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search logs..." 
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" 
            />
            <select 
              value={action} 
              onChange={(e) => setAction(e.target.value)} 
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900"
            >
              <option value="">All action types</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="ticket_creation">Ticket Creation</option>
              <option value="ticket_scan">Ticket Scan</option>
              <option value="event_update">Event Update</option>
              <option value="user_creation">User Creation</option>
              <option value="qr_verification">QR Photo Verification</option>
              <option value="sponsor_action">Sponsor Action</option>
              <option value="mfa_activity">MFA Activity</option>
            </select>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" />
          </div>
        </Card>

        <Card className="rounded-[28px] border-slate-200 bg-white" padding={false}>
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">Audit Actions Grid</h2>
              <p className="mt-1 text-sm text-slate-500">{sysLogsData?.total || 0} results</p>
            </div>
            {sysLoading && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Refreshing</p>}
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Operator</Th>
                <Th>Role</Th>
                <Th>Action</Th>
                <Th>Details</Th>
                <Th>IP Address</Th>
              </tr>
            </thead>
            <tbody>
              {sysLogsData?.logs?.map((log) => (
                <Tr key={log._id}>
                  <Td>{format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}</Td>
                  <Td><span className="font-semibold text-slate-950">{log.userEmail || 'system'}</span></Td>
                  <Td><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">{log.userRole || 'System'}</span></Td>
                  <Td><Badge color={logActionColor[log.action] || 'gray'}>{String(log.action).replace('_', ' ').toUpperCase()}</Badge></Td>
                  <Td><p className="max-w-md text-sm font-medium text-slate-800 break-words">{log.details?.message}</p></Td>
                  <Td><span className="font-mono text-xs text-slate-500">{log.ipAddress || '-'}</span></Td>
                </Tr>
              ))}
              {!sysLoading && (!sysLogsData?.logs || sysLogsData.logs.length === 0) && (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No activity logs match the current filters.</td>
                </tr>
              )}
            </tbody>
          </Table>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs font-semibold text-slate-500">Page {page} of {sysLogsData?.pages || 1}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</Button>
              <Button variant="outline" disabled={page >= (sysLogsData?.pages || 1)} onClick={() => setPage((current) => Math.min(current + 1, sysLogsData.pages))}>Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditorSystemLogsPage;
