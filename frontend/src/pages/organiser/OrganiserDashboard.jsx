import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyEvents } from '../../api/events';
import { getEventDashboard } from '../../api/events';
import { getEntryStats } from '../../api/entry';
import DashboardLayout from '../../components/layout/DashboardLayout';
import Stat from '../../components/ui/Stat';
import Card, { CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const OrganiserDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [dashData, setDashData] = useState(null);
  const [entryStats, setEntryStats] = useState(null);

  useEffect(() => {
    getMyEvents().then(r => {
      const evs = r.data.data.events;
      setEvents(evs);
      if (evs.length > 0) setSelectedEvent(evs[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    Promise.all([getEventDashboard(selectedEvent), getEntryStats(selectedEvent)])
      .then(([dr, er]) => { setDashData(dr.data.data); setEntryStats(er.data.data); });
  }, [selectedEvent]);

  const statusCounts = (dashData?.attendeeStats || []).reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {});
  const totalAttendees = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Organiser Dashboard</h1><p className="text-gray-500 text-sm">Welcome, {user?.name}</p></div>
        {events.length > 1 && (
          <select value={selectedEvent || ''} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        )}
      </div>

      {dashData && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-blue-900 text-lg">{dashData.event?.name}</h3>
                <div className="flex gap-4 text-sm text-blue-700 mt-1">
                  <span>📅 {dashData.event?.startDate ? format(new Date(dashData.event.startDate), 'EEE MMM d, yyyy') : ''}</span>
                  <span>📍 {dashData.event?.venue?.name}, {dashData.event?.venue?.city}</span>
                </div>
              </div>
              <Link to={`/organiser/events/${selectedEvent}`} className="bg-white text-blue-600 px-3 py-1.5 rounded-lg text-sm font-medium border border-blue-200 hover:bg-blue-50 transition-colors">
                Edit Event
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat label="Total Attendees" value={totalAttendees} color="blue"/>
            <Stat label="Confirmed" value={statusCounts.confirmed || 0} color="green"/>
            <Stat label="Pending" value={statusCounts.pending || 0} color="orange"/>
            <Stat label="Checked In Today" value={entryStats?.checkedIn || 0} color="purple"/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Zone Access Today" subtitle="Live entry counts by zone"/>
              <div className="space-y-3">
                {(entryStats?.byZone || []).map(z => (
                  <div key={z._id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{z.zoneName || z._id}</span>
                    <span className="font-semibold text-gray-900">{z.count}</span>
                  </div>
                ))}
                {(!entryStats?.byZone || entryStats.byZone.length === 0) && <p className="text-sm text-gray-400">No zone entries yet</p>}
              </div>
            </Card>

            <Card>
              <CardHeader title="Quick Actions"/>
              <div className="grid grid-cols-2 gap-3">
                <Link to="/organiser/attendees" className="flex flex-col items-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                  <span className="text-2xl mb-1">👤</span>
                  <span className="text-sm font-medium text-blue-900">Attendees</span>
                </Link>
                <Link to="/organiser/team" className="flex flex-col items-center p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
                  <span className="text-2xl mb-1">👥</span>
                  <span className="text-sm font-medium text-purple-900">My Team</span>
                </Link>
                <Link to="/organiser/entry-logs" className="flex flex-col items-center p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                  <span className="text-2xl mb-1">📋</span>
                  <span className="text-sm font-medium text-green-900">Entry Logs</span>
                </Link>
                <Link to="/organiser/reports" className="flex flex-col items-center p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors">
                  <span className="text-2xl mb-1">📊</span>
                  <span className="text-sm font-medium text-orange-900">Reports</span>
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default OrganiserDashboard;
