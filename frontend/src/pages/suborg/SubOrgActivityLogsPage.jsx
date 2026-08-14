import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSubLogs, getSubZones } from '../../api/sub';
import { getSystemLogs } from '../../api/audit';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import {
  ArrowLeftIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';

const formatTime = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

const logActionColor = {
  login: 'green',
  logout: 'gray',
  ticket_creation: 'blue',
  ticket_scan: 'blue',
  event_update: 'amber',
  user_creation: 'blue',
  qr_verification: 'green',
  sponsor_action: 'gray',
  mfa_activity: 'rose',
};

const SubOrgActivityLogsPage = () => {
  const [zones, setZones] = useState([]);
  const [zone, setZone] = useState('');
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [currentEventId, setCurrentEventId] = useState(
    localStorage.getItem('lastSelectedEventId') || ''
  );

  const [activeTab, setActiveTab] = useState('access');
  const [sysLogsData, setSysLogsData] = useState({
    logs: [],
    total: 0,
    pages: 1,
    page: 1,
  });
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
        limit: 100,
      });
      setLogs(response.data?.data?.logs || []);
      setAccessPage(1);
      setLoadError('');
    } catch (error) {
      const message =
        error.response?.data?.message || 'Unable to load activity logs.';
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
        limit: 15,
      });
      setSysLogsData(
        response.data?.data || { logs: [], total: 0, pages: 1, page: 1 }
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to fetch activity logs'
      );
    } finally {
      setSysLoading(false);
    }
  };

  const loadZones = (eventId = currentEventId) => {
    getSubZones({ eventId })
      .then((response) => {
        setZones(response.data?.data?.zones || []);
      })
      .catch((error) => {
        const message =
          error.response?.data?.message || 'Unable to load assigned zones.';
        setZones([]);
        setLoadError(message);
        toast.error(message);
      });
  };

  useEffect(() => {
    loadZones();
    load('');

    const handleEventSelect = (e) => {
      const newId = e.detail ? String(e.detail) : '';
      if (!newId || newId === 'undefined') return;
      setCurrentEventId(newId);
      localStorage.setItem('lastSelectedEventId', newId);
      loadZones(newId);
      load('', newId);
    };

    window.addEventListener('entrynex:event-select', handleEventSelect);
    return () =>
      window.removeEventListener('entrynex:event-select', handleEventSelect);
  }, []);

  useEffect(() => {
    if (activeTab === 'activity') {
      loadSystemLogs();
    }
  }, [activeTab, currentEventId, search, action, from, to, page]);

  const accessItemsPerPage = 8;
  const totalAccessPages = Math.ceil(logs.length / accessItemsPerPage) || 1;
  const paginatedAccessLogs = logs.slice(
    (accessPage - 1) * accessItemsPerPage,
    accessPage * accessItemsPerPage
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to="/suborg/dashboard"
                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-blue-600 hover:text-blue-700"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <span className="text-slate-300">·</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Activity Logs
              </p>
            </div>
            <h1 className="mt-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Event activity scopes
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Track zone/gate access and event actions in your scope.
            </p>
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
          {[
            { key: 'access', label: 'Access validation' },
            { key: 'activity', label: 'Event action activity' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {loadError}
          </div>
        )}

        {/* Access logs */}
        {activeTab === 'access' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <select
                value={zone}
                onChange={(e) => {
                  const nextZone = e.target.value;
                  setZone(nextZone);
                  load(nextZone);
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All assigned zones</option>
                {zones.map((item) => (
                  <option
                    key={item.id || item.name}
                    value={item.id || item.name}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <MapPinIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  No logs found
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  No access logs for the selected zone.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedAccessLogs.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-white px-4 py-3.5 shadow-sm transition hover:border-blue-100 hover:bg-blue-50/20"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.action}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.attendeeName}
                          {item.zoneName ? ` · ${item.zoneName}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Handled by {item.actorName || '—'}
                        </p>
                        {item.detail && (
                          <p className="mt-1.5 text-xs text-slate-500">
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            item.status === 'success'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {item.status}
                        </span>
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          {formatTime(item.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {totalAccessPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Page {accessPage} of {totalAccessPages} · {logs.length}{' '}
                      total
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={accessPage <= 1}
                        onClick={() => setAccessPage((p) => p - 1)}
                        className="h-8 rounded-lg px-3 text-xs"
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={accessPage >= totalAccessPages}
                        onClick={() => setAccessPage((p) => p + 1)}
                        className="h-8 rounded-lg px-3 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* System activity */}
        {activeTab === 'activity' && (
          <Card
            className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden"
            padding={false}
          >
            <div className="border-b border-slate-100 bg-slate-50/40 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                Activity logs
              </h2>
              <p className="text-sm text-slate-500">
                Platform actions scoped to this event
              </p>
            </div>

            <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search operator, details…"
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <thead>
                  <Tr>
                    <Th>Timestamp</Th>
                    <Th>Operator</Th>
                    <Th>Role</Th>
                    <Th>Action</Th>
                    <Th>Details</Th>
                    <Th>IP</Th>
                  </Tr>
                </thead>
                <tbody>
                  {sysLoading ? (
                    <Tr>
                      <Td colSpan={6}>
                        <p className="py-8 text-center text-sm text-slate-400">
                          Loading activity logs…
                        </p>
                      </Td>
                    </Tr>
                  ) : (sysLogsData?.logs || []).length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>
                        <p className="py-8 text-center text-sm text-slate-400">
                          No activity logs match these filters.
                        </p>
                      </Td>
                    </Tr>
                  ) : (
                    (sysLogsData?.logs || []).map((log) => (
                      <Tr key={log._id}>
                        <Td>
                          <p className="text-xs text-slate-700">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </Td>
                        <Td>
                          <span className="font-semibold text-slate-900">
                            {log.userEmail || 'system'}
                          </span>
                        </Td>
                        <Td>
                          <span className="rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                            {log.userRole || 'System'}
                          </span>
                        </Td>
                        <Td>
                          <Badge color={logActionColor[log.action] || 'gray'}>
                            {String(log.action || '')
                              .replace(/_/g, ' ')
                              .toUpperCase()}
                          </Badge>
                        </Td>
                        <Td>
                          <p className="max-w-md text-sm text-slate-700 break-words">
                            {log.details?.message || '—'}
                          </p>
                        </Td>
                        <Td>
                          <span className="font-mono text-xs text-slate-500">
                            {log.ipAddress || '—'}
                          </span>
                        </Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Page {sysLogsData?.page || page} of {sysLogsData?.pages || 1} ·{' '}
                {sysLogsData?.total || 0} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (sysLogsData?.pages || 1)}
                  onClick={() => setPage(page + 1)}
                  className="h-8 rounded-lg px-3 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubOrgActivityLogsPage;