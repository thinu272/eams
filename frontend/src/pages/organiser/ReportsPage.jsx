import React, { useState, useEffect } from 'react';
import { getMyEvents } from '../../api/events';
import { getAttendees } from '../../api/attendees';
import { getEntryStats } from '../../api/entry';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Stat from '../../components/ui/Stat';

const COLORS = ['#2563EB', '#16A34A', '#D97706', '#7C3AED', '#DC2626'];

const ReportsPage = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [categoryData, setCategoryData] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalAttendees, setTotalAttendees] = useState(0);

  useEffect(() => { getMyEvents().then(r => { const evs = r.data.data.events; setEvents(evs); if (evs.length) setSelectedEvent(evs[0]._id); }); }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    const ev = events.find(e => e._id === selectedEvent);
    if (!ev) return;
    Promise.all([getAttendees({ eventId: selectedEvent, limit: 1 }), getEntryStats(selectedEvent)])
      .then(([ar, sr]) => {
        setTotalAttendees(ar.data.data.total);
        setStats(sr.data.data);
        const catData = (ev.categories || []).map(c => ({ name: c.name, capacity: c.capacity, sold: c.sold || 0 }));
        setCategoryData(catData);
      });
  }, [selectedEvent, events]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1></div>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Total Attendees" value={totalAttendees} color="blue"/>
        <Stat label="Checked In" value={stats?.checkedIn || 0} color="green"/>
        <Stat label="Access Denied" value={stats?.denied || 0} color="red"/>
        <Stat label="Active Zones" value={stats?.byZone?.length || 0} color="purple"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tickets: Sold vs Capacity</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Bar dataKey="capacity" fill="#E5E7EB" name="Capacity" radius={[4,4,0,0]}/>
              <Bar dataKey="sold" fill="#2563EB" name="Sold" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Entry by Zone</h3>
          {stats?.byZone?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.byZone} dataKey="count" nameKey="zoneName" cx="50%" cy="50%" outerRadius={80} label>
                  {stats.byZone.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip/><Legend/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No zone data yet</div>}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
