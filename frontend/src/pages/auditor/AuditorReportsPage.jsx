import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { exportAuditReport, getAuditReports } from '../../api/audit';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Stat from '../../components/ui/Stat';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const AuditorReportsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(localStorage.getItem('lastSelectedEventId') || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zone, setZone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalAttendees: 0,
    confirmedAttendees: 0,
    checkedInCount: 0,
    deniedEntries: 0,
  });
  const [attendanceReport, setAttendanceReport] = useState([]);
  const [zoneMovementReport, setZoneMovementReport] = useState([]);
  const [exporting, setExporting] = useState('');

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
    if (!selectedEventId) return;
    setLoading(true);
    getAuditReports({
      eventId: selectedEventId,
      from: from || undefined,
      to: to || undefined,
      zone: zone || undefined,
      categoryId: categoryId || undefined,
    })
      .then((response) => {
        setSummary(response.data?.data?.summary || {});
        setAttendanceReport(response.data?.data?.attendanceReport || []);
        setZoneMovementReport(response.data?.data?.zoneMovementReport || []);
      })
      .finally(() => setLoading(false));
  }, [selectedEventId, from, to, zone, categoryId]);

  const handleEventChange = (nextId) => {
    setSelectedEventId(nextId);
    localStorage.setItem('lastSelectedEventId', nextId);
    window.dispatchEvent(new CustomEvent('entrynex:event-select', { detail: nextId }));
  };

  const selectedEvent = useMemo(
    () => events.find((event) => event._id === selectedEventId),
    [events, selectedEventId],
  );

  const handleExport = async (report) => {
    if (!selectedEventId) return;
    setExporting(report);
    try {
      const response = await exportAuditReport({
        eventId: selectedEventId,
        report,
        from: from || undefined,
        to: to || undefined,
        zone: zone || undefined,
        categoryId: categoryId || undefined,
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting('');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-[32px] bg-gradient-to-br from-amber-950 via-slate-950 to-slate-900 p-6 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">Audit Workspace</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">Audit Reports</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-300">
                Read-only attendance and zone movement reporting for the currently selected event. Filters stay aligned with the shared dashboard selection.
              </p>
            </div>
            {loading && <p className="text-sm font-semibold text-slate-300">Refreshing reports...</p>}
          </div>
        </section>

        <Card className="rounded-[28px] border-slate-200 bg-white">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select value={selectedEventId} onChange={(event) => handleEventChange(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900" />
            <select value={zone} onChange={(event) => setZone(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              <option value="">All zones</option>
              {(selectedEvent?.zones || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              <option value="">All categories</option>
              {(selectedEvent?.categories || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Attendees" value={summary.totalAttendees || 0} color="blue" />
          <Stat label="Confirmed Attendees" value={summary.confirmedAttendees || 0} color="green" />
          <Stat label="Checked In" value={summary.checkedInCount || 0} color="purple" />
          <Stat label="Denied Entries" value={summary.deniedEntries || 0} color="red" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="rounded-[28px] border-slate-200 bg-white" padding={false}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">Attendance Report</h2>
                <p className="mt-1 text-sm text-slate-500">Category-level attendance and check-in counts.</p>
              </div>
              <Button variant="outline" onClick={() => handleExport('attendance')} loading={exporting === 'attendance'}>
                Export CSV
              </Button>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Category</Th>
                  <Th>Total</Th>
                  <Th>Confirmed</Th>
                  <Th>Checked In</Th>
                </tr>
              </thead>
              <tbody>
                {attendanceReport.map((row) => (
                  <Tr key={row._id || 'uncategorised'}>
                    <Td>{row._id || 'Uncategorised'}</Td>
                    <Td>{row.totalAttendees}</Td>
                    <Td>{row.confirmedAttendees}</Td>
                    <Td>{row.checkedInCount}</Td>
                  </Tr>
                ))}
                {!loading && attendanceReport.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">No attendance rows match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white" padding={false}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">Zone Movement Report</h2>
                <p className="mt-1 text-sm text-slate-500">Entries, exits, and net movement by zone.</p>
              </div>
              <Button variant="outline" onClick={() => handleExport('zone_movement')} loading={exporting === 'zone_movement'}>
                Export CSV
              </Button>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Zone</Th>
                  <Th>Entries</Th>
                  <Th>Exits</Th>
                  <Th>Net</Th>
                </tr>
              </thead>
              <tbody>
                {zoneMovementReport.map((row) => (
                  <Tr key={row.zoneName}>
                    <Td>{row.zoneName}</Td>
                    <Td>{row.entries}</Td>
                    <Td>{row.exits}</Td>
                    <Td>{row.netMovement}</Td>
                  </Tr>
                ))}
                {!loading && zoneMovementReport.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-10 text-center text-sm text-slate-500">No zone movement rows match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorReportsPage;
