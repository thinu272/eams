import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { exportAuditReport, getAuditLogs } from '../../api/audit';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
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
  const [selectedEvent, setSelectedEvent] = useState('');
  const [logType, setLogType] = useState('entry');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getMyEvents().then((response) => {
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) setSelectedEvent(myEvents[0]._id);
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [selectedEvent, logType, from, to, zone, categoryId]);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    getAuditLogs({
      eventId: selectedEvent,
      type: logType,
      from: from || undefined,
      to: to || undefined,
      zone: zone || undefined,
      categoryId: categoryId || undefined,
      page,
      limit: 20,
    })
      .then((response) => {
        setLogs(response.data?.data?.logs || []);
        setTotal(response.data?.data?.total || 0);
        setPages(response.data?.data?.pages || 1);
      })
      .finally(() => setLoading(false));
  }, [selectedEvent, logType, from, to, zone, categoryId, page]);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const handleExport = async () => {
    if (!selectedEvent) return;
    setExporting(true);
    try {
      const response = await exportAuditReport({
        eventId: selectedEvent,
        report: logType === 'zone' ? 'zone_logs' : 'entry_logs',
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
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

  const zoneOptions = selectedEventData?.zones || [];
  const categoryOptions = selectedEventData?.categories || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-sm text-gray-500">Read-only log review for entry and zone activity with export-ready filters.</p>
          </div>
          <Button variant="outline" onClick={handleExport} loading={exporting}>Export CSV</Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <select value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <select value={logType} onChange={(event) => setLogType(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              <option value="entry">Entry logs</option>
              <option value="zone">Zone logs</option>
            </select>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            <select value={zone} onChange={(event) => setZone(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              <option value="">All zones</option>
              {zoneOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              <option value="">All categories</option>
              {categoryOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{logType === 'zone' ? 'Zone Log Records' : 'Entry Log Records'}</h2>
              <p className="text-sm text-gray-500">{total} results</p>
            </div>
            {loading && <p className="text-xs text-gray-400">Refreshing...</p>}
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
                  <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-500">No logs match the current filters.</td>
                </tr>
              )}
            </tbody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</Button>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage((current) => Math.min(current + 1, pages))}>Next</Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorLogsPage;
