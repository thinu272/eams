import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { getEntryLogs, getEntryStats } from '../../api/entry';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Badge from '../../components/ui/Badge';
import Stat from '../../components/ui/Stat';
import { Table, Th, Td, Tr } from '../../components/ui/Table';
import { format } from 'date-fns';

const actionColors = { check_in: 'green', check_out: 'blue', zone_entry: 'purple', zone_exit: 'gray', denied: 'red' };

const EntryLogsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) setSelectedEvent(evs[0]._id); }); }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    Promise.all([getEntryLogs({ eventId: selectedEvent, limit: 50 }), getEntryStats(selectedEvent)])
      .then(([lr, sr]) => { setLogs(lr.data.data.logs); setStats(sr.data.data); });
  }, [selectedEvent]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Entry Logs</h1><p className="text-gray-500 text-sm">Real-time access events</p></div>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Stat label="Checked In" value={stats.checkedIn || 0} color="green"/>
          <Stat label="Access Denied" value={stats.denied || 0} color="red"/>
          <Stat label="Active Zones" value={stats.byZone?.length || 0} color="blue"/>
          <Stat label="Categories" value={stats.byCategory?.length || 0} color="purple"/>
        </div>
      )}

      <Table>
        <thead><tr><Th>Attendee</Th><Th>Action</Th><Th>Gate / Zone</Th><Th>Method</Th><Th>Access</Th><Th>Time</Th></tr></thead>
        <tbody>
          {logs.map(log => (
            <Tr key={log._id}>
              <Td><p className="font-medium">{log.attendee?.fullName}</p><p className="text-xs text-gray-400">{log.attendee?.categoryName}</p></Td>
              <Td><Badge color={actionColors[log.action]}>{log.action.replace('_', ' ')}</Badge></Td>
              <Td><p>{log.gateName || log.gateId}</p>{log.zoneName && <p className="text-xs text-gray-400">{log.zoneName}</p>}</Td>
              <Td><span className="text-xs uppercase bg-gray-100 px-2 py-0.5 rounded">{log.method}</span></Td>
              <Td><Badge color={log.accessGranted ? 'green' : 'red'}>{log.accessGranted ? 'Granted' : 'Denied'}</Badge></Td>
              <Td className="text-xs text-gray-500">{format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </DashboardLayout>
  );
};

export default EntryLogsPage;
