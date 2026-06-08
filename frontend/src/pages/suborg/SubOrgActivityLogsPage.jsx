import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubLogs, getSubZones } from '../../api/sub';
import { getSystemLogs } from '../../api/audit';
import toast from 'react-hot-toast';
import Card, { CardHeader } from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const formatTime = (value) => new Date(value).toLocaleString();

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

const SubOrgActivityLogsPage = () => {
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState('');
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');

  const [activeTab, setActiveTab] = useState('access');
  const [sysLogsData, setSysLogsData] = useState({ logs: [], total: 0, pages: 1 });
  const [sysLoading, setSysLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [accessPage, setAccessPage] = useState(1);

  const load = async (nextZone = zone, eventId = currentEventId) => {
    try {
      const response = await getSubLogs({ 
        zone: nextZone || undefined, 
        eventId,
        limit: 100
      });
      setLogs(response.data?.data?.logs || []);
      setAccessPage(1);
      setLoadError('');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to load activity logs.';
      setLogs([]);
      setLoadError(message);
      toast.error(message);
    }
  };

  const loadSystemLogs = async (eventId = currentEventId) => {
    if (!eventId) return;
    setSysLoading(true);
    try {
      const response = await getSystemLogs({
        eventId,
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

  const loadZones = (eventId = currentEventId) => {
    getSubZones({ eventId })
      .then((response) => {
        const nextZones = response.data?.data?.zones || [];
        setZones(nextZones);
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Unable to load assigned zones.';
        setZones([]);
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(() => {
    loadZones();
    load('');

    const handleEventSelect = (e) => {
      const newId = e.detail;
      setCurrentEventId(newId);
      loadZones(newId);
      load('', newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () => window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadSystemLogs();
    }
  }, [activeTab, currentEventId, search, action, from, to, page]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Telemetry & Audits</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Event Activity Scopes</h1>
          <p className="mt-2 text-sm text-slate-500">Track zone/gate accesses and event actions in real-time.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-4 border-b border-slate-100 pb-px">
          <button
            onClick={() => setActiveTab('access')}
            className={`pb-4 text-sm font-semibold transition-all ${
              activeTab === 'access'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Access Validation Logs
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-4 text-sm font-semibold transition-all ${
              activeTab === 'activity'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Event Action Activity
          </button>
        </div>

        {activeTab === 'access' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <select
                value={zone}
                onChange={(event) => {
                  const nextZone = event.target.value;
                  setZone(nextZone);
                  load(nextZone);
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              >
                <option value="">All assigned zones</option>
                {zones.map((item) => <option key={item.id || item.name} value={item.id || item.name}>{item.name}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              {(() => {
                const accessItemsPerPage = 5;
                const totalAccessPages = Math.ceil(logs.length / accessItemsPerPage) || 1;
                const paginatedAccessLogs = logs.slice((accessPage - 1) * accessItemsPerPage, accessPage * accessItemsPerPage);

                return (
                  <>
                    {paginatedAccessLogs.map((item) => (
                      <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{item.action}</p>
                            <p className="mt-2 text-sm text-slate-600">{item.attendeeName} - {item.zoneName}</p>
                            <p className="mt-1 text-xs text-slate-400">Handled by {item.actorName}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {item.status}
                            </span>
                            <p className="mt-2 text-xs text-slate-400">{formatTime(item.timestamp)}</p>
                          </div>
                        </div>
                        {item.detail && <p className="mt-3 text-sm text-slate-500">{item.detail}</p>}
                      </article>
                    ))}
                    {logs.length === 0 && (
                      <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">
                        No logs found for the selected zone.
                      </div>
                    )}
                    {logs.length > 0 && (
                      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-xs text-slate-500">Page {accessPage} of {totalAccessPages} ({logs.length} total records)</span>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            disabled={accessPage <= 1} 
                            onClick={() => setAccessPage(accessPage - 1)}
                          >
                            Previous
                          </Button>
                          <Button 
                            variant="outline" 
                            disabled={accessPage >= totalAccessPages} 
                            onClick={() => setAccessPage(accessPage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <Card>
            <CardHeader title="Activity Logs" subtitle="Comprehensive platform-level log of actions scoped to this event" />
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search logs by operator, details..." 
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" 
              />
              <select 
                value={action} 
                onChange={(e) => setAction(e.target.value)} 
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
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
              <input 
                type="date" 
                value={from} 
                onChange={(e) => setFrom(e.target.value)} 
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" 
              />
              <input 
                type="date" 
                value={to} 
                onChange={(e) => setTo(e.target.value)} 
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" 
              />
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
                {sysLoading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">Loading activity logs...</td>
                  </tr>
                ) : (
                  (sysLogsData?.logs || []).map((log) => (
                    <Tr key={log._id}>
                      <Td>
                        <div className="text-xs">{new Date(log.createdAt).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{new Date(log.createdAt).toLocaleTimeString()}</div>
                      </Td>
                      <Td><span className="font-semibold text-slate-900">{log.userEmail || 'system'}</span></Td>
                      <Td><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">{log.userRole || 'System'}</span></Td>
                      <Td><Badge color={logActionColor[log.action] || 'gray'}>{String(log.action).replace('_', ' ').toUpperCase()}</Badge></Td>
                      <Td><p className="max-w-md text-sm font-medium text-slate-800 break-words">{log.details?.message}</p></Td>
                      <Td><span className="font-mono text-xs text-slate-500">{log.ipAddress || '-'}</span></Td>
                    </Tr>
                  ))
                )}
                {!sysLoading && (!sysLogsData?.logs || sysLogsData.logs.length === 0) && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">No activity logs found matching filters.</td>
                  </tr>
                )}
              </tbody>
            </Table>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">Page {sysLogsData?.page || 1} of {sysLogsData?.pages || 1} ({sysLogsData?.total || 0} total records)</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  disabled={page <= 1} 
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  disabled={page >= (sysLogsData?.pages || 1)} 
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}

        {loadError && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {loadError}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgActivityLogsPage;
