import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { exportAuditReport, getAuditLogs } from '../../api/audit';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const actionColors = {
  check_in: 'green',
  check_out: 'blue',
  zone_entry: 'purple',
  zone_exit: 'gray',
  denied: 'red',
  ENTRY: 'green',
  EXIT: 'gray',
};

const AuditorLogsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [logType, setLogType] = useState('entry');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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
  }, [selectedEventId, logType, from, to, zone, categoryId, search]);

  useEffect(() => {
    if (!selectedEventId) return;
    
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      getAuditLogs({
        eventId: selectedEventId,
        type: logType,
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
        search: search.trim() || undefined,
        page,
        limit: 10,
      })
        .then((response) => {
          setLogs(response.data?.data?.logs || []);
          setTotal(response.data?.data?.total || 0);
          setPages(response.data?.data?.pages || 1);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [selectedEventId, logType, from, to, zone, categoryId, search, page]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId],
  );

  const handleExport = async () => {
    if (!selectedEventId) return;
    setExporting(true);
    try {
      const response = await exportAuditReport({
        eventId: selectedEventId,
        report: logType === 'zone' ? 'zone_logs' : 'entry_logs',
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
        search: search.trim() || undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${logType}-audit-logs.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const zoneOptions = selectedEvent?.zones || [];
  const categoryOptions = selectedEvent?.categories || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-amber-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">Audit Workspace</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Audit Logs</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
                Review read-only entry and zone logs with export-ready filters. Event selection stays synchronized with the rest of the dashboard.
              </p>
            </div>
            <Button variant="outline" onClick={handleExport} loading={exporting} className="border-white/15 bg-white/5 text-white hover:bg-white/10">
              Export CSV
            </Button>
          </div>
        </section>

        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
            <select value={selectedEventId} onChange={(event) => handleEventChange(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <select value={logType} onChange={(event) => setLogType(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              <option value="entry">Entry logs</option>
              <option value="zone">Zone logs</option>
            </select>
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search attendee..." 
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" 
            />
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" />
            <select value={zone} onChange={(event) => setZone(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              <option value="">All zones</option>
              {zoneOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              <option value="">All categories</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </Card>

        <Card className="rounded-[28px] border-slate-200 bg-white" padding={false}>
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-black text-slate-900">{logType === 'zone' ? 'Zone Log Records' : 'Entry Log Records'}</h2>
              <p className="mt-1 text-sm text-slate-500">{total} results</p>
            </div>
            {loading && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Refreshing</p>}
          </div>

          <Table>
            <thead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Attendee</Th>
                <Th>Category</Th>
                <Th>{logType === 'zone' ? 'Zone' : 'Gate / Zone'}</Th>
                <Th>Action</Th>
                <Th>Access</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const attendeeName = logType === 'zone' ? log.attendeeSnapshot?.fullName || log.attendeeId?.fullName : log.snapshot?.fullName || log.attendee?.fullName;
                const categoryName = logType === 'zone' ? log.attendeeSnapshot?.categoryName : log.snapshot?.categoryName;
                const access = log.accessGranted ? 'Granted' : 'Denied';
                const location = logType === 'zone' ? log.zoneName : [log.gateName || log.gateId, log.zoneName].filter(Boolean).join(' / ');

                return (
                  <Tr key={log._id}>
                    <Td>{format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}</Td>
                    <Td>{attendeeName || '-'}</Td>
                    <Td>{categoryName || '-'}</Td>
                    <Td>{location || '-'}</Td>
                    <Td><Badge color={actionColors[log.action] || 'gray'}>{String(log.action).replace('_', ' ')}</Badge></Td>
                    <Td><Badge color={log.accessGranted ? 'green' : 'red'}>{access}</Badge></Td>
                  </Tr>
                );
              })}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No logs match the current filters.</td>
                </tr>
              )}
            </tbody>
          </Table>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs font-semibold text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((current) => Math.min(current + 1, pages))}>Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditorLogsPage;
