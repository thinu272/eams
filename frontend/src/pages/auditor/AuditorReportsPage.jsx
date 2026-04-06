import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { getMyEvents } from '../../api/events';
import { exportAuditReport, getAuditReports } from '../../api/audit';
import Button from '../../components/ui/Button';
import Stat from '../../components/ui/Stat';
import { Table, Td, Th, Tr } from '../../components/ui/Table';
import toast from 'react-hot-toast';

const AuditorReportsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
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
      const myEvents = response.data?.data?.events || [];
      setEvents(myEvents);
      if (myEvents.length > 0) setSelectedEvent(myEvents[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    setLoading(true);
    getAuditReports({
      eventId: selectedEvent,
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
  }, [selectedEvent, from, to, zone, categoryId]);

  const selectedEventData = useMemo(
    () => events.find((event) => event._id === selectedEvent),
    [events, selectedEvent]
  );

  const handleExport = async (report) => {
    if (!selectedEvent) return;
    setExporting(report);
    try {
      const response = await exportAuditReport({
        eventId: selectedEvent,
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Reports</h1>
            <p className="text-sm text-gray-500">Read-only attendance and zone movement reports with event-level filters.</p>
          </div>
          {loading && <p className="text-sm text-gray-400">Refreshing reports...</p>}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              {events.map((event) => (
                <option key={event._id} value={event._id}>{event.name}</option>
              ))}
            </select>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
            <select value={zone} onChange={(event) => setZone(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              <option value="">All zones</option>
              {(selectedEventData?.zones || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
              <option value="">All categories</option>
              {(selectedEventData?.categories || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total Attendees" value={summary.totalAttendees || 0} color="blue" />
          <Stat label="Confirmed Attendees" value={summary.confirmedAttendees || 0} color="green" />
          <Stat label="Checked In" value={summary.checkedInCount || 0} color="purple" />
          <Stat label="Denied Entries" value={summary.deniedEntries || 0} color="red" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Attendance Report</h2>
                <p className="text-sm text-gray-500">Category-level attendance and check-in counts.</p>
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
                    <td colSpan="4" className="px-4 py-10 text-center text-sm text-gray-500">No attendance rows match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Zone Movement Report</h2>
                <p className="text-sm text-gray-500">Entries, exits, and net movement by zone.</p>
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
                    <td colSpan="4" className="px-4 py-10 text-center text-sm text-gray-500">No zone movement rows match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AuditorReportsPage;
