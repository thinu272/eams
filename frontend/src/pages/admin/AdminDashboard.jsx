import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getSuperAdminLogs, getSuperAdminOverview } from '../../api/superAdmin';
import Stat from '../../components/ui/Stat';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  TicketIcon,
  UserGroupIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/solid';
import { format } from 'date-fns';

const statusColors = {
  draft: 'gray',
  published: 'green',
  ongoing: 'blue',
  completed: 'gray',
  cancelled: 'red',
};

const SuperAdminDashboard = () => {
  const [overview, setOverview] = useState({
    globalStats: { totalEvents: 0, totalUsers: 0, totalRevenue: 0, apiCallsToday: 0 },
    eventStatusBreakdown: [],
    organiserAssignments: [],
    recentErrors: [],
    apiUsageSummary: [],
  });
  const [logs, setLogs] = useState([]);
  const [logsMeta, setLogsMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    getSuperAdminOverview()
      .then((response) => {
        setOverview(response.data?.data || overview);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, from, to, pathFilter]);

  useEffect(() => {
    setLogsLoading(true);
    getSuperAdminLogs({
      type: typeFilter,
      from: from || undefined,
      to: to || undefined,
      path: pathFilter || undefined,
      page,
      limit: 12,
    })
      .then((response) => {
        setLogs(response.data?.data?.logs || []);
        setLogsMeta({
          total: response.data?.data?.total || 0,
          page: response.data?.data?.page || 1,
          pages: response.data?.data?.pages || 1,
        });
      })
      .finally(() => setLogsLoading(false));
  }, [typeFilter, from, to, pathFilter, page]);

  const statusSummary = useMemo(() => {
    return overview.eventStatusBreakdown.reduce((accumulator, item) => {
      accumulator[item._id] = item.count;
      return accumulator;
    }, {});
  }, [overview.eventStatusBreakdown]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Global event management, organiser control, revenue visibility, and system-wide API/error monitoring.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/events"><Button>Manage Events</Button></Link>
            <Link to="/admin/users"><Button variant="outline">Manage Users</Button></Link>
            <Link to="/admin/reports"><Button variant="outline">Operational Reports</Button></Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Events" value={overview.globalStats.totalEvents} color="blue" icon={<TicketIcon className="h-5 w-5" />} />
          <Stat label="Total Users" value={overview.globalStats.totalUsers} color="green" icon={<UsersIcon className="h-5 w-5" />} />
          <Stat label="Total Revenue" value={`LKR ${Number(overview.globalStats.totalRevenue || 0).toLocaleString()}`} color="purple" icon={<ChartBarIcon className="h-5 w-5" />} />
          <Stat label="API Calls Today" value={overview.globalStats.apiCallsToday} color="orange" icon={<ClipboardDocumentListIcon className="h-5 w-5" />} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Event Control</h2>
                <p className="text-sm text-gray-500">Quick visibility into event status and organiser assignment health.</p>
              </div>
              <WrenchScrewdriverIcon className="h-6 w-6 text-gray-400" />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {['draft', 'published', 'ongoing', 'completed', 'cancelled'].map((status) => (
                <div key={status} className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{status}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{statusSummary[status] || 0}</p>
                </div>
              ))}
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>Start</Th>
                  <Th>Organiser</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {(overview.organiserAssignments || []).map((event) => (
                  <Tr key={event._id}>
                    <Td>{event.name}</Td>
                    <Td>{event.startDate ? format(new Date(event.startDate), 'MMM d, yyyy') : '-'}</Td>
                    <Td>{event.mainOrganiser?.name || 'Unassigned'}</Td>
                    <Td><Badge color={statusColors[event.status] || 'gray'}>{event.status}</Badge></Td>
                  </Tr>
                ))}
                {!loading && (overview.organiserAssignments || []).length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-500">No events available.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">API Usage Summary</h2>
                <p className="text-sm text-gray-500">Top API routes from the last 7 days, including error counts.</p>
              </div>
              <UserGroupIcon className="h-6 w-6 text-gray-400" />
            </div>

            <div className="space-y-3">
              {(overview.apiUsageSummary || []).map((item) => (
                <div key={`${item.method}-${item.path}`} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{item.method} {item.path}</p>
                      <p className="mt-1 text-sm text-gray-500">Avg. {item.avgDurationMs}ms</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{item.count} calls</p>
                      <p className={`text-sm ${item.errorCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {item.errorCount} errors
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {!loading && (overview.apiUsageSummary || []).length === 0 && (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  API request metrics will appear here once the logger has collected traffic.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recent Errors</h2>
                <p className="text-sm text-gray-500">Latest failed requests captured by the system logger.</p>
              </div>
            </div>

            <div className="space-y-3">
              {(overview.recentErrors || []).map((item) => (
                <div key={item._id} className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-red-900">{item.method} {item.path}</p>
                      <p className="mt-1 text-sm text-red-700">{item.errorMessage || 'Request failed'}</p>
                      <p className="mt-1 text-xs text-red-600">
                        {item.userId?.name ? `${item.userId.name} (${item.userId.role})` : 'Unauthenticated'} • {format(new Date(item.createdAt), 'MMM d, yyyy HH:mm:ss')}
                      </p>
                    </div>
                    <Badge color="red">{item.statusCode}</Badge>
                  </div>
                </div>
              ))}
              {!loading && (overview.recentErrors || []).length === 0 && (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  No error requests have been logged yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">System Logs</h2>
                <p className="text-sm text-gray-500">Filter API usage and error logs across the platform.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
                  <option value="all">All requests</option>
                  <option value="errors">Errors only</option>
                </select>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
                <input value={pathFilter} onChange={(e) => setPathFilter(e.target.value)} placeholder="Filter by path" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Request</Th>
                  <Th>Status</Th>
                  <Th>User</Th>
                  <Th>Duration</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Tr key={log._id}>
                    <Td>{format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}</Td>
                    <Td>
                      <p className="font-medium text-gray-900">{log.method} {log.path}</p>
                      {log.errorMessage && <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>}
                    </Td>
                    <Td><Badge color={log.statusCode >= 400 ? 'red' : 'green'}>{log.statusCode}</Badge></Td>
                    <Td>{log.userId?.name || log.userRole || 'Guest'}</Td>
                    <Td>{log.durationMs}ms</Td>
                  </Tr>
                ))}
                {!logsLoading && logs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-500">No logs match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500">Page {logsMeta.page} of {logsMeta.pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</Button>
                <Button variant="outline" disabled={page >= logsMeta.pages} onClick={() => setPage((current) => Math.min(current + 1, logsMeta.pages))}>Next</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
